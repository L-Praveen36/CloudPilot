import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import * as path from 'path';
import * as fsp from 'fs/promises';
import { PrismaService } from '../prisma/prisma.service';
import { RepositorySourceService } from '../repository-intelligence/services/repository-source.service';
import { RepositoryAnalyzerService } from '../repository-intelligence/services/repository-analyzer.service';
import { ApplicationStructureService } from '../repository-intelligence/services/application-structure.service';
import { DeploymentReadinessService } from '../repository-intelligence/services/deployment-readiness.service';
import { DeploymentPlanService } from './services/deployment-plan.service';
import { DockerExecutionService } from './services/docker-execution.service';
import { EnvironmentService } from '../cicd/services/environment.service';
import { RollbackService } from '../cicd/services/rollback.service';
import {
  DeploymentDto,
  DeploymentPlan,
  DeploymentLogsResponse,
  DeploymentLogEntry,
  DeploymentStatus,
  DeploymentHealthStatus,
  DeploymentTriggerType,
  RepositoryAnalysisDto,
  ApplicationStructureDto,
  DeploymentReadinessDto,
} from '@cloudpilot/shared';

export interface DeployVersionOptions {
  environmentId?: string;
  commitSha?: string;
  commitMessage?: string;
  branch?: string;
  triggerType?: DeploymentTriggerType;
  triggeredBy?: string;
  previousDeploymentId?: string;
  rollbackTargetId?: string;
  isRollback?: boolean;
  reusePlan?: DeploymentPlan;
}

interface ActiveDeploymentHandle {
  abortController: AbortController;
  containerName?: string;
  imageTag?: string;
}

@Injectable()
export class DeploymentService {
  private readonly logger = new Logger(DeploymentService.name);

  // In-memory registry of active deployments for cancellation and tracking
  private readonly activeDeployments = new Map<string, ActiveDeploymentHandle>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly sourceService: RepositorySourceService,
    private readonly analyzerService: RepositoryAnalyzerService,
    private readonly structureService: ApplicationStructureService,
    private readonly readinessService: DeploymentReadinessService,
    private readonly planService: DeploymentPlanService,
    private readonly dockerService: DockerExecutionService,
    @Inject(forwardRef(() => EnvironmentService))
    private readonly environmentService: EnvironmentService,
    @Inject(forwardRef(() => RollbackService))
    private readonly rollbackService: RollbackService,
  ) {}

  /**
   * Generates a dry-run deployment plan without executing Docker.
   */
  async createDeploymentPlan(userId: string, projectId: string): Promise<DeploymentPlan> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return this.sourceService.withRepositorySource(userId, projectId, async (ctx) => {
      // 1. Run Phase 3.2 stack analysis
      const analysisResult = await this.analyzerService.analyzeWorkspace(ctx.workspacePath);

      // 2. Run Phase 3.3 structure detection
      const structureResult = await this.structureService.detectStructure(ctx.workspacePath);

      // Safe reads for Dockerfile and .env.example
      let dockerfileContent: string | null = null;
      let envExampleContent: string | null = null;
      try {
        dockerfileContent = await fsp.readFile(path.join(ctx.workspacePath, 'Dockerfile'), 'utf-8');
      } catch {}
      try {
        envExampleContent =
          (await fsp.readFile(path.join(ctx.workspacePath, '.env.example'), 'utf-8')) ||
          (await fsp.readFile(path.join(ctx.workspacePath, '.env.sample'), 'utf-8'));
      } catch {}

      // 3. Run Phase 3.4 readiness evaluation
      const readinessResult = this.readinessService.analyzeReadiness(
        analysisResult,
        structureResult,
        dockerfileContent,
        envExampleContent,
      );

      const analysisDto: RepositoryAnalysisDto = {
        id: 'plan-preview',
        projectId,
        projectType: analysisResult.projectType,
        primaryLanguage: analysisResult.primaryLanguage,
        framework: analysisResult.framework,
        packageManager: analysisResult.packageManager,
        isMonorepo: analysisResult.isMonorepo,
        hasDockerfile: analysisResult.hasDockerfile,
        hasDockerCompose: analysisResult.hasDockerCompose,
        hasEnvExample: analysisResult.hasEnvExample,
        detectedFiles: analysisResult.detectedFiles,
        structure: structureResult,
        readiness: readinessResult,
        analysisVersion: '2.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 4. Generate deployment plan
      return this.planService.generatePlan(
        analysisDto,
        structureResult,
        readinessResult,
        dockerfileContent,
      );
    });
  }

  /**
   * Executes deployment with the full lifecycle and state machine.
   */
  async deploy(userId: string, projectId: string, environmentId?: string): Promise<DeploymentDto> {
    return this.deployWithVersion(userId, projectId, { environmentId });
  }

  /**
   * Executes deployment with immutable version metadata, environment isolation, and trigger context.
   */
  async deployWithVersion(
    userId: string,
    projectId: string,
    options?: DeployVersionOptions,
  ): Promise<DeploymentDto> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Check for concurrent active deployments on the same project
    const activeDeployment = await this.prisma.deployment.findFirst({
      where: {
        projectId,
        status: { in: ['PENDING', 'VALIDATING', 'BUILDING', 'STARTING', 'HEALTH_CHECKING'] },
      },
    });

    if (activeDeployment) {
      throw new ConflictException('A deployment is currently in progress for this project.');
    }

    // Resolve sequential deployment number
    const lastDep = await this.prisma.deployment.findFirst({
      where: { projectId },
      orderBy: { deploymentNumber: 'desc' },
    });
    const deploymentNumber = (lastDep?.deploymentNumber ?? 0) + 1;

    // Resolve environment
    let environmentId = options?.environmentId;
    if (environmentId) {
      const env = await this.prisma.environment.findFirst({
        where: { id: environmentId },
      });
      if (!env) {
        throw new NotFoundException(`Environment '${environmentId}' not found.`);
      }
      if (env.projectId !== projectId) {
        throw new BadRequestException(
          `Environment '${environmentId}' does not belong to project '${projectId}'.`,
        );
      }
    } else {
      await this.environmentService.ensureDefaultEnvironments(projectId);
      const defaultEnv =
        (await this.prisma.environment.findFirst({
          where: { projectId, name: 'production' },
        })) ||
        (await this.prisma.environment.findFirst({
          where: { projectId },
        }));
      environmentId = defaultEnv?.id;
    }

    // Acquire plan
    let plan: DeploymentPlan;
    if (options?.reusePlan) {
      plan = options.reusePlan;
    } else {
      let analysisResult: any;
      let structureResult: ApplicationStructureDto;
      let readinessResult: DeploymentReadinessDto;
      let dockerfileContent: string | null = null;
      let envExampleContent: string | null = null;

      await this.sourceService.withRepositorySource(userId, projectId, async (ctx) => {
        analysisResult = await this.analyzerService.analyzeWorkspace(ctx.workspacePath);
        structureResult = await this.structureService.detectStructure(ctx.workspacePath);

        try {
          dockerfileContent = await fsp.readFile(path.join(ctx.workspacePath, 'Dockerfile'), 'utf-8');
        } catch {}
        try {
          envExampleContent =
            (await fsp.readFile(path.join(ctx.workspacePath, '.env.example'), 'utf-8')) ||
            (await fsp.readFile(path.join(ctx.workspacePath, '.env.sample'), 'utf-8'));
        } catch {}

        readinessResult = this.readinessService.analyzeReadiness(
          analysisResult,
          structureResult,
          dockerfileContent,
          envExampleContent,
        );

        const analysisDto: RepositoryAnalysisDto = {
          id: 'deploy-analysis',
          projectId,
          projectType: analysisResult.projectType,
          primaryLanguage: analysisResult.primaryLanguage,
          framework: analysisResult.framework,
          packageManager: analysisResult.packageManager,
          isMonorepo: analysisResult.isMonorepo,
          hasDockerfile: analysisResult.hasDockerfile,
          hasDockerCompose: analysisResult.hasDockerCompose,
          hasEnvExample: analysisResult.hasEnvExample,
          detectedFiles: analysisResult.detectedFiles,
          structure: structureResult,
          readiness: readinessResult,
          analysisVersion: '2.0.0',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        plan = this.planService.generatePlan(analysisDto, structureResult, readinessResult, dockerfileContent);
      });
    }

    if (!plan!.canDeploy) {
      throw new BadRequestException(
        `Project cannot be deployed. Blockers: ${plan!.blockers.map((b) => b.message).join('; ') || plan!.summary}`,
      );
    }

    // Resolve commit & branch
    const branch = options?.branch || project.defaultBranch || 'main';
    const commitSha = options?.commitSha || 'c' + Date.now().toString(16).substring(0, 7);
    const buildId = `build-${Date.now().toString(16)}`;

    // Decrypt environment variables for container execution
    const decryptedEnvVars = environmentId
      ? await this.environmentService.getDecryptedVariablesForExecution(environmentId)
      : {};

    // Preflight validation: verify required environment variables are configured
    if (plan!.requiredEnvVars && plan!.requiredEnvVars.length > 0) {
      const missingVars = plan!.requiredEnvVars.filter(
        (v) => !decryptedEnvVars[v] || decryptedEnvVars[v].trim() === '',
      );
      if (missingVars.length > 0) {
        throw new BadRequestException(
          `Missing required environment variable: ${missingVars.join(', ')}. Please configure it in the project environment settings before deploying.`,
        );
      }
    }

    /**
     * Concurrency-safe deploymentNumber allocation.
     *
     * Strategy: read the current max for this project, attempt to insert max+1.
     * If a concurrent request wins the race and claims that number first (DB
     * throws a P2002 unique-constraint violation on [projectId, deploymentNumber]),
     * re-read the max and retry — up to 5 attempts. The @@unique constraint is
     * the authoritative safety net; this loop ensures fast convergence.
     */
    let deploymentRecord: any;
    const MAX_NUMBER_RETRIES = 5;
    for (let attempt = 1; attempt <= MAX_NUMBER_RETRIES; attempt++) {
      const lastDep = await this.prisma.deployment.findFirst({
        where: { projectId },
        orderBy: { deploymentNumber: 'desc' },
        select: { deploymentNumber: true },
      });
      const deploymentNumber = (lastDep?.deploymentNumber ?? 0) + 1;
      const configurationVersion = `v${deploymentNumber}`;

      try {
        deploymentRecord = await this.prisma.deployment.create({
          data: {
            projectId,
            userId,
            status: 'PENDING',
            strategy: plan!.strategy,
            exposedPort: plan!.exposedPort,
            plan: plan! as any,
            logs: [] as any,
            deploymentNumber,
            commitSha,
            commitMessage: options?.commitMessage || null,
            branch,
            environmentId: environmentId || null,
            configurationVersion,
            buildId,
            triggerType: options?.triggerType || 'MANUAL',
            triggeredBy: options?.triggeredBy || 'Manual Web UI',
            previousDeploymentId: options?.previousDeploymentId || null,
            rollbackTargetId: options?.rollbackTargetId || null,
            isRollback: Boolean(options?.isRollback),
          },
          include: {
            environment: true,
          },
        });
        break; // Success — unique number allocated
      } catch (err: any) {
        // Prisma unique constraint violation code is P2002
        const isUniqueViolation =
          err?.code === 'P2002' &&
          (err?.meta?.target as string[] | undefined)?.some((f) =>
            f.includes('deployment_number'),
          );
        if (isUniqueViolation && attempt < MAX_NUMBER_RETRIES) {
          this.logger.warn(
            `deploymentNumber collision for project ${projectId} (attempt ${attempt}/${MAX_NUMBER_RETRIES}) — retrying`,
          );
          continue;
        }
        throw err; // Non-collision error or exhausted retries
      }
    }

    if (!deploymentRecord) {
      throw new ConflictException(
        `Failed to allocate a unique deployment number for project ${projectId} after ${MAX_NUMBER_RETRIES} attempts.`,
      );
    }

    // Start background execution of deployment
    this.executeDeploymentPipeline(deploymentRecord.id, userId, projectId, plan!, decryptedEnvVars);

    return this.mapDeploymentDto(deploymentRecord);
  }

  /**
   * Internal pipeline executing the deployment stages.
   */
  public async executeDeploymentPipeline(
    deploymentId: string,
    userId: string,
    projectId: string,
    plan: DeploymentPlan,
    envVars?: Record<string, string>,
  ): Promise<void> {
    const logs: DeploymentLogEntry[] = [];
    const abortController = new AbortController();

    const shortId = deploymentId.substring(0, 8);
    const imageTag = `cloudpilot-${projectId.substring(0, 8)}-${shortId}:latest`.toLowerCase().replace(/[^a-z0-9_.-]/g, '');
    const containerName = `cp-app-${projectId.substring(0, 8)}-${shortId}`.toLowerCase().replace(/[^a-z0-9_.-]/g, '');

    this.activeDeployments.set(deploymentId, {
      abortController,
      containerName,
      imageTag,
    });

    const appendLog = async (level: 'INFO' | 'WARN' | 'ERROR', message: string, stage: string) => {
      const entry: DeploymentLogEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        stage,
      };
      logs.push(entry);

      // Keep logs bounded to 500 entries in DB
      if (logs.length > 500) {
        logs.shift();
      }

      await this.prisma.deployment.update({
        where: { id: deploymentId },
        data: { logs: logs as any },
      }).catch(() => {});
    };

    const startTime = Date.now();

    try {
      // 1. Stage: VALIDATING
      await this.updateDeploymentStatus(deploymentId, 'VALIDATING', { startedAt: new Date() });
      await appendLog('INFO', `Starting deployment for strategy ${plan.strategy}`, 'VALIDATING');

      // Check if Docker is available
      const dockerAvailable = await this.dockerService.isDockerAvailable();
      if (!dockerAvailable) {
        throw new Error('Docker daemon is not reachable on the host system.');
      }

      // 2. Acquire Source & Execute Build inside Isolated Workspace
      await this.sourceService.withRepositorySource(userId, projectId, async (ctx) => {
        if (abortController.signal.aborted) {
          throw new Error('Deployment cancelled by user');
        }

        // If Dockerfile was generated by CloudPilot, write it to the ephemeral workspace
        if (plan.dockerfileStrategy === 'GENERATED' && plan.generatedDockerfile) {
          const generatedDockerfilePath = path.join(ctx.workspacePath, 'Dockerfile');
          await fsp.writeFile(generatedDockerfilePath, plan.generatedDockerfile, 'utf-8');
          await appendLog('INFO', 'Generated CloudPilot multi-stage Dockerfile applied.', 'VALIDATING');
        }

        // 3. Stage: BUILDING
        await this.updateDeploymentStatus(deploymentId, 'BUILDING');
        await appendLog('INFO', `Building Docker image: ${imageTag}`, 'BUILDING');

        const buildResult = await this.dockerService.buildImage({
          workspacePath: ctx.workspacePath,
          imageTag,
          signal: abortController.signal,
          onLog: (entry) => {
            logs.push(entry);
          },
        });

        if (!buildResult.success) {
          throw new Error(buildResult.error || 'Docker image build failed');
        }

        await this.prisma.deployment.update({
          where: { id: deploymentId },
          data: {
            imageTag,
            buildDurationMs: buildResult.durationMs,
            buildSummary: `Image ${imageTag} built in ${buildResult.durationMs}ms`,
          },
        });

        // 4. Stage: STARTING
        await this.updateDeploymentStatus(deploymentId, 'STARTING');
        await appendLog('INFO', `Allocating port and starting container: ${containerName}`, 'STARTING');

        const hostPort = plan.exposedPort ? await this.dockerService.findAvailablePort(11000) : 0;
        const containerPort = plan.exposedPort || 80;

        const runResult = await this.dockerService.runContainer({
          imageTag,
          containerName,
          hostPort,
          containerPort,
          envVars,
          signal: abortController.signal,
          onLog: (entry) => {
            logs.push(entry);
          },
        });

        if (!runResult.success) {
          throw new Error(runResult.error || 'Failed to start container');
        }

        // 5. Stage: HEALTH_CHECKING
        await this.updateDeploymentStatus(deploymentId, 'HEALTH_CHECKING', {
          containerName,
          hostPort: hostPort || null,
        });
        await appendLog('INFO', `Verifying deployment health (${plan.healthCheckStrategy})...`, 'HEALTH_CHECKING');

        let isHealthy = false;
        if (plan.healthCheckStrategy === 'HTTP' && hostPort) {
          isHealthy = await this.dockerService.checkHttpHealth(
            hostPort,
            plan.healthCheckPath || '/',
            30000,
            1000,
            abortController.signal,
          );
        } else if (plan.healthCheckStrategy === 'PROCESS') {
          isHealthy = await this.dockerService.isContainerRunning(containerName);
        } else {
          isHealthy = true;
        }

        const totalDurationMs = Date.now() - startTime;

        if (!isHealthy) {
          throw new Error('Application health check failed or timed out after container start.');
        }

        // 6. Stage: RUNNING
        const url = hostPort ? `http://localhost:${hostPort}` : null;
        await this.updateDeploymentStatus(deploymentId, 'RUNNING', {
          healthStatus: 'HEALTHY',
          completedAt: new Date(),
          runtimeDurationMs: totalDurationMs,
          url,
          runtimeSummary: `Application running on port ${hostPort}`,
        });

        await appendLog('INFO', `Deployment successful! Application is running at ${url || 'background worker'}`, 'RUNNING');
      });
    } catch (err: any) {
      const isCancelled = abortController.signal.aborted || err.message?.includes('cancelled');
      const finalStatus: DeploymentStatus = isCancelled ? 'CANCELLED' : 'FAILED';
      const healthStatus: DeploymentHealthStatus = 'UNHEALTHY';

      this.logger.error(`Deployment ${deploymentId} failed: ${err.message}`);

      // 1. Collect container diagnostics BEFORE stopping/removing the container
      let diagnosticMessage = '';
      if (containerName) {
        try {
          const diagnostics = await this.dockerService.getContainerDiagnostics(containerName);
          if (diagnostics) {
            await appendLog(
              'WARN',
              `Container State: running=${diagnostics.running}, exitCode=${diagnostics.exitCode}, OOMKilled=${diagnostics.oomKilled}`,
              finalStatus,
            );

            if (diagnostics.logs) {
              await appendLog('ERROR', `Container Runtime Output:\n${diagnostics.logs}`, finalStatus);
            }

            if (diagnostics.sanitizedRuntimeError) {
              diagnosticMessage = diagnostics.sanitizedRuntimeError;
            } else if (diagnostics.exitCode !== null && diagnostics.exitCode !== 0) {
              diagnosticMessage = `Process exited with code ${diagnostics.exitCode}`;
            }
          }
        } catch (diagErr: any) {
          this.logger.warn(`Failed to collect diagnostics for ${containerName}: ${diagErr.message}`);
        }
      }

      // 2. Build sanitized error message
      let finalErrorMessage = this.dockerService.sanitizeLog(err.message || 'Deployment failed');
      if (diagnosticMessage && !finalErrorMessage.includes(diagnosticMessage)) {
        finalErrorMessage = `Application failed during startup: ${diagnosticMessage}. See deployment logs for details.`;
      }

      await appendLog('ERROR', `Deployment error: ${finalErrorMessage}`, finalStatus);

      // 3. Clean up running container and failed build image AFTER diagnostics
      if (containerName) {
        await this.dockerService.stopAndRemoveContainer(containerName).catch(() => {});
      }
      if (imageTag && finalStatus === 'FAILED') {
        await this.dockerService.removeImage(imageTag).catch(() => {});
      }

      await this.updateDeploymentStatus(deploymentId, finalStatus, {
        healthStatus,
        completedAt: new Date(),
        errorMessage: finalErrorMessage,
      }).catch(() => {});

      // 4. Evaluate automatic rollback policy if enabled on this environment
      if (finalStatus === 'FAILED') {
        await this.rollbackService.evaluateAutoRollback(deploymentId).catch(() => {});
      }
    } finally {
      this.activeDeployments.delete(deploymentId);
    }
  }

  /**
   * Cancels an active deployment.
   */
  async cancelDeployment(userId: string, projectId: string, deploymentId: string): Promise<DeploymentDto> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const deployment = await this.prisma.deployment.findFirst({
      where: { id: deploymentId, projectId, userId },
    });

    if (!deployment) {
      throw new NotFoundException('Deployment not found');
    }

    const activeHandle = this.activeDeployments.get(deploymentId);
    if (activeHandle) {
      activeHandle.abortController.abort();
      if (activeHandle.containerName) {
        await this.dockerService.stopAndRemoveContainer(activeHandle.containerName).catch(() => {});
      }
      this.activeDeployments.delete(deploymentId);
    } else if (deployment.containerName) {
      await this.dockerService.stopAndRemoveContainer(deployment.containerName).catch(() => {});
    }

    const updated = await this.prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        status: 'CANCELLED',
        healthStatus: 'UNHEALTHY',
        completedAt: new Date(),
        errorMessage: 'Deployment was cancelled by the user.',
      },
      include: {
        environment: true,
      },
    });

    return this.mapDeploymentDto(updated);
  }

  /**
   * Lists all deployments for a project (ordered newest first).
   */
  async getDeployments(userId: string, projectId: string): Promise<DeploymentDto[]> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const deployments = await this.prisma.deployment.findMany({
      where: { projectId, userId },
      include: {
        environment: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return deployments.map((d) => this.mapDeploymentDto(d));
  }

  /**
   * Retrieves a single deployment by ID.
   */
  async getDeployment(userId: string, projectId: string, deploymentId: string): Promise<DeploymentDto> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const deployment = await this.prisma.deployment.findFirst({
      where: { id: deploymentId, projectId, userId },
      include: {
        environment: true,
      },
    });

    if (!deployment) {
      throw new NotFoundException('Deployment not found');
    }

    return this.mapDeploymentDto(deployment);
  }

  /**
   * Retrieves sanitized logs for a deployment.
   */
  async getDeploymentLogs(
    userId: string,
    projectId: string,
    deploymentId: string,
  ): Promise<DeploymentLogsResponse> {
    const deployment = await this.getDeployment(userId, projectId, deploymentId);
    return {
      deploymentId: deployment.id,
      status: deployment.status,
      logs: deployment.logs || [],
    };
  }

  private async updateDeploymentStatus(
    id: string,
    status: DeploymentStatus,
    extraData: Record<string, any> = {},
  ): Promise<void> {
    await this.prisma.deployment.update({
      where: { id },
      data: {
        status,
        ...extraData,
      },
    });
  }

  private mapDeploymentDto(raw: any): DeploymentDto {
    return {
      id: raw.id,
      projectId: raw.projectId,
      userId: raw.userId,
      status: raw.status as DeploymentStatus,
      strategy: raw.strategy,
      imageTag: raw.imageTag || null,
      containerName: raw.containerName || null,
      exposedPort: raw.exposedPort || null,
      hostPort: raw.hostPort || null,
      url: raw.url || null,
      healthStatus: (raw.healthStatus as DeploymentHealthStatus) || 'UNKNOWN',
      startedAt: raw.startedAt instanceof Date ? raw.startedAt.toISOString() : raw.startedAt || null,
      completedAt: raw.completedAt instanceof Date ? raw.completedAt.toISOString() : raw.completedAt || null,
      buildDurationMs: raw.buildDurationMs ?? null,
      runtimeDurationMs: raw.runtimeDurationMs ?? null,
      buildSummary: raw.buildSummary || null,
      runtimeSummary: raw.runtimeSummary || null,
      errorMessage: raw.errorMessage || null,
      plan: raw.plan || null,
      logs: Array.isArray(raw.logs) ? raw.logs : null,
      deploymentNumber: raw.deploymentNumber ?? null,
      commitSha: raw.commitSha || null,
      commitMessage: raw.commitMessage || null,
      branch: raw.branch || null,
      environmentId: raw.environmentId || null,
      environmentName: raw.environment?.name || null,
      configurationVersion: raw.configurationVersion || '1.0.0',
      buildId: raw.buildId || null,
      triggerType: raw.triggerType || 'MANUAL',
      triggeredBy: raw.triggeredBy || null,
      previousDeploymentId: raw.previousDeploymentId || null,
      rollbackTargetId: raw.rollbackTargetId || null,
      isRollback: Boolean(raw.isRollback),
      canRollback: raw.status === 'RUNNING' || raw.status === 'FAILED',
      createdAt: raw.createdAt instanceof Date ? raw.createdAt.toISOString() : String(raw.createdAt),
      updatedAt: raw.updatedAt instanceof Date ? raw.updatedAt.toISOString() : String(raw.updatedAt),
    };
  }
}

