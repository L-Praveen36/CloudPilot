import { Injectable, Logger } from '@nestjs/common';
import { AiProviderFactory } from '../providers/ai-provider.factory';
import { AiContextSanitizerService } from './ai-context-sanitizer.service';
import { withAiTimeout } from '../utils/ai-timeout.util';
import {
  RepositoryAnalysisDto,
  ApplicationStructureDto,
  DeploymentReadinessDto,
  AiDeploymentProposal,
} from '@cloudpilot/shared';

@Injectable()
export class AiDeploymentGeneratorService {
  private readonly logger = new Logger(AiDeploymentGeneratorService.name);

  constructor(
    private readonly providerFactory: AiProviderFactory,
    private readonly sanitizer: AiContextSanitizerService,
  ) {}

  /**
   * Generates an AI-assisted deployment configuration proposal with strict deterministic validation.
   */
  async generateProposal(
    analysis: RepositoryAnalysisDto,
    structure?: ApplicationStructureDto | null,
    readiness?: DeploymentReadinessDto | null,
  ): Promise<AiDeploymentProposal> {
    const provider = await this.providerFactory.getProvider();

    const prompt = this.buildPrompt(analysis, structure, readiness);
    const systemPrompt = `You are CloudPilot AI Deployment Engineer.
Generate an optimal, production-grade Dockerfile and deployment parameters for the repository.
SECURITY RULES:
- Never use privileged commands or root escalation.
- Never mount host Docker socket or host paths.
- Bind strictly to unprivileged ports.
- Use multi-stage builds.
- Return a valid JSON object.`;

    try {
      const timeoutMs = parseInt(process.env.AI_SYNTHESIS_TIMEOUT_MS ?? '30000', 10);
      const completion = await withAiTimeout(
        provider.complete(prompt, {
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

      const parsed = JSON.parse(completion.text);
      const dockerfile = parsed.suggestedDockerfile || this.generateDefaultDockerfile(analysis);

      // Validate proposed Dockerfile with strict deterministic security rules
      const validation = this.validateDockerfileSecurity(dockerfile);

      const mainApp = structure?.applications?.[0];
      const defaultBuild = structure?.topLevelBuildCommand?.command || mainApp?.buildCommand?.command || 'npm run build';
      const defaultStart = structure?.topLevelStartCommand?.command || mainApp?.startCommand?.command || 'npm start';
      const defaultPort = structure?.topLevelPort?.port || mainApp?.port?.port || 3000;

      return {
        strategy: analysis.framework ? `NODE_${analysis.framework.toUpperCase()}` : 'NODE_GENERIC',
        suggestedDockerfile: dockerfile,
        dockerfileExplanation: parsed.dockerfileExplanation || 'Optimized multi-stage container configuration.',
        buildCommand: parsed.buildCommand || defaultBuild,
        startCommand: parsed.startCommand || defaultStart,
        exposedPort: parsed.exposedPort || defaultPort,
        healthCheckPath: parsed.healthCheckPath || '/',
        healthCheckStrategy: parsed.healthCheckStrategy || 'HTTP',
        requiredEnvVars: Array.isArray(parsed.requiredEnvVars) ? parsed.requiredEnvVars : ['PORT', 'NODE_ENV'],
        validation,
        confidence: 'HIGH',
        modelIdentifier: provider.modelIdentifier,
        proposedAt: new Date().toISOString(),
      };
    } catch (err: any) {
      this.logger.warn(`AI deployment proposal failed: ${err.message}. Using deterministic fallback.`);
      const defaultDockerfile = this.generateDefaultDockerfile(analysis);
      const mainApp = structure?.applications?.[0];
      const defaultBuild = structure?.topLevelBuildCommand?.command || mainApp?.buildCommand?.command || 'npm run build';
      const defaultStart = structure?.topLevelStartCommand?.command || mainApp?.startCommand?.command || 'npm start';
      const defaultPort = structure?.topLevelPort?.port || mainApp?.port?.port || 3000;

      return {
        strategy: 'NODE_GENERIC',
        suggestedDockerfile: defaultDockerfile,
        dockerfileExplanation: 'Deterministic fallback multi-stage Dockerfile.',
        buildCommand: defaultBuild,
        startCommand: defaultStart,
        exposedPort: defaultPort,
        healthCheckPath: '/',
        healthCheckStrategy: 'HTTP',
        requiredEnvVars: ['PORT', 'NODE_ENV'],
        validation: this.validateDockerfileSecurity(defaultDockerfile),
        confidence: 'HIGH',
        modelIdentifier: provider.modelIdentifier,
        proposedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Deterministic static Dockerfile security validation.
   */
  public validateDockerfileSecurity(dockerfile: string): {
    isValid: boolean;
    issues: string[];
    securityPassed: boolean;
  } {
    const issues: string[] = [];

    if (!dockerfile || !dockerfile.includes('FROM')) {
      issues.push('Missing base image FROM instruction');
    }

    // Security check: privileged constructs
    if (dockerfile.includes('--privileged') || dockerfile.includes('docker.sock')) {
      issues.push('Dangerous Docker socket or privileged container access detected.');
    }

    // Security check: curl bash piping
    if (/curl.*\|\s*sh/i.test(dockerfile) || /wget.*\|\s*sh/i.test(dockerfile)) {
      issues.push('Insecure remote shell pipe execution (curl | sh) is forbidden.');
    }

    // Security check: host root mount
    if (dockerfile.includes('VOLUME /') || dockerfile.includes('ADD / /')) {
      issues.push('Forbidden host root filesystem reference.');
    }

    const securityPassed = issues.length === 0;

    return {
      isValid: issues.length === 0,
      issues,
      securityPassed,
    };
  }

  private buildPrompt(
    analysis: RepositoryAnalysisDto,
    structure?: ApplicationStructureDto | null,
    readiness?: DeploymentReadinessDto | null,
  ): string {
    const mainApp = structure?.applications?.[0];
    const defaultBuild = structure?.topLevelBuildCommand?.command || mainApp?.buildCommand?.command || 'npm run build';
    const defaultStart = structure?.topLevelStartCommand?.command || mainApp?.startCommand?.command || 'npm start';
    const defaultPort = structure?.topLevelPort?.port || mainApp?.port?.port || 3000;

    return this.sanitizer.sanitizeText(`
DEPLOYMENT_PROPOSAL
Language: ${analysis.primaryLanguage}
Framework: ${analysis.framework}
Package Manager: ${analysis.packageManager}
Port: ${defaultPort}
Build Command: ${defaultBuild}
Start Command: ${defaultStart}
Readiness Strategy: ${readiness?.strategy || 'DOCKER'}
Generate Deployment Configuration in JSON.
`);
  }

  private generateDefaultDockerfile(analysis: RepositoryAnalysisDto): string {
    const pm = analysis.packageManager || 'npm';
    const installCmd = pm === 'pnpm' ? 'pnpm install --frozen-lockfile' : pm === 'yarn' ? 'yarn install --frozen-lockfile' : 'npm ci';

    return `FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN ${installCmd}
COPY . .
RUN npm run build --if-present

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=builder /app ./
EXPOSE 3000
CMD ["npm", "start"]`;
  }
}
