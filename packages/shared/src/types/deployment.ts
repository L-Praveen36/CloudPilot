import { DeploymentStrategy, DeploymentBlocker, DeploymentWarning } from './repository-analysis';

export type DeploymentStatus =
  | 'PENDING'
  | 'VALIDATING'
  | 'BUILDING'
  | 'STARTING'
  | 'HEALTH_CHECKING'
  | 'RUNNING'
  | 'FAILED'
  | 'STOPPED'
  | 'CANCELLED';

export type DeploymentHealthStatus =
  | 'HEALTHY'
  | 'UNHEALTHY'
  | 'UNKNOWN'
  | 'NOT_APPLICABLE';

export interface DeploymentLogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  stage?: string;
}

export interface SubApplicationPlan {
  name: string;
  path: string;
  strategy: DeploymentStrategy;
  isSupported: boolean;
  buildMethod: string;
  runtimeMethod: string;
  dockerfileStrategy: 'EXISTING' | 'GENERATED' | 'NONE';
  generatedDockerfile?: string;
  exposedPort: number | null;
  healthCheckStrategy: 'HTTP' | 'PROCESS' | 'STATIC' | 'NONE';
  healthCheckPath?: string;
}

export interface DeploymentPlan {
  strategy: DeploymentStrategy;
  isSupported: boolean;
  canDeploy: boolean;
  buildMethod: string;
  runtimeMethod: string;
  dockerfileStrategy: 'EXISTING' | 'GENERATED' | 'NONE';
  generatedDockerfile?: string;
  exposedPort: number | null;
  healthCheckStrategy: 'HTTP' | 'PROCESS' | 'STATIC' | 'NONE';
  healthCheckPath?: string;
  requiredEnvVars: string[];
  optionalEnvVars: string[];
  blockers: DeploymentBlocker[];
  warnings: DeploymentWarning[];
  subApplicationsPlans?: SubApplicationPlan[];
  summary: string;
  createdAt: string;
}

export interface DeploymentDto {
  id: string;
  projectId: string;
  userId: string;
  status: DeploymentStatus;
  strategy: DeploymentStrategy;
  imageTag: string | null;
  containerName?: string | null;
  exposedPort: number | null;
  hostPort: number | null;
  url: string | null;
  healthStatus: DeploymentHealthStatus;
  startedAt: string | null;
  completedAt: string | null;
  buildDurationMs: number | null;
  runtimeDurationMs: number | null;
  buildSummary: string | null;
  runtimeSummary: string | null;
  errorMessage: string | null;
  plan: DeploymentPlan | null;
  logs?: DeploymentLogEntry[] | null;
  deploymentNumber?: number | null;
  commitSha?: string | null;
  commitMessage?: string | null;
  branch?: string | null;
  environmentId?: string | null;
  environmentName?: string | null;
  configurationVersion?: string | null;
  buildId?: string | null;
  triggerType?: 'MANUAL' | 'WEBHOOK' | 'ROLLBACK';
  triggeredBy?: string | null;
  previousDeploymentId?: string | null;
  rollbackTargetId?: string | null;
  isRollback?: boolean;
  canRollback?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DeployProjectRequest {
  environmentId?: string;
}

export interface DeploymentPlanResponse {
  plan: DeploymentPlan;
}

export interface DeploymentResponse {
  deployment: DeploymentDto;
}

export interface DeploymentListResponse {
  deployments: DeploymentDto[];
}

export interface DeploymentLogsResponse {
  deploymentId: string;
  status: DeploymentStatus;
  logs: DeploymentLogEntry[];
}
