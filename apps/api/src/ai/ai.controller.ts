import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AiService } from './ai.service';
import {
  AiRepositoryUnderstandingResponse,
  AiDeploymentProposalResponse,
  AiDiagnosisResponse,
  AiRepairSuggestionsResponse,
  AiRepairSuggestionActionResponse,
  AiAgentRequest,
  AiAgentResponse,
} from '@cloudpilot/shared';

@Throttle({ default: { limit: 10, ttl: 60000 } })
@Controller('projects/:projectId')
@UseGuards(AuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  /**
   * Generates AI repository understanding from deterministic facts.
   * POST /projects/:projectId/ai/understand
   */
  @Post('ai/understand')
  @HttpCode(HttpStatus.OK)
  async getRepositoryUnderstanding(
    @Req() req: any,
    @Param('projectId') projectId: string,
  ): Promise<AiRepositoryUnderstandingResponse> {
    const understanding = await this.aiService.getRepositoryUnderstanding(
      req.user.id,
      projectId,
    );
    return { understanding };
  }

  /**
   * Generates AI deployment proposal with Dockerfile and parameter predictions.
   * POST /projects/:projectId/ai/deployment-proposal
   */
  @Post('ai/deployment-proposal')
  @HttpCode(HttpStatus.OK)
  async getDeploymentProposal(
    @Req() req: any,
    @Param('projectId') projectId: string,
  ): Promise<AiDeploymentProposalResponse> {
    const proposal = await this.aiService.getDeploymentProposal(
      req.user.id,
      projectId,
    );
    return { proposal };
  }

  /**
   * Diagnoses a build failure for a deployment.
   * POST /projects/:projectId/deployments/:deploymentId/ai/diagnose-build
   */
  @Post('deployments/:deploymentId/ai/diagnose-build')
  @HttpCode(HttpStatus.OK)
  async diagnoseBuildFailure(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('deploymentId') deploymentId: string,
  ): Promise<AiDiagnosisResponse> {
    const diagnosis = await this.aiService.diagnoseBuildFailure(
      req.user.id,
      projectId,
      deploymentId,
    );
    return { diagnosis };
  }

  /**
   * Diagnoses a runtime incident for a deployment.
   * POST /projects/:projectId/deployments/:deploymentId/ai/diagnose-incident
   */
  @Post('deployments/:deploymentId/ai/diagnose-incident')
  @HttpCode(HttpStatus.OK)
  async diagnoseIncident(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('deploymentId') deploymentId: string,
  ): Promise<AiDiagnosisResponse> {
    const diagnosis = await this.aiService.diagnoseIncident(
      req.user.id,
      projectId,
      deploymentId,
    );
    return { diagnosis };
  }

  /**
   * Retrieves or generates repair suggestions for a deployment failure.
   * GET /projects/:projectId/deployments/:deploymentId/ai/repair-suggestions
   */
  @Get('deployments/:deploymentId/ai/repair-suggestions')
  async getRepairSuggestions(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('deploymentId') deploymentId: string,
  ): Promise<AiRepairSuggestionsResponse> {
    const suggestions = await this.aiService.getRepairSuggestions(
      req.user.id,
      projectId,
      deploymentId,
    );
    return { suggestions };
  }

  /**
   * Approves an AI repair suggestion (human approval gate).
   * POST /projects/:projectId/ai/repair-suggestions/:suggestionId/approve
   */
  @Post('ai/repair-suggestions/:suggestionId/approve')
  @HttpCode(HttpStatus.OK)
  async approveRepairSuggestion(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('suggestionId') suggestionId: string,
  ): Promise<AiRepairSuggestionActionResponse> {
    const suggestion = await this.aiService.approveRepairSuggestion(
      req.user.id,
      projectId,
      suggestionId,
    );
    return {
      suggestion,
      message: 'Repair suggestion approved by user.',
    };
  }

  /**
   * Rejects an AI repair suggestion.
   * POST /projects/:projectId/ai/repair-suggestions/:suggestionId/reject
   */
  @Post('ai/repair-suggestions/:suggestionId/reject')
  @HttpCode(HttpStatus.OK)
  async rejectRepairSuggestion(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('suggestionId') suggestionId: string,
  ): Promise<AiRepairSuggestionActionResponse> {
    const suggestion = await this.aiService.rejectRepairSuggestion(
      req.user.id,
      projectId,
      suggestionId,
    );
    return {
      suggestion,
      message: 'Repair suggestion rejected by user.',
    };
  }

  /**
   * Runs the bounded AI Agent loop using authorized CloudPilot tools.
   * POST /projects/:projectId/ai/agent
   */
  @Post('ai/agent')
  @HttpCode(HttpStatus.OK)
  async runAgent(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() request: AiAgentRequest,
  ): Promise<AiAgentResponse> {
    return this.aiService.runAgent(req.user.id, projectId, request);
  }
}
