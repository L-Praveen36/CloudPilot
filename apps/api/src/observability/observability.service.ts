import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ContainerTelemetryService } from './services/container-telemetry.service';
import { ObservabilityLogService } from './services/observability-log.service';
import { ObservabilityHealthService } from './services/observability-health.service';
import {
  DeploymentTelemetrySummary,
  DeploymentMetricsResponse,
  TailLogsResponse,
  DeploymentEventsResponse,
  DeploymentLogsQuery,
  DeploymentLogEntry,
} from '@cloudpilot/shared';

@Injectable()
export class ObservabilityService {
  private readonly logger = new Logger(ObservabilityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telemetryService: ContainerTelemetryService,
    private readonly logService: ObservabilityLogService,
    private readonly healthService: ObservabilityHealthService,
  ) {}

  /**
   * Retrieves comprehensive telemetry summary for a deployment.
   */
  async getDeploymentTelemetry(
    userId: string,
    projectId: string,
    deploymentId: string,
  ): Promise<DeploymentTelemetrySummary> {
    const deployment = await this.verifyOwnership(userId, projectId, deploymentId);

    // 1. Collect live snapshot if container exists
    let liveSnapshot = null;
    if (deployment.containerName) {
      liveSnapshot = await this.telemetryService.collectContainerMetrics(
        deployment.id,
        deployment.containerName,
      );
    }

    // 2. Active health probe if running
    let currentHealth = deployment.healthStatus;
    if (deployment.status === 'RUNNING' && deployment.hostPort) {
      const plan = (deployment.plan as any) || {};
      const probe = await this.healthService.probeHealth(
        deployment.hostPort,
        plan.healthCheckStrategy || 'HTTP',
        plan.healthCheckPath || '/',
        deployment.containerName,
      );
      currentHealth = probe.status;

      // Update in DB if health state changed
      if (probe.status !== deployment.healthStatus) {
        await this.prisma.deployment.update({
          where: { id: deployment.id },
          data: { healthStatus: probe.status },
        }).catch(() => {});
      }
    }

    // 3. Query historical metrics for aggregated calculations
    const history = await this.telemetryService.getMetricsHistory(deployment.id, 60);

    let avgCpuPercent = 0;
    let peakMemoryBytes = 0;
    let totalNetworkInputBytes = 0;
    let totalNetworkOutputBytes = 0;

    if (history.length > 0) {
      const sumCpu = history.reduce((acc, h) => acc + h.cpuPercent, 0);
      avgCpuPercent = parseFloat((sumCpu / history.length).toFixed(2));
      peakMemoryBytes = Math.max(...history.map((h) => h.memoryUsageBytes));
      totalNetworkInputBytes = history[history.length - 1].networkInputBytes || 0;
      totalNetworkOutputBytes = history[history.length - 1].networkOutputBytes || 0;
    } else if (liveSnapshot) {
      avgCpuPercent = liveSnapshot.cpuPercent;
      peakMemoryBytes = liveSnapshot.memoryUsageBytes;
      totalNetworkInputBytes = liveSnapshot.networkInputBytes;
      totalNetworkOutputBytes = liveSnapshot.networkOutputBytes;
    }

    // 4. Query recent events & active alerts
    const recentEvents = await this.telemetryService.getDeploymentEvents(deployment.id, 10);
    const activeAlertsCount = recentEvents.filter((e) => e.severity === 'CRITICAL' || e.severity === 'WARNING').length;

    // 5. Calculate uptime
    let uptimeSeconds = liveSnapshot?.uptimeSeconds || 0;
    if (!uptimeSeconds && deployment.startedAt && deployment.status === 'RUNNING') {
      uptimeSeconds = Math.max(0, Math.floor((Date.now() - new Date(deployment.startedAt).getTime()) / 1000));
    }

    return {
      deploymentId: deployment.id,
      projectId: deployment.projectId,
      status: deployment.status,
      healthStatus: currentHealth,
      url: deployment.url,
      hostPort: deployment.hostPort,
      containerName: deployment.containerName,
      liveSnapshot,
      uptimeSeconds,
      avgCpuPercent,
      peakMemoryBytes,
      totalNetworkInputBytes,
      totalNetworkOutputBytes,
      activeAlertsCount,
      recentEvents,
      collectedAt: new Date().toISOString(),
    };
  }

  /**
   * Retrieves metric time-series and current snapshot.
   */
  async getDeploymentMetrics(
    userId: string,
    projectId: string,
    deploymentId: string,
    limit = 60,
  ): Promise<DeploymentMetricsResponse> {
    const deployment = await this.verifyOwnership(userId, projectId, deploymentId);

    let current = null;
    if (deployment.containerName) {
      current = await this.telemetryService.collectContainerMetrics(
        deployment.id,
        deployment.containerName,
      );
    }

    const history = await this.telemetryService.getMetricsHistory(deployment.id, limit);

    return {
      deploymentId: deployment.id,
      current,
      history,
    };
  }

  /**
   * Triggers an on-demand container metric collection.
   */
  async collectMetricsNow(
    userId: string,
    projectId: string,
    deploymentId: string,
  ): Promise<DeploymentMetricsResponse> {
    return this.getDeploymentMetrics(userId, projectId, deploymentId, 60);
  }

  /**
   * Retrieves live tailing logs with search filtering and secret redaction.
   */
  async getTailLogs(
    userId: string,
    projectId: string,
    deploymentId: string,
    query: DeploymentLogsQuery = {},
  ): Promise<TailLogsResponse> {
    const deployment = await this.verifyOwnership(userId, projectId, deploymentId);

    const storedLogs = (deployment.logs as unknown as DeploymentLogEntry[]) || [];
    const response = await this.logService.getTailLogs(deployment.containerName, storedLogs, query);
    response.deploymentId = deployment.id;

    return response;
  }

  /**
   * Retrieves incident and event history for a deployment.
   */
  async getDeploymentEvents(
    userId: string,
    projectId: string,
    deploymentId: string,
    limit = 50,
  ): Promise<DeploymentEventsResponse> {
    const deployment = await this.verifyOwnership(userId, projectId, deploymentId);
    const events = await this.telemetryService.getDeploymentEvents(deployment.id, limit);

    return {
      deploymentId: deployment.id,
      events,
    };
  }

  /**
   * Validates server-side project & deployment ownership.
   */
  private async verifyOwnership(userId: string, projectId: string, deploymentId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const deployment = await this.prisma.deployment.findFirst({
      where: { id: deploymentId, projectId, userId },
    });

    if (!deployment) {
      throw new NotFoundException('Deployment not found');
    }

    return deployment;
  }
}
