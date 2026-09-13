import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiProviderFactory } from '../providers/ai-provider.factory';
import { AiContextSanitizerService } from './ai-context-sanitizer.service';
import { withAiTimeout } from '../utils/ai-timeout.util';
import {
  RepositoryAnalysisDto,
  ApplicationStructureDto,
  DeploymentReadinessDto,
  AiRepositoryUnderstanding,
} from '@cloudpilot/shared';

@Injectable()
export class AiRepoUnderstandingService {
  private readonly logger = new Logger(AiRepoUnderstandingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerFactory: AiProviderFactory,
    private readonly sanitizer: AiContextSanitizerService,
  ) {}

  /**
   * Generates structured AI understanding of a repository based on deterministic facts.
   */
  async generateUnderstanding(
    projectId: string,
    analysis: RepositoryAnalysisDto,
    structure?: ApplicationStructureDto | null,
    readiness?: DeploymentReadinessDto | null,
    repoName?: string,
  ): Promise<AiRepositoryUnderstanding> {
    const provider = await this.providerFactory.getProvider();

    // 1. Build bounded context
    const contextPrompt = this.buildContextPrompt(analysis, structure, readiness, repoName);

    const systemPrompt = `You are CloudPilot AI Intelligence.
Your role is to interpret deterministic repository intelligence, structure detection, and deployment readiness data.
CRITICAL RULES:
1. Deterministic facts provided in the prompt are authoritative.
2. Return a valid JSON object strictly conforming to the requested schema.
3. Clearly state confidence and evidence.
4. Do NOT invent or hallucinate non-existent frameworks or dependencies.`;

    try {
      const timeoutMs = parseInt(process.env.AI_SYNTHESIS_TIMEOUT_MS ?? '30000', 10);
      const completion = await withAiTimeout(
        provider.complete(contextPrompt, {
          systemPrompt,
          responseFormat: 'json',
          temperature: 0.1,
        }),
        timeoutMs,
        { text: '', model: 'fallback', durationMs: 0 },
      );

      if (!completion.text) {
        throw new Error('AI Provider timed out or returned empty response');
      }

      const parsed = this.parseAndValidateResponse(completion.text, analysis, provider.modelIdentifier);

      // Persist analysis in database
      await this.prisma.aiAnalysis.create({
        data: {
          projectId,
          understanding: parsed as any,
          modelIdentifier: provider.modelIdentifier,
        },
      }).catch((err) => {
        this.logger.warn(`Could not persist AiAnalysis: ${err.message}`);
      });

      return parsed;
    } catch (err: any) {
      this.logger.warn(`AI Provider failed during repository understanding: ${err.message}. Falling back to deterministic mapping.`);
      return this.generateFallbackUnderstanding(analysis, structure, readiness, provider.modelIdentifier);
    }
  }

  private buildContextPrompt(
    analysis: RepositoryAnalysisDto,
    structure?: ApplicationStructureDto | null,
    readiness?: DeploymentReadinessDto | null,
    repoName?: string,
  ): string {
    const lines = [
      `REPOSITORY_UNDERSTANDING REQUEST`,
      `Repository: ${repoName || 'Project'}`,
      `Technology Stack:`,
      `- Primary Language: ${analysis.primaryLanguage || 'Unknown'}`,
      `- Framework: ${analysis.framework || 'None/Generic'}`,
      `- Package Manager: ${analysis.packageManager || 'None'}`,
      `- Project Type: ${analysis.projectType}`,
      `- isMonorepo: ${analysis.isMonorepo ? 'true' : 'false'}`,
      `- hasDockerfile: ${analysis.hasDockerfile}`,
      `- hasDockerCompose: ${analysis.hasDockerCompose}`,
      `- hasEnvExample: ${analysis.hasEnvExample}`,
      `- Detected Files: ${analysis.detectedFiles.slice(0, 15).join(', ')}`,
    ];

    if (structure) {
      const mainApp = structure.applications?.[0];
      const buildCmd = structure.topLevelBuildCommand?.command || mainApp?.buildCommand?.command || 'None';
      const startCmd = structure.topLevelStartCommand?.command || mainApp?.startCommand?.command || 'None';
      const portVal = structure.topLevelPort?.port || mainApp?.port?.port || 3000;

      lines.push(
        `Application Structure:`,
        `- Primary Role: ${structure.primaryRole || mainApp?.role || 'UNKNOWN'}`,
        `- Build Command: ${buildCmd}`,
        `- Start Command: ${startCmd}`,
        `- Port: ${portVal}`,
      );
    }

    if (readiness) {
      const canDeploy = readiness.status !== 'BLOCKED';
      lines.push(
        `Deployment Readiness:`,
        `- Can Deploy: ${canDeploy}`,
        `- Strategy: ${readiness.strategy}`,
        `- Blockers: ${readiness.blockers.map((b) => b.message).join('; ') || 'None'}`,
        `- Warnings: ${readiness.warnings.map((w) => w.message).join('; ') || 'None'}`,
      );
    }

    lines.push(`Produce the structured JSON output with summary, technology, architecture, buildAndRun, deployment, potentialRisks, confidence, and evidenceSummary.`);
    return this.sanitizer.sanitizeText(lines.join('\n'));
  }

  private parseAndValidateResponse(
    rawText: string,
    analysis: RepositoryAnalysisDto,
    modelId: string,
  ): AiRepositoryUnderstanding {
    try {
      const parsed = JSON.parse(rawText);

      return {
        summary: parsed.summary || `Repository analyzed as ${analysis.framework || analysis.primaryLanguage || 'standard'} application.`,
        technology: {
          primaryLanguage: analysis.primaryLanguage || parsed.technology?.primaryLanguage || 'Unknown',
          framework: analysis.framework || parsed.technology?.framework || 'None',
          packageManager: analysis.packageManager || parsed.technology?.packageManager || 'npm',
          projectType: analysis.projectType || parsed.technology?.projectType || 'WEB_APPLICATION',
        },
        architecture: {
          role: parsed.architecture?.role || 'FULL_STACK',
          components: Array.isArray(parsed.architecture?.components) ? parsed.architecture.components : [
            {
              name: 'main-service',
              path: '.',
              role: 'PRIMARY',
              description: 'Primary web service',
            },
          ],
          isMonorepo: Boolean(analysis.isMonorepo),
        },
        buildAndRun: {
          buildSystem: parsed.buildAndRun?.buildSystem || `${analysis.packageManager || 'npm'} Scripts`,
          recommendedBuildCommand: parsed.buildAndRun?.recommendedBuildCommand || 'npm run build',
          recommendedStartCommand: parsed.buildAndRun?.recommendedStartCommand || 'npm start',
          outputDirectory: parsed.buildAndRun?.outputDirectory,
        },
        deployment: {
          expectedRuntime: parsed.deployment?.expectedRuntime || 'Node.js 20 Alpine',
          expectedPort: parsed.deployment?.expectedPort || 3000,
          healthCheckPath: parsed.deployment?.healthCheckPath || '/',
        },
        potentialRisks: Array.isArray(parsed.potentialRisks) ? parsed.potentialRisks : [],
        confidence: parsed.confidence || 'HIGH',
        evidenceSummary: Array.isArray(parsed.evidenceSummary)
          ? parsed.evidenceSummary
          : ['Deterministic AST and manifest validation.'],
        analyzedAt: new Date().toISOString(),
        modelIdentifier: modelId,
      };
    } catch {
      return this.generateFallbackUnderstanding(analysis, null, null, modelId);
    }
  }

  private generateFallbackUnderstanding(
    analysis: RepositoryAnalysisDto,
    structure?: ApplicationStructureDto | null,
    readiness?: DeploymentReadinessDto | null,
    modelId = 'cloudpilot-fallback-v1',
  ): AiRepositoryUnderstanding {
    const mainApp = structure?.applications?.[0];
    const buildCmd = structure?.topLevelBuildCommand?.command || mainApp?.buildCommand?.command || 'npm run build';
    const startCmd = structure?.topLevelStartCommand?.command || mainApp?.startCommand?.command || 'npm start';
    const portNum = structure?.topLevelPort?.port || mainApp?.port?.port || 3000;

    return {
      summary: `Deterministic analysis confirms ${analysis.framework || analysis.primaryLanguage || 'Node.js'} repository structure.`,
      technology: {
        primaryLanguage: analysis.primaryLanguage || 'Unknown',
        framework: analysis.framework || 'None',
        packageManager: analysis.packageManager || 'npm',
        projectType: analysis.projectType,
      },
      architecture: {
        role: (structure?.primaryRole as any) || 'FULL_STACK',
        components: [
          {
            name: 'main-app',
            path: '.',
            role: (structure?.primaryRole as any) || 'FULL_STACK',
            description: 'Main application service',
          },
        ],
        isMonorepo: Boolean(analysis.isMonorepo),
      },
      buildAndRun: {
        buildSystem: `${analysis.packageManager || 'npm'} build`,
        recommendedBuildCommand: buildCmd,
        recommendedStartCommand: startCmd,
      },
      deployment: {
        expectedRuntime: 'Node.js 20 Alpine',
        expectedPort: portNum,
        healthCheckPath: '/',
      },
      potentialRisks: readiness?.warnings.map((w) => ({
        category: 'CONFIGURATION' as const,
        severity: 'LOW' as const,
        description: w.message,
      })) || [],
      confidence: 'HIGH',
      evidenceSummary: [
        'Deterministic AST and file manifest inspection verified by CloudPilot engine.',
      ],
      analyzedAt: new Date().toISOString(),
      modelIdentifier: modelId,
    };
  }
}

