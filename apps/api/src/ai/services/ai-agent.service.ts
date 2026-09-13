import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiProviderFactory } from '../providers/ai-provider.factory';
import { AiContextSanitizerService } from './ai-context-sanitizer.service';
import { ObservabilityLogService } from '../../observability/services/observability-log.service';
import { ContainerTelemetryService } from '../../observability/services/container-telemetry.service';
import { ObservabilityHealthService } from '../../observability/services/observability-health.service';
import { withAiTimeout } from '../utils/ai-timeout.util';
import {
  AiAgentRequest,
  AiAgentResponse,
  AiAgentStep,
  AiAgentToolName,
  AiEvidenceItem,
} from '@cloudpilot/shared';

@Injectable()
export class AiAgentService {
  private readonly logger = new Logger(AiAgentService.name);

  // Hard safety boundaries
  public readonly MAX_ITERATIONS = 5;
  public readonly MAX_TOOL_CALLS = 10;

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerFactory: AiProviderFactory,
    private readonly sanitizer: AiContextSanitizerService,
    private readonly logService: ObservabilityLogService,
    private readonly telemetryService: ContainerTelemetryService,
    private readonly healthService: ObservabilityHealthService,
  ) {}

  /**
   * Executes a controlled, bounded AI Agent loop using authorized CloudPilot tools.
   */
  async runAgent(
    userId: string,
    projectId: string,
    request: AiAgentRequest,
  ): Promise<AiAgentResponse> {
    const project = await this.verifyOwnership(userId, projectId);
    const provider = await this.providerFactory.getProvider();

    const sanitizedPrompt = this.sanitizer.sanitizeUserPrompt(request.prompt);
    const steps: AiAgentStep[] = [];
    const toolsUsed: Set<AiAgentToolName> = new Set();
    const evidenceGathered: AiEvidenceItem[] = [];

    let toolCallsCount = 0;
    let finalAnswer = '';

    // Initial Thought Step: Determine required tools based on query intent
    const promptLower = sanitizedPrompt.toLowerCase();

    // 1. If user is asking about deployment or why it failed
    if (promptLower.includes('fail') || promptLower.includes('deploy') || promptLower.includes('log') || promptLower.includes('error')) {
      const dep = await this.prisma.deployment.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      });

      if (dep) {
        // Tool 1: getDeployment
        const depResult = await this.executeTool('getDeployment', { deploymentId: dep.id }, projectId);
        toolsUsed.add('getDeployment');
        toolCallsCount++;
        steps.push({
          thought: `I need to inspect the latest deployment (${dep.id}) to see its status and failure cause.`,
          toolCall: { tool: 'getDeployment', input: { deploymentId: dep.id } },
          toolResult: depResult,
        });

        // Tool 2: getDeploymentLogs
        if (toolCallsCount < this.MAX_TOOL_CALLS) {
          const logsResult = await this.executeTool('getDeploymentLogs', { deploymentId: dep.id }, projectId);
          toolsUsed.add('getDeploymentLogs');
          toolCallsCount++;
          steps.push({
            thought: 'Inspecting deployment build and execution logs for error traces.',
            toolCall: { tool: 'getDeploymentLogs', input: { deploymentId: dep.id } },
            toolResult: logsResult,
          });

          if (dep.errorMessage) {
            evidenceGathered.push({
              type: 'FACT',
              source: 'LOGS',
              content: `Deployment error: ${dep.errorMessage}`,
            });
          }
        }
      }
    }

    // 2. If user is asking about architecture, stack, or project understanding
    if (promptLower.includes('tech') || promptLower.includes('framework') || promptLower.includes('explain') || promptLower.includes('what is') || steps.length === 0) {
      // Tool 3: getRepositoryAnalysis
      if (toolCallsCount < this.MAX_TOOL_CALLS) {
        const analysisResult = await this.executeTool('getRepositoryAnalysis', {}, projectId);
        toolsUsed.add('getRepositoryAnalysis');
        toolCallsCount++;
        steps.push({
          thought: 'Retrieving deterministic repository analysis facts.',
          toolCall: { tool: 'getRepositoryAnalysis', input: {} },
          toolResult: analysisResult,
        });

        if (analysisResult?.primaryLanguage) {
          evidenceGathered.push({
            type: 'FACT',
            source: 'STRUCTURE',
            content: `Language: ${analysisResult.primaryLanguage}, Framework: ${analysisResult.framework || 'None'}`,
          });
        }
      }

      // Tool 4: getDeploymentReadiness
      if (toolCallsCount < this.MAX_TOOL_CALLS) {
        const readinessResult = await this.executeTool('getDeploymentReadiness', {}, projectId);
        toolsUsed.add('getDeploymentReadiness');
        toolCallsCount++;
        steps.push({
          thought: 'Checking deployment readiness score and blockers.',
          toolCall: { tool: 'getDeploymentReadiness', input: {} },
          toolResult: readinessResult,
        });
      }
    }

    // Synthesize final answer using gathered facts
    const synthesisPrompt = `
Synthesize an answer for the user query using the gathered tool results.
User Query: "${sanitizedPrompt}"
Evidence Gathered:
${evidenceGathered.map((e) => `[${e.type}][${e.source}] ${e.content}`).join('\n')}
Tool Results Summary:
${steps.map((s) => `Tool: ${s.toolCall?.tool}, Result: ${JSON.stringify(s.toolResult).substring(0, 300)}`).join('\n')}

Provide a concise, factual, helpful answer. If evidence is insufficient, state "Insufficient evidence".`;

    try {
      const timeoutMs = parseInt(process.env.AI_SYNTHESIS_TIMEOUT_MS ?? '30000', 10);
      const completion = await withAiTimeout(
        provider.complete(synthesisPrompt, {
          systemPrompt: 'You are CloudPilot AI Assistant. Answer factually based only on verified tool evidence.',
          temperature: 0.2,
        }),
        timeoutMs,
        { text: '', model: 'fallback', durationMs: 0 },
      );

      finalAnswer = completion.text?.trim() || '';
      if (!finalAnswer) {
        finalAnswer = evidenceGathered.length > 0
          ? `Based on CloudPilot diagnostics: ${evidenceGathered.map((e) => e.content).join('. ')}.`
          : 'Insufficient evidence to resolve this query without additional logs.';
      }
    } catch {
      finalAnswer = evidenceGathered.length > 0
        ? `Based on CloudPilot diagnostics: ${evidenceGathered.map((e) => e.content).join('. ')}.`
        : 'Insufficient evidence to resolve this query without additional logs.';
    }

    const response: AiAgentResponse = {
      answer: finalAnswer,
      steps,
      toolsUsed: Array.from(toolsUsed),
      confidence: evidenceGathered.length > 0 ? 'HIGH' : 'MEDIUM',
      evidenceGathered,
      completedAt: new Date().toISOString(),
      modelIdentifier: provider.modelIdentifier,
    };

    // Audit log in database
    await this.prisma.aiAgentInteraction.create({
      data: {
        projectId,
        userId,
        prompt: sanitizedPrompt,
        deploymentId: request.deploymentId || null,
        steps: steps as any,
        answer: finalAnswer,
        toolsUsed: Array.from(toolsUsed),
        confidence: response.confidence,
        evidenceGathered: evidenceGathered as any,
        modelIdentifier: provider.modelIdentifier,
      },
    }).catch((err) => {
      this.logger.warn(`Could not audit AiAgentInteraction: ${err.message}`);
    });

    return response;
  }

  /**
   * Executes a single authorized, read-only CloudPilot tool safely.
   */
  public async executeTool(
    tool: AiAgentToolName,
    input: Record<string, any>,
    projectId: string,
  ): Promise<Record<string, any>> {
    switch (tool) {
      case 'inspectRepository': {
        const proj = await this.prisma.project.findUnique({ where: { id: projectId } });
        return {
          id: proj?.id,
          name: proj?.repositoryName,
          owner: proj?.repositoryOwner,
          defaultBranch: proj?.defaultBranch,
        };
      }
      case 'getRepositoryAnalysis': {
        const analysis = await this.prisma.repositoryAnalysis.findUnique({ where: { projectId } });
        return {
          primaryLanguage: analysis?.primaryLanguage,
          framework: analysis?.framework,
          packageManager: analysis?.packageManager,
          projectType: analysis?.projectType,
          isMonorepo: analysis?.isMonorepo,
          hasDockerfile: analysis?.hasDockerfile,
        };
      }
      case 'getApplicationStructure': {
        const analysis = await this.prisma.repositoryAnalysis.findUnique({ where: { projectId } });
        return (analysis?.structure as any) || { message: 'Structure not yet detected' };
      }
      case 'getDeploymentReadiness': {
        const analysis = await this.prisma.repositoryAnalysis.findUnique({ where: { projectId } });
        return (analysis?.readiness as any) || { canDeploy: true, strategy: 'DOCKER' };
      }
      case 'getDeployment': {
        const dep = await this.prisma.deployment.findFirst({
          where: { id: input.deploymentId, projectId },
        });
        return {
          id: dep?.id,
          status: dep?.status,
          healthStatus: dep?.healthStatus,
          errorMessage: dep?.errorMessage,
          url: dep?.url,
          hostPort: dep?.hostPort,
        };
      }
      case 'getDeploymentLogs': {
        const dep = await this.prisma.deployment.findFirst({
          where: { id: input.deploymentId, projectId },
        });
        const rawLogs = (dep?.logs as any[]) || [];
        return {
          count: rawLogs.length,
          recentLogs: rawLogs.slice(-10).map((l) => `[${l.level}] ${l.message}`),
        };
      }
      case 'getDeploymentEvents': {
        const events = await this.prisma.deploymentEvent.findMany({
          where: { deploymentId: input.deploymentId },
          take: 10,
          orderBy: { timestamp: 'desc' },
        });
        return {
          events: events.map((e) => ({ type: e.type, severity: e.severity, message: e.message })),
        };
      }
      case 'getDeploymentMetrics': {
        const metrics = await this.prisma.deploymentMetric.findMany({
          where: { deploymentId: input.deploymentId },
          take: 5,
          orderBy: { timestamp: 'desc' },
        });
        return {
          metricsCount: metrics.length,
          latest: metrics[0] || null,
        };
      }
      case 'getHealthStatus': {
        const dep = await this.prisma.deployment.findFirst({
          where: { id: input.deploymentId, projectId },
        });
        return {
          status: dep?.status,
          healthStatus: dep?.healthStatus,
        };
      }
      default:
        return { error: 'Unknown tool' };
    }
  }

  private async verifyOwnership(userId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }
}
