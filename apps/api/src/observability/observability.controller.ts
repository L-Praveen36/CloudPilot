import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { ObservabilityService } from './observability.service';
import {
  DeploymentTelemetryResponse,
  DeploymentMetricsResponse,
  TailLogsResponse,
  DeploymentEventsResponse,
  DeploymentLogsQuery,
} from '@cloudpilot/shared';

@Controller('projects/:projectId/deployments/:deploymentId')
@UseGuards(AuthGuard)
export class ObservabilityController {
  constructor(private readonly observabilityService: ObservabilityService) {}

  /**
   * Retrieves comprehensive telemetry summary for a deployment.
   * GET /projects/:projectId/deployments/:deploymentId/telemetry
   */
  @Get('telemetry')
  async getTelemetry(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('deploymentId') deploymentId: string,
  ): Promise<DeploymentTelemetryResponse> {
    const telemetry = await this.observabilityService.getDeploymentTelemetry(
      req.user.id,
      projectId,
      deploymentId,
    );
    return { telemetry };
  }

  /**
   * Retrieves current metrics snapshot and historical series.
   * GET /projects/:projectId/deployments/:deploymentId/metrics
   */
  @Get('metrics')
  async getMetrics(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('deploymentId') deploymentId: string,
    @Query('limit') limit?: string,
  ): Promise<DeploymentMetricsResponse> {
    const parsedLimit = limit ? parseInt(limit, 10) : 60;
    return this.observabilityService.getDeploymentMetrics(
      req.user.id,
      projectId,
      deploymentId,
      parsedLimit,
    );
  }

  /**
   * Triggers an on-demand metrics collection snapshot.
   * POST /projects/:projectId/deployments/:deploymentId/metrics/collect
   */
  @Post('metrics/collect')
  @HttpCode(HttpStatus.OK)
  async collectMetrics(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('deploymentId') deploymentId: string,
  ): Promise<DeploymentMetricsResponse> {
    return this.observabilityService.collectMetricsNow(
      req.user.id,
      projectId,
      deploymentId,
    );
  }

  /**
   * Tails live/persisted logs with search and level filters.
   * GET /projects/:projectId/deployments/:deploymentId/logs/tail
   */
  @Get('logs/tail')
  async getTailLogs(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('deploymentId') deploymentId: string,
    @Query('level') level?: 'INFO' | 'WARN' | 'ERROR' | 'ALL',
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('since') since?: string,
  ): Promise<TailLogsResponse> {
    const query: DeploymentLogsQuery = {
      level,
      search,
      limit: limit ? parseInt(limit, 10) : 100,
      since,
    };

    return this.observabilityService.getTailLogs(
      req.user.id,
      projectId,
      deploymentId,
      query,
    );
  }

  /**
   * Retrieves operational incident and threshold alerts.
   * GET /projects/:projectId/deployments/:deploymentId/events
   */
  @Get('events')
  async getEvents(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('deploymentId') deploymentId: string,
    @Query('limit') limit?: string,
  ): Promise<DeploymentEventsResponse> {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.observabilityService.getDeploymentEvents(
      req.user.id,
      projectId,
      deploymentId,
      parsedLimit,
    );
  }
}
