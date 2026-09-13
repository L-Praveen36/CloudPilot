import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as path from 'path';
import * as fsp from 'fs/promises';
import { PrismaService } from '../prisma/prisma.service';
import { GitHubRepositoryService } from '../github/github-repository.service';
import { RepositoryAnalyzerService } from './services/repository-analyzer.service';
import { RepositorySourceService, SourceAcquisitionMetadata } from './services/repository-source.service';
import { ApplicationStructureService } from './services/application-structure.service';
import { DeploymentReadinessService } from './services/deployment-readiness.service';
import {
  RepositoryAnalysisDto,
  ApplicationStructureDto,
  DeploymentReadinessDto,
} from '@cloudpilot/shared';

@Injectable()
export class RepositoryIntelligenceService {
  private readonly logger = new Logger(RepositoryIntelligenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly githubRepoService: GitHubRepositoryService,
    private readonly analyzerService: RepositoryAnalyzerService,
    private readonly structureService: ApplicationStructureService,
    private readonly readinessService: DeploymentReadinessService,
    private readonly sourceService: RepositorySourceService,
  ) {}

  /**
   * Phase 3.2, 3.3, 3.4 — Integrated Static Repository Intelligence Analysis
   *
   * 1. Validates project ownership.
   * 2. Acquires source code into a temporary isolated workspace using RepositorySourceService.withRepositorySource().
   * 3. Executes deterministic static analysis via RepositoryAnalyzerService.analyzeWorkspace().
   * 4. Executes structure detection via ApplicationStructureService.detectStructure().
   * 5. Evaluates deployment readiness via DeploymentReadinessService.analyzeReadiness().
   * 6. Persists the combined analysis result in PostgreSQL (analysisVersion: '2.0.0').
   * 7. Cleans up the temporary workspace in finally (handled by withRepositorySource).
   */
  async analyzeProject(userId: string, projectId: string): Promise<RepositoryAnalysisDto> {
    // 1. Verify Project Ownership
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        userId,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    this.logger.log(
      `Starting integrated static repository analysis for ${project.repositoryFullName} (Project ID: ${projectId})`,
    );

    // 2. Execute within secure temporary workspace lifecycle
    return this.sourceService.withRepositorySource(userId, projectId, async (ctx) => {
      // 3. Perform deterministic stack analysis on local workspace (Phase 3.2)
      const analysisResult = await this.analyzerService.analyzeWorkspace(ctx.workspacePath);

      // 4. Perform deterministic structure detection (Phase 3.3)
      const structureResult = await this.structureService.detectStructure(ctx.workspacePath);

      // Safe reads for Dockerfile and .env.example if present (max 1MB)
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

      // 5. Perform deployment readiness analysis (Phase 3.4)
      const readinessResult = this.readinessService.analyzeReadiness(
        analysisResult,
        structureResult,
        dockerfileContent,
        envExampleContent,
      );

      // 6. Persist combined RepositoryAnalysis in PostgreSQL (1:1 per project, version 2.0.0)
      const analysis = await this.prisma.repositoryAnalysis.upsert({
        where: { projectId },
        create: {
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
          structure: structureResult as any,
          readiness: readinessResult as any,
          analysisVersion: '2.0.0',
        },
        update: {
          projectType: analysisResult.projectType,
          primaryLanguage: analysisResult.primaryLanguage,
          framework: analysisResult.framework,
          packageManager: analysisResult.packageManager,
          isMonorepo: analysisResult.isMonorepo,
          hasDockerfile: analysisResult.hasDockerfile,
          hasDockerCompose: analysisResult.hasDockerCompose,
          hasEnvExample: analysisResult.hasEnvExample,
          detectedFiles: analysisResult.detectedFiles,
          structure: structureResult as any,
          readiness: readinessResult as any,
          analysisVersion: '2.0.0',
        },
      });

      this.logger.log(
        `Analysis complete for ${project.repositoryFullName}: ${analysis.projectType} (Readiness: ${readinessResult.status}, Score: ${readinessResult.score})`,
      );

      return this.mapAnalysisDto(analysis);
    });
  }

  /**
   * Phase 3.4 — Deployment Readiness Analysis Endpoint
   */
  async analyzeProjectReadiness(
    userId: string,
    projectId: string,
  ): Promise<DeploymentReadinessDto> {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        userId,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    this.logger.log(
      `Starting Phase 3.4 Deployment Readiness Analysis for ${project.repositoryFullName} (Project ID: ${projectId})`,
    );

    return this.sourceService.withRepositorySource(userId, projectId, async (ctx) => {
      const analysisResult = await this.analyzerService.analyzeWorkspace(ctx.workspacePath);
      const structureResult = await this.structureService.detectStructure(ctx.workspacePath);

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

      const readiness = this.readinessService.analyzeReadiness(
        analysisResult,
        structureResult,
        dockerfileContent,
        envExampleContent,
      );

      // Persist readiness
      await this.prisma.repositoryAnalysis.upsert({
        where: { projectId },
        create: {
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
          structure: structureResult as any,
          readiness: readiness as any,
          analysisVersion: '2.0.0',
        },
        update: {
          readiness: readiness as any,
        },
      });

      return readiness;
    });
  }

  /**
   * Retrieves the stored Deployment Readiness for a project.
   */
  async getProjectReadiness(userId: string, projectId: string): Promise<DeploymentReadinessDto> {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        userId,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const analysis = await this.prisma.repositoryAnalysis.findUnique({
      where: { projectId },
    });

    if (!analysis || !analysis.readiness) {
      throw new NotFoundException('Deployment readiness not found for this project');
    }

    return analysis.readiness as unknown as DeploymentReadinessDto;
  }

  /**
   * Phase 3.3 — Application Structure Detection
   */
  async detectApplicationStructure(
    userId: string,
    projectId: string,
  ): Promise<ApplicationStructureDto> {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        userId,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    this.logger.log(
      `Starting Phase 3.3 Application Structure Detection for ${project.repositoryFullName} (Project ID: ${projectId})`,
    );

    return this.sourceService.withRepositorySource(userId, projectId, async (ctx) => {
      const structure = await this.structureService.detectStructure(ctx.workspacePath);

      await this.prisma.repositoryAnalysis.upsert({
        where: { projectId },
        create: {
          projectId,
          projectType: 'UNKNOWN',
          detectedFiles: [],
          structure: structure as any,
          analysisVersion: '2.0.0',
        },
        update: {
          structure: structure as any,
        },
      });

      return structure;
    });
  }

  /**
   * Retrieves the stored Application Structure for a project.
   */
  async getProjectStructure(userId: string, projectId: string): Promise<ApplicationStructureDto> {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        userId,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const analysis = await this.prisma.repositoryAnalysis.findUnique({
      where: { projectId },
    });

    if (!analysis || !analysis.structure) {
      throw new NotFoundException('Application structure not found for this project');
    }

    return analysis.structure as unknown as ApplicationStructureDto;
  }

  /**
   * Retrieves the latest stored static analysis for a project.
   */
  async getProjectAnalysis(userId: string, projectId: string): Promise<RepositoryAnalysisDto> {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        userId,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const analysis = await this.prisma.repositoryAnalysis.findUnique({
      where: { projectId },
    });

    if (!analysis) {
      throw new NotFoundException('Repository analysis not found for this project');
    }

    return this.mapAnalysisDto(analysis);
  }

  /**
   * Phase 3.1 — Repository Source Acquisition Endpoint Helper
   */
  async acquireProjectSource(userId: string, projectId: string): Promise<SourceAcquisitionMetadata> {
    return this.sourceService.withRepositorySource(userId, projectId, async (ctx) => {
      this.logger.log(
        `Source acquisition complete: ${ctx.repositoryFullName}@${ctx.branch} — ${ctx.fileCount} files`,
      );

      return {
        repositoryFullName: ctx.repositoryFullName,
        branch: ctx.branch,
        commitSha: ctx.commitSha,
        fileCount: ctx.fileCount,
      } satisfies SourceAcquisitionMetadata;
    });
  }

  /**
   * Transforms raw Prisma analysis record into sanitized RepositoryAnalysisDto.
   */
  private mapAnalysisDto(raw: any): RepositoryAnalysisDto {
    return {
      id: raw.id,
      projectId: raw.projectId,
      projectType: raw.projectType,
      primaryLanguage: raw.primaryLanguage,
      framework: raw.framework,
      packageManager: raw.packageManager,
      isMonorepo: raw.isMonorepo,
      hasDockerfile: Boolean(raw.hasDockerfile),
      hasDockerCompose: Boolean(raw.hasDockerCompose),
      hasEnvExample: Boolean(raw.hasEnvExample),
      detectedFiles: Array.isArray(raw.detectedFiles) ? raw.detectedFiles : [],
      structure: raw.structure || null,
      readiness: raw.readiness || null,
      analysisVersion: raw.analysisVersion,
      createdAt: raw.createdAt instanceof Date ? raw.createdAt.toISOString() : String(raw.createdAt),
      updatedAt: raw.updatedAt instanceof Date ? raw.updatedAt.toISOString() : String(raw.updatedAt),
    };
  }
}
