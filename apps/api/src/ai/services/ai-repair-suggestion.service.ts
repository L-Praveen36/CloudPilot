import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiProviderFactory } from '../providers/ai-provider.factory';
import { AiContextSanitizerService } from './ai-context-sanitizer.service';
import { withAiTimeout } from '../utils/ai-timeout.util';
import {
  AiRepairSuggestion,
  AiFailureDiagnosis,
  AiEvidenceItem,
  DeploymentDto,
} from '@cloudpilot/shared';

@Injectable()
export class AiRepairSuggestionService {
  private readonly logger = new Logger(AiRepairSuggestionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerFactory: AiProviderFactory,
    private readonly sanitizer: AiContextSanitizerService,
  ) {}

  /**
   * Generates structured repair suggestions based on a diagnosis.
   */
  async generateSuggestions(
    projectId: string,
    deployment: DeploymentDto,
    diagnosis: AiFailureDiagnosis,
  ): Promise<AiRepairSuggestion[]> {
    const provider = await this.providerFactory.getProvider();

    const prompt = `
REPAIR_SUGGESTIONS
Problem: ${diagnosis.problem}
Likely Cause: ${diagnosis.likelyCause}
Category: ${diagnosis.category}
Recommendation: ${diagnosis.recommendation}
Generate structured repair suggestion requiring human approval. Return JSON.`;

    const systemPrompt = `You are CloudPilot AI Remediation Advisor.
Formulate a structured repair suggestion with clear risk assessment.
CRITICAL RULES:
- Human approval is ALWAYS required.
- Do NOT propose autonomous or dangerous destructive changes.
- Provide clear diffPreview and validationRequirements.`;

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
      const suggestion = await this.persistSuggestion(projectId, deployment.id, parsed, diagnosis.evidence, provider.modelIdentifier);
      return [suggestion];
    } catch (err: any) {
      this.logger.warn(`AI repair suggestion generation failed: ${err.message}. Using fallback suggestion.`);
      const fallback = await this.generateFallbackSuggestion(projectId, deployment, diagnosis, provider.modelIdentifier);
      return [fallback];
    }
  }

  /**
   * Retrieves active repair suggestions for a project or deployment.
   */
  async getSuggestions(projectId: string, deploymentId?: string): Promise<AiRepairSuggestion[]> {
    const records = await this.prisma.aiRepairSuggestion.findMany({
      where: {
        projectId,
        ...(deploymentId ? { deploymentId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return records.map((r) => this.mapRecordToDto(r));
  }

  /**
   * Human approval transition: marks suggestion as APPROVED.
   */
  async approveSuggestion(projectId: string, suggestionId: string): Promise<AiRepairSuggestion> {
    const existing = await this.prisma.aiRepairSuggestion.findFirst({
      where: { id: suggestionId, projectId },
    });

    if (!existing) {
      throw new NotFoundException('Repair suggestion not found');
    }

    if (existing.status !== 'PROPOSED') {
      throw new BadRequestException(`Cannot approve suggestion in '${existing.status}' status.`);
    }

    const updated = await this.prisma.aiRepairSuggestion.update({
      where: { id: suggestionId },
      data: { status: 'APPROVED' },
    });

    return this.mapRecordToDto(updated);
  }

  /**
   * Human rejection transition: marks suggestion as REJECTED.
   */
  async rejectSuggestion(projectId: string, suggestionId: string): Promise<AiRepairSuggestion> {
    const existing = await this.prisma.aiRepairSuggestion.findFirst({
      where: { id: suggestionId, projectId },
    });

    if (!existing) {
      throw new NotFoundException('Repair suggestion not found');
    }

    if (existing.status !== 'PROPOSED') {
      throw new BadRequestException(`Cannot reject suggestion in '${existing.status}' status.`);
    }

    const updated = await this.prisma.aiRepairSuggestion.update({
      where: { id: suggestionId },
      data: { status: 'REJECTED' },
    });

    return this.mapRecordToDto(updated);
  }

  private async persistSuggestion(
    projectId: string,
    deploymentId: string,
    parsed: any,
    evidence: AiEvidenceItem[],
    modelId: string,
  ): Promise<AiRepairSuggestion> {
    const created = await this.prisma.aiRepairSuggestion.create({
      data: {
        projectId,
        deploymentId,
        title: parsed.title || 'Recommended Configuration Adjustment',
        problem: parsed.problem || 'Identified deployment operational issue',
        proposedChange: parsed.proposedChange || {
          type: 'ENVIRONMENT_VARIABLE',
          target: '.env',
          content: 'PORT=3000',
          diffPreview: '+ PORT=3000',
        },
        reasoning: parsed.reasoning || 'Aligns deployment configuration with application expectations.',
        risk: (parsed.risk as any) || 'LOW',
        requiresHumanApproval: true,
        status: 'PROPOSED',
        evidence: evidence as any,
        confidence: parsed.confidence || 'HIGH',
        validationRequirements: Array.isArray(parsed.validationRequirements)
          ? parsed.validationRequirements
          : ['Validate configuration syntax', 'Run deployment plan test'],
        modelIdentifier: modelId,
      },
    });

    return this.mapRecordToDto(created);
  }

  private async generateFallbackSuggestion(
    projectId: string,
    deployment: DeploymentDto,
    diagnosis: AiFailureDiagnosis,
    modelId: string,
  ): Promise<AiRepairSuggestion> {
    const isBuild = diagnosis.category === 'BUILD';

    const created = await this.prisma.aiRepairSuggestion.create({
      data: {
        projectId,
        deploymentId: deployment.id,
        title: isBuild ? 'Update build script dependencies' : 'Configure production environment and resource limits',
        problem: diagnosis.problem,
        proposedChange: isBuild
          ? {
              type: 'BUILD_COMMAND',
              target: 'package.json',
              content: 'npm run build',
              diffPreview: '+ "build": "next build"',
            }
          : {
              type: 'ENVIRONMENT_VARIABLE',
              target: '.env',
              content: 'PORT=3000\nNODE_ENV=production',
              diffPreview: '+ PORT=3000\n+ NODE_ENV=production',
            },
        reasoning: diagnosis.recommendation,
        risk: 'LOW',
        requiresHumanApproval: true,
        status: 'PROPOSED',
        evidence: diagnosis.evidence as any,
        confidence: 'HIGH',
        validationRequirements: [
          'Verify package.json scripts format.',
          'Execute deterministic deployment plan dry-run.',
        ],
        modelIdentifier: modelId,
      },
    });

    return this.mapRecordToDto(created);
  }

  private mapRecordToDto(r: any): AiRepairSuggestion {
    return {
      id: r.id,
      projectId: r.projectId,
      deploymentId: r.deploymentId || undefined,
      title: r.title,
      problem: r.problem,
      proposedChange: r.proposedChange as any,
      reasoning: r.reasoning,
      risk: r.risk as any,
      requiresHumanApproval: r.requiresHumanApproval,
      status: r.status as any,
      evidence: Array.isArray(r.evidence) ? (r.evidence as any) : [],
      confidence: r.confidence as any,
      validationRequirements: r.validationRequirements || [],
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt),
      modelIdentifier: r.modelIdentifier,
    };
  }
}
