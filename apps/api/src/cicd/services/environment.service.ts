import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../../security/crypto.service';
import {
  EnvironmentDto,
  EnvironmentVariableDto,
  CreateEnvironmentRequest,
  UpdateEnvironmentRequest,
  SetEnvironmentVariableRequest,
  EnvironmentType,
} from '@cloudpilot/shared';

@Injectable()
export class EnvironmentService {
  private readonly logger = new Logger(EnvironmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  /**
   * Ensures default environments (development, staging, production) exist for a project.
   */
  async ensureDefaultEnvironments(projectId: string): Promise<void> {
    const existing = await this.prisma.environment.findMany({
      where: { projectId },
    });

    if (existing.length === 0) {
      const defaults: Array<{ name: string; type: EnvironmentType; branchPattern: string; autoDeploy: boolean }> = [
        { name: 'development', type: 'DEVELOPMENT', branchPattern: 'develop', autoDeploy: false },
        { name: 'staging', type: 'STAGING', branchPattern: 'staging', autoDeploy: false },
        { name: 'production', type: 'PRODUCTION', branchPattern: 'main', autoDeploy: false },
      ];

      for (const d of defaults) {
        await this.prisma.environment.create({
          data: {
            projectId,
            name: d.name,
            type: d.type,
            branchPattern: d.branchPattern,
            autoDeployEnabled: d.autoDeploy,
            autoRollbackEnabled: false,
            maxRollbackAttempts: 1,
          },
        }).catch(() => {});
      }
    }
  }

  /**
   * Lists all environments for a project with variable counts.
   */
  async getEnvironments(userId: string, projectId: string): Promise<EnvironmentDto[]> {
    await this.verifyProjectOwnership(userId, projectId);
    await this.ensureDefaultEnvironments(projectId);

    const envs = await this.prisma.environment.findMany({
      where: { projectId },
      include: {
        _count: {
          select: { variables: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return envs.map((e) => this.mapEnvironmentToDto(e, e._count.variables));
  }

  /**
   * Gets a single environment by ID.
   */
  async getEnvironment(userId: string, projectId: string, environmentId: string): Promise<EnvironmentDto> {
    await this.verifyProjectOwnership(userId, projectId);

    const env = await this.prisma.environment.findFirst({
      where: { id: environmentId, projectId },
      include: {
        _count: {
          select: { variables: true },
        },
      },
    });

    if (!env) {
      throw new NotFoundException('Environment not found');
    }

    return this.mapEnvironmentToDto(env, env._count.variables);
  }

  /**
   * Creates a new environment for a project.
   */
  async createEnvironment(
    userId: string,
    projectId: string,
    dto: CreateEnvironmentRequest,
  ): Promise<EnvironmentDto> {
    await this.verifyProjectOwnership(userId, projectId);

    const cleanName = (dto.name || '').trim().toLowerCase();
    if (!cleanName || !/^[a-z0-9-_]+$/.test(cleanName)) {
      throw new BadRequestException('Environment name must contain only lowercase letters, numbers, hyphens, and underscores.');
    }

    const existing = await this.prisma.environment.findFirst({
      where: { projectId, name: cleanName },
    });

    if (existing) {
      throw new ConflictException(`Environment '${cleanName}' already exists in this project.`);
    }

    const created = await this.prisma.environment.create({
      data: {
        projectId,
        name: cleanName,
        type: dto.type || (cleanName.includes('prod') ? 'PRODUCTION' : cleanName.includes('stag') ? 'STAGING' : cleanName.includes('prev') ? 'PREVIEW' : cleanName.includes('cust') ? 'CUSTOM' : 'DEVELOPMENT'),
        branchPattern: dto.branchPattern || (cleanName === 'production' ? 'main' : cleanName === 'staging' ? 'staging' : cleanName.includes('prev') ? 'preview/*' : 'develop'),
        autoDeployEnabled: Boolean(dto.autoDeployEnabled),
        autoRollbackEnabled: Boolean(dto.autoRollbackEnabled),
        maxRollbackAttempts: dto.maxRollbackAttempts ?? 1,
      },
      include: {
        _count: {
          select: { variables: true },
        },
      },
    });

    return this.mapEnvironmentToDto(created, created._count.variables);
  }

  /**
   * Updates an environment's branch pattern or CI/CD policies.
   */
  async updateEnvironment(
    userId: string,
    projectId: string,
    environmentId: string,
    dto: UpdateEnvironmentRequest,
  ): Promise<EnvironmentDto> {
    await this.verifyProjectOwnership(userId, projectId);

    const existing = await this.prisma.environment.findFirst({
      where: { id: environmentId, projectId },
    });

    if (!existing) {
      throw new NotFoundException('Environment not found');
    }

    let cleanName: string | undefined;
    if (dto.name) {
      cleanName = dto.name.trim().toLowerCase();
      if (!/^[a-z0-9-_]+$/.test(cleanName)) {
        throw new BadRequestException('Environment name must contain only lowercase letters, numbers, hyphens, and underscores.');
      }
    }

    const updated = await this.prisma.environment.update({
      where: { id: environmentId },
      data: {
        ...(cleanName ? { name: cleanName } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.branchPattern !== undefined ? { branchPattern: dto.branchPattern.trim() } : {}),
        ...(dto.autoDeployEnabled !== undefined ? { autoDeployEnabled: Boolean(dto.autoDeployEnabled) } : {}),
        ...(dto.autoRollbackEnabled !== undefined ? { autoRollbackEnabled: Boolean(dto.autoRollbackEnabled) } : {}),
        ...(dto.maxRollbackAttempts !== undefined ? { maxRollbackAttempts: dto.maxRollbackAttempts } : {}),
      },
      include: {
        _count: {
          select: { variables: true },
        },
      },
    });

    return this.mapEnvironmentToDto(updated, updated._count.variables);
  }

  /**
   * Deletes a custom environment.
   */
  async deleteEnvironment(userId: string, projectId: string, environmentId: string): Promise<void> {
    await this.verifyProjectOwnership(userId, projectId);

    const env = await this.prisma.environment.findFirst({
      where: { id: environmentId, projectId },
    });

    if (!env) {
      throw new NotFoundException('Environment not found');
    }

    await this.prisma.environment.delete({
      where: { id: environmentId },
    });
  }

  /**
   * Lists variables for an environment (all secret values are masked/redacted).
   */
  async getEnvironmentVariables(
    userId: string,
    projectId: string,
    environmentId: string,
  ): Promise<EnvironmentVariableDto[]> {
    await this.verifyProjectOwnership(userId, projectId);

    const env = await this.prisma.environment.findFirst({
      where: { id: environmentId, projectId },
    });

    if (!env) {
      throw new NotFoundException('Environment not found');
    }

    const vars = await this.prisma.environmentVariable.findMany({
      where: { environmentId },
      orderBy: { key: 'asc' },
    });

    return vars.map((v) => ({
      id: v.id,
      environmentId: v.environmentId,
      key: v.key,
      isSecret: v.isSecret,
      isConfigured: true,
      maskedValue: v.isSecret ? '••••••••' : this.decryptSafely(v.encryptedValue),
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
    }));
  }

  /**
   * Creates or updates an encrypted environment variable.
   */
  async setEnvironmentVariable(
    userId: string,
    projectId: string,
    environmentId: string,
    dto: SetEnvironmentVariableRequest,
  ): Promise<EnvironmentVariableDto> {
    await this.verifyProjectOwnership(userId, projectId);

    const env = await this.prisma.environment.findFirst({
      where: { id: environmentId, projectId },
    });

    if (!env) {
      throw new NotFoundException('Environment not found');
    }

    const cleanKey = (dto.key || '').trim().toUpperCase();
    if (!cleanKey || !/^[A-Z_][A-Z0-9_]*$/.test(cleanKey)) {
      throw new BadRequestException('Environment variable key must be uppercase alphanumeric with underscores (e.g., DATABASE_URL).');
    }

    const encryptedValue = this.crypto.encrypt(dto.value || '');
    const isSecret = dto.isSecret !== false; // Default true

    const saved = await this.prisma.environmentVariable.upsert({
      where: {
        environmentId_key: {
          environmentId,
          key: cleanKey,
        },
      },
      update: {
        encryptedValue,
        isSecret,
      },
      create: {
        environmentId,
        key: cleanKey,
        encryptedValue,
        isSecret,
      },
    });

    return {
      id: saved.id,
      environmentId: saved.environmentId,
      key: saved.key,
      isSecret: saved.isSecret,
      isConfigured: true,
      maskedValue: saved.isSecret ? '••••••••' : dto.value,
      createdAt: saved.createdAt.toISOString(),
      updatedAt: saved.updatedAt.toISOString(),
    };
  }

  /**
   * Deletes an environment variable.
   */
  async deleteEnvironmentVariable(
    userId: string,
    projectId: string,
    environmentId: string,
    variableId: string,
  ): Promise<void> {
    await this.verifyProjectOwnership(userId, projectId);

    const variable = await this.prisma.environmentVariable.findFirst({
      where: { id: variableId, environmentId },
      include: { environment: true },
    });

    if (!variable || variable.environment.projectId !== projectId) {
      throw new NotFoundException('Environment variable not found');
    }

    await this.prisma.environmentVariable.delete({
      where: { id: variableId },
    });
  }

  /**
   * Decrypts all variables for an environment for internal container execution only.
   * NEVER exposed to frontend or external API callers.
   */
  async getDecryptedVariablesForExecution(environmentId: string): Promise<Record<string, string>> {
    const vars = await this.prisma.environmentVariable.findMany({
      where: { environmentId },
    });

    const result: Record<string, string> = {};
    for (const v of vars) {
      try {
        result[v.key] = this.crypto.decrypt(v.encryptedValue);
      } catch (err: any) {
        this.logger.error(`Failed to decrypt variable ${v.key}: ${err.message}`);
      }
    }

    return result;
  }

  private decryptSafely(ciphertext: string): string {
    try {
      return this.crypto.decrypt(ciphertext);
    } catch {
      return '••••••••';
    }
  }

  private async verifyProjectOwnership(userId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  private mapEnvironmentToDto(env: any, variablesCount = 0): EnvironmentDto {
    return {
      id: env.id,
      projectId: env.projectId,
      name: env.name,
      type: env.type,
      branchPattern: env.branchPattern,
      autoDeployEnabled: env.autoDeployEnabled,
      autoRollbackEnabled: env.autoRollbackEnabled,
      maxRollbackAttempts: env.maxRollbackAttempts,
      variablesCount,
      createdAt: env.createdAt instanceof Date ? env.createdAt.toISOString() : String(env.createdAt),
      updatedAt: env.updatedAt instanceof Date ? env.updatedAt.toISOString() : String(env.updatedAt),
    };
  }
}
