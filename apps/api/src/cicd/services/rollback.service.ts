import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DeploymentService } from '../../deployment/deployment.service';
import {
  DeploymentDto,
  RollbackResponse,
  RollbackRequest,
} from '@cloudpilot/shared';

@Injectable()
export class RollbackService {
  private readonly logger = new Logger(RollbackService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => DeploymentService))
    private readonly deploymentService: DeploymentService,
  ) {}

  /**
   * Orchestrates deterministic rollback to a previous healthy deployment.
   */
  async rollbackDeployment(
    userId: string,
    projectId: string,
    deploymentId: string,
    request?: RollbackRequest,
  ): Promise<RollbackResponse> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const currentDeployment = await this.prisma.deployment.findFirst({
      where: { id: deploymentId, projectId },
      include: { environment: true },
    });

    if (!currentDeployment) {
      throw new NotFoundException('Deployment not found');
    }

    // Concurrency check: verify no deployment is currently running for this project
    const activeDeployment = await this.prisma.deployment.findFirst({
      where: {
        projectId,
        status: { in: ['PENDING', 'VALIDATING', 'BUILDING', 'STARTING', 'HEALTH_CHECKING'] },
      },
    });

    if (activeDeployment) {
      throw new ConflictException('A deployment is already in progress for this project.');
    }

    // Find the target previous healthy deployment
    let targetDeployment: any = null;

    if (request?.targetDeploymentId) {
      targetDeployment = await this.prisma.deployment.findFirst({
        where: {
          id: request.targetDeploymentId,
          projectId,
          environmentId: currentDeployment.environmentId,
        },
      });

      if (!targetDeployment) {
        throw new NotFoundException(`Target rollback deployment '${request.targetDeploymentId}' not found in the same environment.`);
      }
    } else {
      // Find the most recent HEALTHY/RUNNING deployment in this environment prior to the current one
      targetDeployment = await this.prisma.deployment.findFirst({
        where: {
          projectId,
          environmentId: currentDeployment.environmentId,
          id: { not: currentDeployment.id },
          status: 'RUNNING',
          healthStatus: 'HEALTHY',
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!targetDeployment) {
        // Fall back to any prior deployment with a valid plan if none currently RUNNING
        targetDeployment = await this.prisma.deployment.findFirst({
          where: {
            projectId,
            environmentId: currentDeployment.environmentId,
            id: { not: currentDeployment.id },
            plan: { not: null as any },
          },
          orderBy: { createdAt: 'desc' },
        });
      }
    }

    if (!targetDeployment || !targetDeployment.plan) {
      throw new BadRequestException('No eligible previous healthy deployment found to rollback to.');
    }

    // Prevent immediate loop: do not rollback to the exact same deployment that is failed
    if (targetDeployment.id === currentDeployment.id) {
      throw new BadRequestException('Cannot rollback to the same deployment.');
    }

    this.logger.log(`Initiating rollback for project ${projectId}: from #${currentDeployment.deploymentNumber || currentDeployment.id} to #${targetDeployment.deploymentNumber || targetDeployment.id}`);

    // Create and execute new rollback deployment
    const rollbackDeploymentDto = await this.deploymentService.deployWithVersion(
      userId,
      projectId,
      {
        environmentId: currentDeployment.environmentId || undefined,
        commitSha: targetDeployment.commitSha || undefined,
        branch: targetDeployment.branch || currentDeployment.branch || 'main',
        triggerType: 'ROLLBACK',
        triggeredBy: `Rollback from #${currentDeployment.deploymentNumber || currentDeployment.id.substring(0, 8)}`,
        previousDeploymentId: currentDeployment.id,
        rollbackTargetId: targetDeployment.id,
        isRollback: true,
        reusePlan: targetDeployment.plan,
      },
    );

    return {
      message: `Rollback initiated to deployment #${targetDeployment.deploymentNumber || targetDeployment.id.substring(0, 8)} (${targetDeployment.commitSha?.substring(0, 7) || 'previous commit'}).`,
      rollbackDeployment: rollbackDeploymentDto,
      rolledBackFromId: currentDeployment.id,
      rolledBackToId: targetDeployment.id,
    };
  }

  /**
   * Automatic rollback evaluator called when a deployment fails.
   */
  async evaluateAutoRollback(failedDeploymentId: string): Promise<boolean> {
    const deployment = await this.prisma.deployment.findUnique({
      where: { id: failedDeploymentId },
      include: { environment: true },
    });

    if (!deployment || !deployment.environmentId || !deployment.environment) {
      return false;
    }

    // Check if auto rollback is enabled
    if (!deployment.environment.autoRollbackEnabled) {
      return false;
    }

    // Loop prevention: do NOT auto-rollback if this deployment was ALREADY a rollback!
    if (deployment.triggerType === 'ROLLBACK' || deployment.isRollback) {
      this.logger.warn(`Auto-rollback skipped for deployment ${failedDeploymentId} to prevent rollback loop.`);
      return false;
    }

    // Enforce maxRollbackAttempts: count recent automatic rollback deployments in this environment
    const maxAttempts = deployment.environment.maxRollbackAttempts ?? 1;
    const recentRollbackCount = await this.prisma.deployment.count({
      where: {
        projectId: deployment.projectId,
        environmentId: deployment.environmentId,
        isRollback: true,
        triggerType: 'ROLLBACK',
        createdAt: {
          // Count rollbacks within the last hour as part of the same "attempt window"
          gte: new Date(Date.now() - 60 * 60 * 1000),
        },
      },
    });

    if (recentRollbackCount >= maxAttempts) {
      this.logger.warn(
        `Auto-rollback skipped for deployment ${failedDeploymentId}: maxRollbackAttempts (${maxAttempts}) already reached (${recentRollbackCount} rollback(s) in the last hour for environment ${deployment.environment.name}).`,
      );
      return false;
    }

    // Find previous healthy deployment in the same environment
    const previousHealthy = await this.prisma.deployment.findFirst({
      where: {
        projectId: deployment.projectId,
        environmentId: deployment.environmentId,
        id: { not: deployment.id },
        status: 'RUNNING',
        healthStatus: 'HEALTHY',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!previousHealthy) {
      this.logger.warn(`Auto-rollback failed: no previous healthy deployment found for environment ${deployment.environment.name}`);
      return false;
    }

    try {
      this.logger.log(`Triggering automatic rollback for failed deployment ${failedDeploymentId} -> ${previousHealthy.id}`);
      await this.rollbackDeployment(
        deployment.userId,
        deployment.projectId,
        deployment.id,
        {
          targetDeploymentId: previousHealthy.id,
          reason: 'Automatic rollback triggered due to health check failure',
        },
      );
      return true;
    } catch (err: any) {
      this.logger.error(`Automatic rollback failed to trigger: ${err.message}`);
      return false;
    }
  }
}
