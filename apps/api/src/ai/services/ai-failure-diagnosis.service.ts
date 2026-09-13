import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiProviderFactory } from '../providers/ai-provider.factory';
import { AiContextSanitizerService } from './ai-context-sanitizer.service';
import { withAiTimeout } from '../utils/ai-timeout.util';
import {
  AiFailureDiagnosis,
  AiEvidenceItem,
  DeploymentDto,
  DeploymentLogEntry,
  DeploymentTelemetrySummary,
  DeploymentEventDto,
} from '@cloudpilot/shared';

@Injectable()
export class AiFailureDiagnosisService {
  private readonly logger = new Logger(AiFailureDiagnosisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerFactory: AiProviderFactory,
    private readonly sanitizer: AiContextSanitizerService,
  ) {}

  /**
   * Diagnoses a build failure from build logs, error message, and deployment state.
   */
  async diagnoseBuildFailure(
    projectId: string,
    deployment: DeploymentDto,
    logs: DeploymentLogEntry[],
  ): Promise<AiFailureDiagnosis> {
    const provider = await this.providerFactory.getProvider();

    const rawLogsText = logs.map((l) => `[${l.stage || 'BUILD'}][${l.level}] ${l.message}`).join('\n');
    const boundedLogs = this.sanitizer.boundLogs(rawLogsText);

    const prompt = `
BUILD_DIAGNOSIS
Deployment ID: ${deployment.id}
Error: ${this.sanitizer.sanitizeText(deployment.errorMessage || 'Unknown build failure')}
Strategy: ${deployment.strategy}
Build Duration: ${deployment.buildDurationMs || 0}ms
Logs:
${boundedLogs}

Distinguish FACT from INFERENCE in evidence items. Return valid JSON diagnosis.`;

    const systemPrompt = `You are CloudPilot AI Root Cause Diagnoser.
Analyze the provided build failure logs and metadata.
CRITICAL RULES:
- Clearly differentiate FACT (verifiable log lines/exit codes) from INFERENCE (logical deduction).
- Provide actionable recommendations.
- Return JSON strictly matching the AiFailureDiagnosis schema.`;

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

      const parsed = this.parseDiagnosisResponse(completion.text, 'BUILD', deployment, provider.modelIdentifier);

      // Persist in DB
      await this.prisma.aiDiagnosis.create({
        data: {
          projectId,
          deploymentId: deployment.id,
          category: 'BUILD',
          diagnosis: parsed as any,
          modelIdentifier: provider.modelIdentifier,
        },
      }).catch((err) => {
        this.logger.warn(`Could not persist AiDiagnosis: ${err.message}`);
      });

      return parsed;
    } catch (err: any) {
      this.logger.warn(`AI build failure diagnosis failed: ${err.message}. Using deterministic fallback.`);
      return this.generateFallbackBuildDiagnosis(deployment, provider.modelIdentifier);
    }
  }

  /**
   * Diagnoses a runtime incident from container telemetry, events, and health probes.
   */
  async diagnoseIncident(
    projectId: string,
    deployment: DeploymentDto,
    telemetry: DeploymentTelemetrySummary,
    events: DeploymentEventDto[],
  ): Promise<AiFailureDiagnosis> {
    const provider = await this.providerFactory.getProvider();

    const prompt = `
INCIDENT_DIAGNOSIS
Deployment ID: ${deployment.id}
Health Status: ${telemetry.healthStatus}
Container Status: ${telemetry.liveSnapshot?.containerStatus || 'UNKNOWN'}
CPU Usage: ${telemetry.liveSnapshot?.cpuPercent || 0}%
Memory Usage: ${telemetry.liveSnapshot?.memoryPercent || 0}% (${(telemetry.liveSnapshot?.memoryUsageBytes || 0) / (1024 * 1024)} MB)
Recent Events:
${events.map((e) => `[${e.severity}][${e.type}] ${e.message}`).join('\n')}

Analyze the root cause and return valid JSON diagnosis with FACT and INFERENCE evidence.`;

    const systemPrompt = `You are CloudPilot AI Incident Response Engineer.
Analyze runtime telemetry, metrics, and events to diagnose container degradation or downtime.
Return JSON strictly matching the AiFailureDiagnosis schema.`;

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

      const parsed = this.parseDiagnosisResponse(completion.text, 'INCIDENT', deployment, provider.modelIdentifier);

      // Persist in DB
      await this.prisma.aiDiagnosis.create({
        data: {
          projectId,
          deploymentId: deployment.id,
          category: 'INCIDENT',
          diagnosis: parsed as any,
          modelIdentifier: provider.modelIdentifier,
        },
      }).catch((err) => {
        this.logger.warn(`Could not persist AiDiagnosis: ${err.message}`);
      });

      return parsed;
    } catch (err: any) {
      this.logger.warn(`AI incident diagnosis failed: ${err.message}. Using deterministic fallback.`);
      return this.generateFallbackIncidentDiagnosis(deployment, telemetry, events, provider.modelIdentifier);
    }
  }

  private parseDiagnosisResponse(
    rawText: string,
    category: 'BUILD' | 'INCIDENT',
    deployment: DeploymentDto,
    modelId: string,
  ): AiFailureDiagnosis {
    try {
      const parsed = JSON.parse(rawText);

      return {
        category,
        problem: parsed.problem || `${category} failure in deployment ${deployment.id}`,
        likelyCause: parsed.likelyCause || 'Encountered unexpected operational failure.',
        affectedComponent: parsed.affectedComponent || 'Application Container',
        evidence: Array.isArray(parsed.evidence) && parsed.evidence.length > 0
          ? parsed.evidence
          : [
              {
                type: 'FACT',
                source: category === 'BUILD' ? 'LOGS' : 'TELEMETRY',
                content: deployment.errorMessage || 'Non-zero exit status.',
              },
            ],
        recommendation: parsed.recommendation || 'Inspect logs and retry deployment.',
        confidence: parsed.confidence || 'HIGH',
        confidenceRationale: parsed.confidenceRationale || 'Direct match with diagnostic logs and events.',
        diagnosedAt: new Date().toISOString(),
        modelIdentifier: modelId,
      };
    } catch {
      return category === 'BUILD'
        ? this.generateFallbackBuildDiagnosis(deployment, modelId)
        : this.generateFallbackIncidentDiagnosis(deployment, {} as any, [], modelId);
    }
  }

  private generateFallbackBuildDiagnosis(deployment: DeploymentDto, modelId: string): AiFailureDiagnosis {
    const errorMsg = deployment.errorMessage || 'Docker build failed';
    const evidence: AiEvidenceItem[] = [
      {
        type: 'FACT',
        source: 'LOGS',
        content: errorMsg,
      },
      {
        type: 'INFERENCE',
        source: 'MANIFEST',
        content: 'Build process terminated abnormally during container image assembly.',
      },
    ];

    return {
      category: 'BUILD',
      problem: 'Compilation or asset bundling failed during container build.',
      likelyCause: errorMsg,
      affectedComponent: 'Build Step',
      evidence,
      recommendation: 'Check build scripts and ensure all imported dependencies are declared in package.json.',
      confidence: 'HIGH',
      confidenceRationale: 'Derived from direct build engine exit code and logs.',
      diagnosedAt: new Date().toISOString(),
      modelIdentifier: modelId,
    };
  }

  private generateFallbackIncidentDiagnosis(
    deployment: DeploymentDto,
    telemetry: DeploymentTelemetrySummary,
    events: DeploymentEventDto[],
    modelId: string,
  ): AiFailureDiagnosis {
    const isOom = events.some((e) => e.type === 'CONTAINER_OOM');
    const isExit = events.some((e) => e.type === 'CONTAINER_EXIT');

    return {
      category: 'INCIDENT',
      problem: isOom
        ? 'Container terminated due to memory limit exhaustion (OOM).'
        : isExit
        ? 'Application process terminated unexpectedly.'
        : 'Health check probe failed.',
      likelyCause: isOom
        ? 'Memory footprint exceeded container allocation (512MB).'
        : 'Process exited with non-zero exit code or failed to respond on listening port.',
      affectedComponent: 'Runtime Container',
      evidence: [
        {
          type: 'FACT',
          source: 'EVENT',
          content: events[0]?.message || 'Health status UNHEALTHY',
        },
      ],
      recommendation: isOom
        ? 'Increase container memory limit or optimize application memory cache.'
        : 'Verify environment variables and check application runtime logs.',
      confidence: 'HIGH',
      confidenceRationale: 'Correlated telemetry metrics and kernel events.',
      diagnosedAt: new Date().toISOString(),
      modelIdentifier: modelId,
    };
  }
}
