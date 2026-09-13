import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  UsePipes,
  ValidationPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  UserDto,
  DeploymentPlanResponse,
  DeploymentResponse,
  DeploymentListResponse,
  DeploymentLogsResponse,
} from '@cloudpilot/shared';
import { DeploymentService } from './deployment.service';
import { ProjectIdDto } from '../projects/dto/project-id.dto';
import { DeployProjectDto } from './dto/deploy-project.dto';

@Controller('projects/:id')
@UseGuards(AuthGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class DeploymentController {
  constructor(private readonly deploymentService: DeploymentService) {}

  /**
   * POST /projects/:id/deployment-plan
   * Generates a dry-run deployment plan without executing Docker.
   */
  @Post('deployment-plan')
  @HttpCode(HttpStatus.OK)
  async getDeploymentPlan(
    @CurrentUser() user: UserDto,
    @Param() params: ProjectIdDto,
  ): Promise<DeploymentPlanResponse> {
    const plan = await this.deploymentService.createDeploymentPlan(user.id, params.id);
    return { plan };
  }

  /**
   * POST /projects/:id/deploy
   * Triggers an isolated Docker deployment for the project.
   */
  @Post('deploy')
  @HttpCode(HttpStatus.OK)
  async deployProject(
    @CurrentUser() user: UserDto,
    @Param() params: ProjectIdDto,
    @Body() body?: DeployProjectDto,
  ): Promise<DeploymentResponse> {
    const deployment = await this.deploymentService.deploy(user.id, params.id, body?.environmentId);
    return { deployment };
  }

  /**
   * POST /projects/:id/deployments/:deploymentId/cancel
   * Cancels an active deployment.
   */
  @Post('deployments/:deploymentId/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelDeployment(
    @CurrentUser() user: UserDto,
    @Param('id') projectId: string,
    @Param('deploymentId') deploymentId: string,
  ): Promise<DeploymentResponse> {
    const deployment = await this.deploymentService.cancelDeployment(
      user.id,
      projectId,
      deploymentId,
    );
    return { deployment };
  }

  /**
   * GET /projects/:id/deployments
   * Lists all previous deployments for the project (newest first).
   */
  @Get('deployments')
  async listDeployments(
    @CurrentUser() user: UserDto,
    @Param() params: ProjectIdDto,
  ): Promise<DeploymentListResponse> {
    const deployments = await this.deploymentService.getDeployments(user.id, params.id);
    return { deployments };
  }

  /**
   * GET /projects/:id/deployments/:deploymentId
   * Retrieves detail for a specific deployment.
   */
  @Get('deployments/:deploymentId')
  async getDeployment(
    @CurrentUser() user: UserDto,
    @Param('id') projectId: string,
    @Param('deploymentId') deploymentId: string,
  ): Promise<DeploymentResponse> {
    const deployment = await this.deploymentService.getDeployment(
      user.id,
      projectId,
      deploymentId,
    );
    return { deployment };
  }

  /**
   * GET /projects/:id/deployments/:deploymentId/logs
   * Retrieves sanitized logs for a deployment.
   */
  @Get('deployments/:deploymentId/logs')
  async getDeploymentLogs(
    @CurrentUser() user: UserDto,
    @Param('id') projectId: string,
    @Param('deploymentId') deploymentId: string,
  ): Promise<DeploymentLogsResponse> {
    return this.deploymentService.getDeploymentLogs(
      user.id,
      projectId,
      deploymentId,
    );
  }
}
