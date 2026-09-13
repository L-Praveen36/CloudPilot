import { DeploymentStatus, DeploymentHealthStatus } from './deployment';

export interface ContainerMetricsSnapshot {
  cpuPercent: number;
  memoryUsageBytes: number;
  memoryLimitBytes: number;
  memoryPercent: number;
  networkInputBytes: number;
  networkOutputBytes: number;
  blockInputBytes: number;
  blockOutputBytes: number;
  pids: number;
  containerStatus: 'RUNNING' | 'EXITED' | 'PAUSED' | 'RESTARTING' | 'DEAD' | 'UNKNOWN';
  uptimeSeconds: number;
  timestamp: string;
}

export interface MetricHistoryPoint {
  timestamp: string;
  cpuPercent: number;
  memoryPercent: number;
  memoryUsageBytes: number;
  networkInputBytes: number;
  networkOutputBytes: number;
  pids: number;
}

export interface DeploymentEventDto {
  id: string;
  deploymentId: string;
  type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  metadata?: Record<string, any> | null;
  timestamp: string;
}

export interface DeploymentTelemetrySummary {
  deploymentId: string;
  projectId: string;
  status: DeploymentStatus;
  healthStatus: DeploymentHealthStatus;
  url: string | null;
  hostPort: number | null;
  containerName: string | null;
  liveSnapshot: ContainerMetricsSnapshot | null;
  uptimeSeconds: number;
  avgCpuPercent: number;
  peakMemoryBytes: number;
  totalNetworkInputBytes: number;
  totalNetworkOutputBytes: number;
  activeAlertsCount: number;
  recentEvents: DeploymentEventDto[];
  collectedAt: string;
}

export interface DeploymentLogsQuery {
  level?: 'INFO' | 'WARN' | 'ERROR' | 'ALL';
  search?: string;
  limit?: number;
  since?: string;
}

export interface TailLogsResponse {
  deploymentId: string;
  lines: Array<{
    timestamp: string;
    level: 'INFO' | 'WARN' | 'ERROR';
    message: string;
    stage?: string;
  }>;
  totalLines: number;
  hasMore: boolean;
}

export interface DeploymentMetricsResponse {
  deploymentId: string;
  current: ContainerMetricsSnapshot | null;
  history: MetricHistoryPoint[];
}

export interface DeploymentTelemetryResponse {
  telemetry: DeploymentTelemetrySummary;
}

export interface DeploymentEventsResponse {
  deploymentId: string;
  events: DeploymentEventDto[];
}
