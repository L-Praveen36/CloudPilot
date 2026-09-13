import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CicdService } from './cicd.service';
import {
  EnvironmentListResponse,
  EnvironmentResponse,
  EnvironmentVariablesResponse,
  EnvironmentVariableResponse,
  CreateEnvironmentRequest,
  UpdateEnvironmentRequest,
  SetEnvironmentVariableRequest,
  RollbackRequest,
  RollbackResponse,
  CicdSettingsResponse,
  UpdateCicdSettingsRequest,
  WebhookEventsListResponse,
} from '@cloudpilot/shared';

@Controller('projects/:projectId')
@UseGuards(AuthGuard)
export class CicdController {
  constructor(private readonly cicdService: CicdService) {}

  /**
   * Lists all environments for a project.
   * GET /projects/:projectId/environments
   */
  @Get('environments')
  async getEnvironments(
    @Req() req: any,
    @Param('projectId') projectId: string,
  ): Promise<EnvironmentListResponse> {
    const environments = await this.cicdService.getEnvironments(req.user.id, projectId);
    return { environments };
  }

  /**
   * Creates a new environment.
   * POST /projects/:projectId/environments
   */
  @Post('environments')
  @HttpCode(HttpStatus.CREATED)
  async createEnvironment(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() dto: CreateEnvironmentRequest,
  ): Promise<EnvironmentResponse> {
    const environment = await this.cicdService.createEnvironment(req.user.id, projectId, dto);
    return { environment };
  }

  /**
   * Gets a single environment.
   * GET /projects/:projectId/environments/:environmentId
   */
  @Get('environments/:environmentId')
  async getEnvironment(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('environmentId') environmentId: string,
  ): Promise<EnvironmentResponse> {
    const environment = await this.cicdService.getEnvironment(req.user.id, projectId, environmentId);
    return { environment };
  }

  /**
   * Updates an environment's settings.
   * PATCH /projects/:projectId/environments/:environmentId
   */
  @Patch('environments/:environmentId')
  async updateEnvironment(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('environmentId') environmentId: string,
    @Body() dto: UpdateEnvironmentRequest,
  ): Promise<EnvironmentResponse> {
    const environment = await this.cicdService.updateEnvironment(req.user.id, projectId, environmentId, dto);
    return { environment };
  }

  /**
   * Deletes a custom environment.
   * DELETE /projects/:projectId/environments/:environmentId
   */
  @Delete('environments/:environmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteEnvironment(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('environmentId') environmentId: string,
  ): Promise<void> {
    await this.cicdService.deleteEnvironment(req.user.id, projectId, environmentId);
  }

  /**
   * Lists variables for an environment (masked/redacted).
   * GET /projects/:projectId/environments/:environmentId/variables
   */
  @Get('environments/:environmentId/variables')
  async getEnvironmentVariables(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('environmentId') environmentId: string,
  ): Promise<EnvironmentVariablesResponse> {
    const variables = await this.cicdService.getEnvironmentVariables(req.user.id, projectId, environmentId);
    return { variables };
  }

  /**
   * Creates or updates an encrypted environment variable.
   * POST /projects/:projectId/environments/:environmentId/variables
   */
  @Post('environments/:environmentId/variables')
  async setEnvironmentVariable(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('environmentId') environmentId: string,
    @Body() dto: SetEnvironmentVariableRequest,
  ): Promise<EnvironmentVariableResponse> {
    const variable = await this.cicdService.setEnvironmentVariable(req.user.id, projectId, environmentId, dto);
    return { variable };
  }

  /**
   * Deletes an environment variable.
   * DELETE /projects/:projectId/environments/:environmentId/variables/:variableId
   */
  @Delete('environments/:environmentId/variables/:variableId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteEnvironmentVariable(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('environmentId') environmentId: string,
    @Param('variableId') variableId: string,
  ): Promise<void> {
    await this.cicdService.deleteEnvironmentVariable(req.user.id, projectId, environmentId, variableId);
  }

  /**
   * Rolls back a deployment to a previous healthy deployment.
   * POST /projects/:projectId/deployments/:deploymentId/rollback
   */
  @Post('deployments/:deploymentId/rollback')
  @HttpCode(HttpStatus.OK)
  async rollbackDeployment(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('deploymentId') deploymentId: string,
    @Body() request?: RollbackRequest,
  ): Promise<RollbackResponse> {
    return this.cicdService.rollbackDeployment(req.user.id, projectId, deploymentId, request);
  }

  /**
   * Gets CI/CD settings for a project.
   * GET /projects/:projectId/cicd/settings
   */
  @Get('cicd/settings')
  async getCicdSettings(
    @Req() req: any,
    @Param('projectId') projectId: string,
  ): Promise<CicdSettingsResponse> {
    const settings = await this.cicdService.getCicdSettings(req.user.id, projectId);
    return { settings };
  }

  /**
   * Updates CI/CD settings (e.g. Webhook Secret).
   * PATCH /projects/:projectId/cicd/settings
   */
  @Patch('cicd/settings')
  async updateCicdSettings(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateCicdSettingsRequest,
  ): Promise<CicdSettingsResponse> {
    const settings = await this.cicdService.updateCicdSettings(req.user.id, projectId, dto);
    return { settings };
  }

  /**
   * Retrieves recent GitHub webhook delivery events for auditing.
   * GET /projects/:projectId/cicd/webhook-events
   */
  @Get('cicd/webhook-events')
  async getWebhookEvents(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query('limit') limit?: string,
  ): Promise<WebhookEventsListResponse> {
    const events = await this.cicdService.getWebhookEvents(
      req.user.id,
      projectId,
      limit ? parseInt(limit, 10) : 20,
    );
    return { events };
  }
}
