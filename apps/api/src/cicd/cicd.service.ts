import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../security/crypto.service';
import { EnvironmentService } from './services/environment.service';
import { RollbackService } from './services/rollback.service';
import {
  EnvironmentDto,
  EnvironmentVariableDto,
  CreateEnvironmentRequest,
  UpdateEnvironmentRequest,
  SetEnvironmentVariableRequest,
  RollbackRequest,
  RollbackResponse,
  CicdSettingsDto,
  UpdateCicdSettingsRequest,
  GithubWebhookEventDto,
} from '@cloudpilot/shared';

@Injectable()
export class CicdService {
  private readonly logger = new Logger(CicdService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly envService: EnvironmentService,
    private readonly rollbackService: RollbackService,
  ) {}

  // Environment Delegations
  async getEnvironments(userId: string, projectId: string): Promise<EnvironmentDto[]> {
    return this.envService.getEnvironments(userId, projectId);
  }

  async getEnvironment(userId: string, projectId: string, environmentId: string): Promise<EnvironmentDto> {
    return this.envService.getEnvironment(userId, projectId, environmentId);
  }

  async createEnvironment(
    userId: string,
    projectId: string,
    dto: CreateEnvironmentRequest,
  ): Promise<EnvironmentDto> {
    return this.envService.createEnvironment(userId, projectId, dto);
  }

  async updateEnvironment(
    userId: string,
    projectId: string,
    environmentId: string,
    dto: UpdateEnvironmentRequest,
  ): Promise<EnvironmentDto> {
    return this.envService.updateEnvironment(userId, projectId, environmentId, dto);
  }

  async deleteEnvironment(userId: string, projectId: string, environmentId: string): Promise<void> {
    return this.envService.deleteEnvironment(userId, projectId, environmentId);
  }

  // Variable Delegations
  async getEnvironmentVariables(
    userId: string,
    projectId: string,
    environmentId: string,
  ): Promise<EnvironmentVariableDto[]> {
    return this.envService.getEnvironmentVariables(userId, projectId, environmentId);
  }

  async setEnvironmentVariable(
    userId: string,
    projectId: string,
    environmentId: string,
    dto: SetEnvironmentVariableRequest,
  ): Promise<EnvironmentVariableDto> {
    return this.envService.setEnvironmentVariable(userId, projectId, environmentId, dto);
  }

  async deleteEnvironmentVariable(
    userId: string,
    projectId: string,
    environmentId: string,
    variableId: string,
  ): Promise<void> {
    return this.envService.deleteEnvironmentVariable(userId, projectId, environmentId, variableId);
  }

  // Rollback Delegation
  async rollbackDeployment(
    userId: string,
    projectId: string,
    deploymentId: string,
    request?: RollbackRequest,
  ): Promise<RollbackResponse> {
    return this.rollbackService.rollbackDeployment(userId, projectId, deploymentId, request);
  }

  // CI/CD Settings & Webhooks
  async getCicdSettings(userId: string, projectId: string): Promise<CicdSettingsDto> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return {
      webhookUrl: `/webhooks/github`,
      webhookSecretConfigured: Boolean(project.webhookSecret),
      defaultBranch: project.defaultBranch,
    };
  }

  async updateCicdSettings(
    userId: string,
    projectId: string,
    dto: UpdateCicdSettingsRequest,
  ): Promise<CicdSettingsDto> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    let encryptedSecret: string | null = null;
    if (dto.webhookSecret) {
      encryptedSecret = this.crypto.encrypt(dto.webhookSecret);
    }

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(encryptedSecret ? { webhookSecret: encryptedSecret } : {}),
      },
    });

    return {
      webhookUrl: `/webhooks/github`,
      webhookSecretConfigured: Boolean(updated.webhookSecret),
      defaultBranch: updated.defaultBranch,
    };
  }

  async getWebhookEvents(userId: string, projectId: string, limit = 20): Promise<GithubWebhookEventDto[]> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const events = await this.prisma.githubWebhookEvent.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(100, Math.max(1, limit)),
    });

    return events.map((e) => ({
      id: e.id,
      deliveryId: e.deliveryId,
      projectId: e.projectId,
      event: e.event,
      sender: e.sender,
      ref: e.ref,
      commitSha: e.commitSha,
      status: e.status as any,
      reason: e.reason,
      deploymentId: e.deploymentId,
      createdAt: e.createdAt.toISOString(),
    }));
  }
}
