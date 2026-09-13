import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiRepoUnderstandingService } from './services/ai-repo-understanding.service';
import { AiDeploymentGeneratorService } from './services/ai-deployment-generator.service';
import { AiFailureDiagnosisService } from './services/ai-failure-diagnosis.service';
import { AiRepairSuggestionService } from './services/ai-repair-suggestion.service';
import { AiAgentService } from './services/ai-agent.service';
import { ObservabilityService } from '../observability/observability.service';
import {
  AiRepositoryUnderstanding,
  AiDeploymentProposal,
  AiFailureDiagnosis,
  AiRepairSuggestion,
  AiAgentRequest,
  AiAgentResponse,
  RepositoryAnalysisDto,
  DeploymentDto,
  DeploymentLogEntry,
} from '@cloudpilot/shared';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly repoUnderstandingService: AiRepoUnderstandingService,
    private readonly deploymentGeneratorService: AiDeploymentGeneratorService,
    private readonly failureDiagnosisService: AiFailureDiagnosisService,
    private readonly repairSuggestionService: AiRepairSuggestionService,
    private readonly agentService: AiAgentService,
    private readonly observabilityService: ObservabilityService,
  ) {}

  /**
   * Understands repository architecture and tech stack with AI.
   */
  async getRepositoryUnderstanding(
    userId: string,
    projectId: string,
  ): Promise<AiRepositoryUnderstanding> {
    const project = await this.verifyProjectOwnership(userId, projectId);

    const rawAnalysis = await this.prisma.repositoryAnalysis.findUnique({
      where: { projectId },
    });

    if (!rawAnalysis) {
      throw new NotFoundException('Repository analysis not found. Run analysis first.');
    }

    const analysisDto: RepositoryAnalysisDto = {
      id: rawAnalysis.id,
      projectId: rawAnalysis.projectId,
      projectType: rawAnalysis.projectType as any,
      primaryLanguage: rawAnalysis.primaryLanguage,
      framework: rawAnalysis.framework,
      packageManager: rawAnalysis.packageManager,
      isMonorepo: rawAnalysis.isMonorepo,
      hasDockerfile: rawAnalysis.hasDockerfile,
      hasDockerCompose: rawAnalysis.hasDockerCompose,
      hasEnvExample: rawAnalysis.hasEnvExample,
      detectedFiles: rawAnalysis.detectedFiles,
      structure: rawAnalysis.structure as any,
      readiness: rawAnalysis.readiness as any,
      analysisVersion: rawAnalysis.analysisVersion,
      createdAt: rawAnalysis.createdAt.toISOString(),
      updatedAt: rawAnalysis.updatedAt.toISOString(),
    };

    return this.repoUnderstandingService.generateUnderstanding(
      projectId,
      analysisDto,
      rawAnalysis.structure as any,
      rawAnalysis.readiness as any,
      project.repositoryName,
    );
  }

  /**
   * Generates AI deployment proposal and validates Dockerfile security.
   */
  async getDeploymentProposal(
    userId: string,
    projectId: string,
  ): Promise<AiDeploymentProposal> {
    await this.verifyProjectOwnership(userId, projectId);

    const rawAnalysis = await this.prisma.repositoryAnalysis.findUnique({
      where: { projectId },
    });

    if (!rawAnalysis) {
      throw new NotFoundException('Repository analysis not found. Run analysis first.');
    }

    const analysisDto: RepositoryAnalysisDto = {
      id: rawAnalysis.id,
      projectId: rawAnalysis.projectId,
      projectType: rawAnalysis.projectType as any,
      primaryLanguage: rawAnalysis.primaryLanguage,
      framework: rawAnalysis.framework,
      packageManager: rawAnalysis.packageManager,
      isMonorepo: rawAnalysis.isMonorepo,
      hasDockerfile: rawAnalysis.hasDockerfile,
      hasDockerCompose: rawAnalysis.hasDockerCompose,
      hasEnvExample: rawAnalysis.hasEnvExample,
      detectedFiles: rawAnalysis.detectedFiles,
      structure: rawAnalysis.structure as any,
      readiness: rawAnalysis.readiness as any,
      analysisVersion: rawAnalysis.analysisVersion,
      createdAt: rawAnalysis.createdAt.toISOString(),
      updatedAt: rawAnalysis.updatedAt.toISOString(),
    };

    return this.deploymentGeneratorService.generateProposal(
      analysisDto,
      rawAnalysis.structure as any,
      rawAnalysis.readiness as any,
    );
  }

  /**
   * Diagnoses a failed build.
   */
  async diagnoseBuildFailure(
    userId: string,
    projectId: string,
    deploymentId: string,
  ): Promise<AiFailureDiagnosis> {
    const deployment = await this.verifyDeploymentOwnership(userId, projectId, deploymentId);
    const logs = (deployment.logs as unknown as DeploymentLogEntry[]) || [];

    const deploymentDto = this.mapDeploymentDto(deployment);
    return this.failureDiagnosisService.diagnoseBuildFailure(projectId, deploymentDto, logs);
  }

  /**
   * Diagnoses a runtime incident.
   */
  async diagnoseIncident(
    userId: string,
    projectId: string,
    deploymentId: string,
  ): Promise<AiFailureDiagnosis> {
    const deployment = await this.verifyDeploymentOwnership(userId, projectId, deploymentId);
    const telemetry = await this.observabilityService.getDeploymentTelemetry(userId, projectId, deploymentId);
    const eventsResponse = await this.observabilityService.getDeploymentEvents(userId, projectId, deploymentId, 20);

    const deploymentDto = this.mapDeploymentDto(deployment);
    return this.failureDiagnosisService.diagnoseIncident(
      projectId,
      deploymentDto,
      telemetry,
      eventsResponse.events,
    );
  }

  /**
   * Generates and retrieves repair suggestions.
   */
  async getRepairSuggestions(
    userId: string,
    projectId: string,
    deploymentId: string,
  ): Promise<AiRepairSuggestion[]> {
    const deployment = await this.verifyDeploymentOwnership(userId, projectId, deploymentId);
    const existing = await this.repairSuggestionService.getSuggestions(projectId, deploymentId);

    if (existing.length > 0) {
      return existing;
    }

    // If no existing suggestions, auto-diagnose and generate
    const diagnosis = deployment.status === 'FAILED'
      ? await this.diagnoseBuildFailure(userId, projectId, deploymentId)
      : await this.diagnoseIncident(userId, projectId, deploymentId);

    const deploymentDto = this.mapDeploymentDto(deployment);
    return this.repairSuggestionService.generateSuggestions(projectId, deploymentDto, diagnosis);
  }

  /**
   * Approves a repair suggestion.
   */
  async approveRepairSuggestion(
    userId: string,
    projectId: string,
    suggestionId: string,
  ): Promise<AiRepairSuggestion> {
    await this.verifyProjectOwnership(userId, projectId);
    return this.repairSuggestionService.approveSuggestion(projectId, suggestionId);
  }

  /**
   * Rejects a repair suggestion.
   */
  async rejectRepairSuggestion(
    userId: string,
    projectId: string,
    suggestionId: string,
  ): Promise<AiRepairSuggestion> {
    await this.verifyProjectOwnership(userId, projectId);
    return this.repairSuggestionService.rejectSuggestion(projectId, suggestionId);
  }

  /**
   * Runs the controlled AI Agent.
   */
  async runAgent(
    userId: string,
    projectId: string,
    request: AiAgentRequest,
  ): Promise<AiAgentResponse> {
    return this.agentService.runAgent(userId, projectId, request);
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

  private async verifyDeploymentOwnership(userId: string, projectId: string, deploymentId: string) {
    await this.verifyProjectOwnership(userId, projectId);

    const deployment = await this.prisma.deployment.findFirst({
      where: { id: deploymentId, projectId, userId },
    });

    if (!deployment) {
      throw new NotFoundException('Deployment not found');
    }

    return deployment;
  }

  private mapDeploymentDto(d: any): DeploymentDto {
    return {
      id: d.id,
      projectId: d.projectId,
      userId: d.userId,
      status: d.status,
      strategy: d.strategy,
      imageTag: d.imageTag,
      containerName: d.containerName,
      exposedPort: d.exposedPort,
      hostPort: d.hostPort,
      url: d.url,
      healthStatus: d.healthStatus,
      startedAt: d.startedAt instanceof Date ? d.startedAt.toISOString() : d.startedAt,
      completedAt: d.completedAt instanceof Date ? d.completedAt.toISOString() : d.completedAt,
      buildDurationMs: d.buildDurationMs,
      runtimeDurationMs: d.runtimeDurationMs,
      buildSummary: d.buildSummary,
      runtimeSummary: d.runtimeSummary,
      errorMessage: d.errorMessage,
      plan: d.plan,
      logs: Array.isArray(d.logs) ? d.logs : null,
      createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : String(d.createdAt),
      updatedAt: d.updatedAt instanceof Date ? d.updatedAt.toISOString() : String(d.updatedAt),
    };
  }
}
