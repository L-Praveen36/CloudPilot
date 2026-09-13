export type EnvironmentType = 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION' | 'PREVIEW' | 'CUSTOM';

export type DeploymentTriggerType = 'MANUAL' | 'WEBHOOK' | 'ROLLBACK';

export type WebhookEventStatus = 'PROCESSED' | 'IGNORED' | 'FAILED' | 'DUPLICATE';

export interface EnvironmentDto {
  id: string;
  projectId: string;
  name: string;
  type: EnvironmentType;
  branchPattern: string;
  autoDeployEnabled: boolean;
  autoRollbackEnabled: boolean;
  maxRollbackAttempts: number;
  variablesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface EnvironmentVariableDto {
  id: string;
  environmentId: string;
  key: string;
  isSecret: boolean;
  isConfigured: boolean;
  maskedValue?: string; // e.g. "••••••••" or plain value if isSecret is false
  createdAt: string;
  updatedAt: string;
}

export interface CreateEnvironmentRequest {
  name: string;
  type?: EnvironmentType;
  branchPattern?: string;
  autoDeployEnabled?: boolean;
  autoRollbackEnabled?: boolean;
  maxRollbackAttempts?: number;
}

export interface UpdateEnvironmentRequest {
  name?: string;
  type?: EnvironmentType;
  branchPattern?: string;
  autoDeployEnabled?: boolean;
  autoRollbackEnabled?: boolean;
  maxRollbackAttempts?: number;
}

export interface SetEnvironmentVariableRequest {
  key: string;
  value: string;
  isSecret?: boolean;
}

export interface EnvironmentListResponse {
  environments: EnvironmentDto[];
}

export interface EnvironmentResponse {
  environment: EnvironmentDto;
}

export interface EnvironmentVariablesResponse {
  variables: EnvironmentVariableDto[];
}

export interface EnvironmentVariableResponse {
  variable: EnvironmentVariableDto;
}

export interface RollbackRequest {
  targetDeploymentId?: string; // Optional: specify explicit target deployment to rollback to
  reason?: string;
}

export interface RollbackResponse {
  message: string;
  rollbackDeployment: any; // DeploymentDto
  rolledBackFromId: string;
  rolledBackToId: string;
}

export interface GithubWebhookEventDto {
  id: string;
  deliveryId: string;
  projectId: string;
  event: string;
  sender?: string | null;
  ref?: string | null;
  commitSha?: string | null;
  status: WebhookEventStatus;
  reason?: string | null;
  deploymentId?: string | null;
  createdAt: string;
}

export interface WebhookEventsListResponse {
  events: GithubWebhookEventDto[];
}

export interface CicdSettingsDto {
  webhookUrl: string;
  webhookSecretConfigured: boolean;
  autoDeployGlobalEnabled?: boolean;
  defaultBranch: string;
}

export interface UpdateCicdSettingsRequest {
  webhookSecret?: string;
}

export interface CicdSettingsResponse {
  settings: CicdSettingsDto;
}
