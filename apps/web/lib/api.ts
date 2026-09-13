import {
  CurrentUserResponse,
  LogoutResponse,
  RepositoryListResponse,
  RepositoryDetailResponse,
  BranchListResponse,
  RepositoryRateLimit,
  CreateProjectDto,
  ProjectListResponse,
  ProjectDetailResponse,
  DeleteProjectResponse,
  RepositoryAnalysisResponse,
  ApplicationStructureResponse,
  DeploymentReadinessResponse,
  DeploymentPlanResponse,
  DeploymentResponse,
  DeploymentListResponse,
  DeploymentLogsResponse,
  DeploymentTelemetryResponse,
  DeploymentMetricsResponse,
  TailLogsResponse,
  DeploymentEventsResponse,
  DeploymentLogsQuery,
  AiRepositoryUnderstandingResponse,
  AiDeploymentProposalResponse,
  AiDiagnosisResponse,
  AiRepairSuggestionsResponse,
  AiRepairSuggestionActionResponse,
  AiAgentRequest,
  AiAgentResponse,
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

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly rateLimit?: RepositoryRateLimit,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

const getApiBaseUrl = (): string => {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
};

/**
 * Internal safe fetch wrapper that attaches credentials and handles JSON error parsing.
 */
async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers: HeadersInit = {
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Always include HTTP-only cloudpilot_session cookie
    });
  } catch (err: any) {
    throw new ApiClientError(
      502,
      'Unable to connect to CloudPilot API. Please ensure the backend service is running.',
    );
  }

  let data: any = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const status = response.status;
    let message = 'An unexpected error occurred';

    if (data && typeof data === 'object') {
      if (typeof data.message === 'string') {
        message = data.message;
      } else if (Array.isArray(data.message) && data.message.length > 0) {
        message = data.message.join(', ');
      } else if (typeof data.error === 'string') {
        message = data.error;
      }
    } else {
      if (status === 401) {
        message = 'Your session has expired. Please sign in again.';
      } else if (status === 403) {
        message = 'You do not have permission to access this resource.';
      } else if (status === 404) {
        message = 'The requested resource was not found.';
      } else if (status === 409) {
        message = 'Repository is already connected to this account.';
      } else if (status === 429) {
        message = 'GitHub API rate limit reached. Please try again later.';
      } else if (status >= 500) {
        message = 'CloudPilot API service encountered an internal error.';
      }
    }

    const rateLimit: RepositoryRateLimit | undefined = data?.rateLimit;
    throw new ApiClientError(status, message, rateLimit);
  }

  return data as T;
}

/**
 * Retrieves the currently authenticated CloudPilot user.
 */
export async function getCurrentUser(): Promise<CurrentUserResponse> {
  return apiFetch<CurrentUserResponse>('/auth/me', {
    method: 'GET',
  });
}

/**
 * Logs out the current user by invalidating the session and clearing the cookie.
 */
export async function logout(): Promise<LogoutResponse> {
  return apiFetch<LogoutResponse>('/auth/logout', {
    method: 'POST',
  });
}

/**
 * Retrieves paginated repositories accessible to the authenticated user.
 */
export async function getRepositories(
  page: number = 1,
  perPage: number = 30,
): Promise<RepositoryListResponse> {
  const safePage = Math.max(1, Math.floor(page));
  const safePerPage = Math.min(100, Math.max(1, Math.floor(perPage)));

  return apiFetch<RepositoryListResponse>(
    `/github/repositories?page=${safePage}&perPage=${safePerPage}`,
    {
      method: 'GET',
    },
  );
}

/**
 * Retrieves details for a specific repository.
 */
export async function getRepository(
  owner: string,
  repo: string,
): Promise<RepositoryDetailResponse> {
  const safeOwner = encodeURIComponent(owner.trim());
  const safeRepo = encodeURIComponent(repo.trim());

  return apiFetch<RepositoryDetailResponse>(
    `/github/repositories/${safeOwner}/${safeRepo}`,
    {
      method: 'GET',
    },
  );
}

/**
 * Retrieves paginated branches for a specific repository.
 */
export async function getBranches(
  owner: string,
  repo: string,
  page: number = 1,
  perPage: number = 30,
): Promise<BranchListResponse> {
  const safeOwner = encodeURIComponent(owner.trim());
  const safeRepo = encodeURIComponent(repo.trim());
  const safePage = Math.max(1, Math.floor(page));
  const safePerPage = Math.min(100, Math.max(1, Math.floor(perPage)));

  return apiFetch<BranchListResponse>(
    `/github/repositories/${safeOwner}/${safeRepo}/branches?page=${safePage}&perPage=${safePerPage}`,
    {
      method: 'GET',
    },
  );
}

/**
 * Connects/creates a persistent Project in PostgreSQL from a GitHub repository.
 */
export async function createProject(dto: CreateProjectDto): Promise<ProjectDetailResponse> {
  return apiFetch<ProjectDetailResponse>('/projects', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(dto),
  });
}

/**
 * Lists all persistent projects belonging to the authenticated user.
 */
export async function getProjects(): Promise<ProjectListResponse> {
  return apiFetch<ProjectListResponse>('/projects', {
    method: 'GET',
  });
}

/**
 * Retrieves detail for a specific persistent project.
 */
export async function getProject(id: string): Promise<ProjectDetailResponse> {
  const safeId = encodeURIComponent(id.trim());
  return apiFetch<ProjectDetailResponse>(`/projects/${safeId}`, {
    method: 'GET',
  });
}

/**
 * Disconnects/deletes a persistent project from PostgreSQL.
 */
export async function deleteProject(id: string): Promise<DeleteProjectResponse> {
  const safeId = encodeURIComponent(id.trim());
  return apiFetch<DeleteProjectResponse>(`/projects/${safeId}`, {
    method: 'DELETE',
  });
}

/**
 * Triggers static repository intelligence analysis on a connected project.
 */
export async function analyzeProject(projectId: string): Promise<RepositoryAnalysisResponse> {
  const safeId = encodeURIComponent(projectId.trim());
  return apiFetch<RepositoryAnalysisResponse>(`/projects/${safeId}/analyze`, {
    method: 'POST',
  });
}

/**
 * Retrieves the latest stored static analysis for a project.
 */
export async function getProjectAnalysis(projectId: string): Promise<RepositoryAnalysisResponse> {
  const safeId = encodeURIComponent(projectId.trim());
  return apiFetch<RepositoryAnalysisResponse>(`/projects/${safeId}/analysis`, {
    method: 'GET',
  });
}

/**
 * Phase 3.3 — Triggers Application Structure Detection on a connected project.
 */
export async function analyzeProjectStructure(
  projectId: string,
): Promise<ApplicationStructureResponse> {
  const safeId = encodeURIComponent(projectId.trim());
  return apiFetch<ApplicationStructureResponse>(`/projects/${safeId}/analyze-structure`, {
    method: 'POST',
  });
}

/**
 * Phase 3.3 — Retrieves the latest stored Application Structure for a project.
 */
export async function getProjectStructure(
  projectId: string,
): Promise<ApplicationStructureResponse> {
  const safeId = encodeURIComponent(projectId.trim());
  return apiFetch<ApplicationStructureResponse>(`/projects/${safeId}/structure`, {
    method: 'GET',
  });
}

/**
 * Phase 3.4 — Triggers Deployment Readiness Analysis on a connected project.
 */
export async function analyzeProjectReadiness(
  projectId: string,
): Promise<DeploymentReadinessResponse> {
  const safeId = encodeURIComponent(projectId.trim());
  return apiFetch<DeploymentReadinessResponse>(`/projects/${safeId}/analyze-readiness`, {
    method: 'POST',
  });
}

/**
 * Phase 3.4 — Retrieves the latest stored Deployment Readiness for a project.
 */
export async function getProjectReadiness(
  projectId: string,
): Promise<DeploymentReadinessResponse> {
  const safeId = encodeURIComponent(projectId.trim());
  return apiFetch<DeploymentReadinessResponse>(`/projects/${safeId}/readiness`, {
    method: 'GET',
  });
}

/**
 * Phase 4 — Generates a dry-run deployment plan without executing Docker.
 */
export async function getDeploymentPlan(
  projectId: string,
): Promise<DeploymentPlanResponse> {
  const safeId = encodeURIComponent(projectId.trim());
  return apiFetch<DeploymentPlanResponse>(`/projects/${safeId}/deployment-plan`, {
    method: 'POST',
  });
}

/**
 * Phase 4 — Triggers a Docker-based isolated deployment.
 */
export async function createDeployment(
  projectId: string,
  environmentId?: string,
): Promise<DeploymentResponse> {
  const safeId = encodeURIComponent(projectId.trim());
  return apiFetch<DeploymentResponse>(`/projects/${safeId}/deploy`, {
    method: 'POST',
    body: environmentId ? JSON.stringify({ environmentId }) : undefined,
  });
}

/**
 * Phase 4 — Cancels an active deployment.
 */
export async function cancelDeployment(
  projectId: string,
  deploymentId: string,
): Promise<DeploymentResponse> {
  const safeId = encodeURIComponent(projectId.trim());
  const safeDepId = encodeURIComponent(deploymentId.trim());
  return apiFetch<DeploymentResponse>(`/projects/${safeId}/deployments/${safeDepId}/cancel`, {
    method: 'POST',
  });
}

/**
 * Phase 4 — Lists deployment history for a project (newest first).
 */
export async function getDeployments(
  projectId: string,
): Promise<DeploymentListResponse> {
  const safeId = encodeURIComponent(projectId.trim());
  return apiFetch<DeploymentListResponse>(`/projects/${safeId}/deployments`, {
    method: 'GET',
  });
}

/**
 * Phase 4 — Retrieves a single deployment by ID.
 */
export async function getDeployment(
  projectId: string,
  deploymentId: string,
): Promise<DeploymentResponse> {
  const safeId = encodeURIComponent(projectId.trim());
  const safeDepId = encodeURIComponent(deploymentId.trim());
  return apiFetch<DeploymentResponse>(`/projects/${safeId}/deployments/${safeDepId}`, {
    method: 'GET',
  });
}

/**
 * Phase 4 — Retrieves sanitized logs for a deployment.
 */
export async function getDeploymentLogs(
  projectId: string,
  deploymentId: string,
): Promise<DeploymentLogsResponse> {
  const safeId = encodeURIComponent(projectId.trim());
  const safeDepId = encodeURIComponent(deploymentId.trim());
  return apiFetch<DeploymentLogsResponse>(`/projects/${safeId}/deployments/${safeDepId}/logs`, {
    method: 'GET',
  });
}

/**
 * Phase 5 — Retrieves comprehensive telemetry summary for a deployment.
 */
export async function getDeploymentTelemetry(
  projectId: string,
  deploymentId: string,
): Promise<DeploymentTelemetryResponse> {
  const safeId = encodeURIComponent(projectId.trim());
  const safeDepId = encodeURIComponent(deploymentId.trim());
  return apiFetch<DeploymentTelemetryResponse>(`/projects/${safeId}/deployments/${safeDepId}/telemetry`, {
    method: 'GET',
  });
}

/**
 * Phase 5 — Retrieves current snapshot and time-series metrics.
 */
export async function getDeploymentMetrics(
  projectId: string,
  deploymentId: string,
  limit: number = 60,
): Promise<DeploymentMetricsResponse> {
  const safeId = encodeURIComponent(projectId.trim());
  const safeDepId = encodeURIComponent(deploymentId.trim());
  return apiFetch<DeploymentMetricsResponse>(`/projects/${safeId}/deployments/${safeDepId}/metrics?limit=${limit}`, {
    method: 'GET',
  });
}

/**
 * Phase 5 — Triggers on-demand metrics collection.
 */
export async function collectDeploymentMetrics(
  projectId: string,
  deploymentId: string,
): Promise<DeploymentMetricsResponse> {
  const safeId = encodeURIComponent(projectId.trim());
  const safeDepId = encodeURIComponent(deploymentId.trim());
  return apiFetch<DeploymentMetricsResponse>(`/projects/${safeId}/deployments/${safeDepId}/metrics/collect`, {
    method: 'POST',
  });
}

/**
 * Phase 5 — Tails live/stored logs with search and level filters.
 */
export async function getDeploymentTailLogs(
  projectId: string,
  deploymentId: string,
  query: DeploymentLogsQuery = {},
): Promise<TailLogsResponse> {
  const safeId = encodeURIComponent(projectId.trim());
  const safeDepId = encodeURIComponent(deploymentId.trim());
  const params = new URLSearchParams();
  if (query.level) params.append('level', query.level);
  if (query.search) params.append('search', query.search);
  if (query.limit) params.append('limit', String(query.limit));
  if (query.since) params.append('since', query.since);

  const qs = params.toString();
  return apiFetch<TailLogsResponse>(`/projects/${safeId}/deployments/${safeDepId}/logs/tail${qs ? `?${qs}` : ''}`, {
    method: 'GET',
  });
}

/**
 * Phase 5 — Retrieves operational incident & alert events.
 */
export async function getDeploymentEvents(
  projectId: string,
  deploymentId: string,
  limit: number = 50,
): Promise<DeploymentEventsResponse> {
  const safeId = encodeURIComponent(projectId.trim());
  const safeDepId = encodeURIComponent(deploymentId.trim());
  return apiFetch<DeploymentEventsResponse>(`/projects/${safeId}/deployments/${safeDepId}/events?limit=${limit}`, {
    method: 'GET',
  });
}

/**
 * Phase 6 — Generates AI repository understanding based on deterministic facts.
 */
export async function getAiRepositoryUnderstanding(
  projectId: string,
): Promise<AiRepositoryUnderstandingResponse> {
  const safeId = encodeURIComponent(projectId.trim());
  return apiFetch<AiRepositoryUnderstandingResponse>(`/projects/${safeId}/ai/understand`, {
    method: 'POST',
  });
}

/**
 * Phase 6 — Generates AI deployment proposal with Dockerfile configuration.
 */
export async function getAiDeploymentProposal(
  projectId: string,
): Promise<AiDeploymentProposalResponse> {
  const safeId = encodeURIComponent(projectId.trim());
  return apiFetch<AiDeploymentProposalResponse>(`/projects/${safeId}/ai/deployment-proposal`, {
    method: 'POST',
  });
}

/**
 * Phase 6 — Diagnoses a build failure using AI.
 */
export async function diagnoseAiBuildFailure(
  projectId: string,
  deploymentId: string,
): Promise<AiDiagnosisResponse> {
  const safeId = encodeURIComponent(projectId.trim());
  const safeDepId = encodeURIComponent(deploymentId.trim());
  return apiFetch<AiDiagnosisResponse>(`/projects/${safeId}/deployments/${safeDepId}/ai/diagnose-build`, {
    method: 'POST',
  });
}

/**
 * Phase 6 — Diagnoses a runtime incident using AI.
 */
export async function diagnoseAiIncident(
  projectId: string,
  deploymentId: string,
): Promise<AiDiagnosisResponse> {
  const safeId = encodeURIComponent(projectId.trim());
  const safeDepId = encodeURIComponent(deploymentId.trim());
  return apiFetch<AiDiagnosisResponse>(`/projects/${safeId}/deployments/${safeDepId}/ai/diagnose-incident`, {
    method: 'POST',
  });
}

/**
 * Phase 6 — Retrieves or generates AI repair suggestions.
 */
export async function getAiRepairSuggestions(
  projectId: string,
  deploymentId: string,
): Promise<AiRepairSuggestionsResponse> {
  const safeId = encodeURIComponent(projectId.trim());
  const safeDepId = encodeURIComponent(deploymentId.trim());
  return apiFetch<AiRepairSuggestionsResponse>(`/projects/${safeId}/deployments/${safeDepId}/ai/repair-suggestions`, {
    method: 'GET',
  });
}

/**
 * Phase 6 — Approves an AI repair suggestion.
 */
export async function approveAiRepairSuggestion(
  projectId: string,
  suggestionId: string,
): Promise<AiRepairSuggestionActionResponse> {
  const safeId = encodeURIComponent(projectId.trim());
  const safeSugId = encodeURIComponent(suggestionId.trim());
  return apiFetch<AiRepairSuggestionActionResponse>(`/projects/${safeId}/ai/repair-suggestions/${safeSugId}/approve`, {
    method: 'POST',
  });
}

/**
 * Phase 6 — Rejects an AI repair suggestion.
 */
export async function rejectAiRepairSuggestion(
  projectId: string,
  suggestionId: string,
): Promise<AiRepairSuggestionActionResponse> {
  const safeId = encodeURIComponent(projectId.trim());
  const safeSugId = encodeURIComponent(suggestionId.trim());
  return apiFetch<AiRepairSuggestionActionResponse>(`/projects/${safeId}/ai/repair-suggestions/${safeSugId}/reject`, {
    method: 'POST',
  });
}

/**
 * Phase 6 — Runs the bounded AI Agent workflow.
 */
export async function runAiAgent(
  projectId: string,
  request: AiAgentRequest,
): Promise<AiAgentResponse> {
  const safeId = encodeURIComponent(projectId.trim());
  return apiFetch<AiAgentResponse>(`/projects/${safeId}/ai/agent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
}

/**
 * Phase 7 — Lists all environments for a project.
 */
export async function getEnvironments(
  projectId: string,
): Promise<EnvironmentListResponse> {
  const safeId = encodeURIComponent(projectId.trim());
  return apiFetch<EnvironmentListResponse>(`/projects/${safeId}/environments`, {
    method: 'GET',
  });
}

/**
 * Phase 7 — Creates a new environment.
 */
export async function createEnvironment(
  projectId: string,
  data: CreateEnvironmentRequest,
): Promise<EnvironmentResponse> {
  const safeId = encodeURIComponent(projectId.trim());
  return apiFetch<EnvironmentResponse>(`/projects/${safeId}/environments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

/**
 * Phase 7 — Updates an environment.
 */
export async function updateEnvironment(
  projectId: string,
  environmentId: string,
  data: UpdateEnvironmentRequest,
): Promise<EnvironmentResponse> {
  const safeId = encodeURIComponent(projectId.trim());
  const safeEnvId = encodeURIComponent(environmentId.trim());
  return apiFetch<EnvironmentResponse>(`/projects/${safeId}/environments/${safeEnvId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

/**
 * Phase 7 — Deletes a custom environment.
 */
export async function deleteEnvironment(
  projectId: string,
  environmentId: string,
): Promise<void> {
  const safeId = encodeURIComponent(projectId.trim());
  const safeEnvId = encodeURIComponent(environmentId.trim());
  return apiFetch<void>(`/projects/${safeId}/environments/${safeEnvId}`, {
    method: 'DELETE',
  });
}

/**
 * Phase 7 — Lists environment variables (masked/redacted).
 */
export async function getEnvironmentVariables(
  projectId: string,
  environmentId: string,
): Promise<EnvironmentVariablesResponse> {
  const safeId = encodeURIComponent(projectId.trim());
  const safeEnvId = encodeURIComponent(environmentId.trim());
  return apiFetch<EnvironmentVariablesResponse>(`/projects/${safeId}/environments/${safeEnvId}/variables`, {
    method: 'GET',
  });
}

/**
 * Phase 7 — Creates or updates an encrypted environment variable.
 */
export async function setEnvironmentVariable(
  projectId: string,
  environmentId: string,
  data: SetEnvironmentVariableRequest,
): Promise<EnvironmentVariableResponse> {
  const safeId = encodeURIComponent(projectId.trim());
  const safeEnvId = encodeURIComponent(environmentId.trim());
  return apiFetch<EnvironmentVariableResponse>(`/projects/${safeId}/environments/${safeEnvId}/variables`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

/**
 * Phase 7 — Deletes an environment variable.
 */
export async function deleteEnvironmentVariable(
  projectId: string,
  environmentId: string,
  variableId: string,
): Promise<void> {
  const safeId = encodeURIComponent(projectId.trim());
  const safeEnvId = encodeURIComponent(environmentId.trim());
  const safeVarId = encodeURIComponent(variableId.trim());
  return apiFetch<void>(`/projects/${safeId}/environments/${safeEnvId}/variables/${safeVarId}`, {
    method: 'DELETE',
  });
}

/**
 * Phase 7 — Triggers a deterministic rollback for a deployment.
 */
export async function rollbackDeployment(
  projectId: string,
  deploymentId: string,
  data?: RollbackRequest,
): Promise<RollbackResponse> {
  const safeId = encodeURIComponent(projectId.trim());
  const safeDepId = encodeURIComponent(deploymentId.trim());
  return apiFetch<RollbackResponse>(`/projects/${safeId}/deployments/${safeDepId}/rollback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data || {}),
  });
}

/**
 * Phase 7 — Gets CI/CD settings for a project.
 */
export async function getCicdSettings(
  projectId: string,
): Promise<CicdSettingsResponse> {
  const safeId = encodeURIComponent(projectId.trim());
  return apiFetch<CicdSettingsResponse>(`/projects/${safeId}/cicd/settings`, {
    method: 'GET',
  });
}

/**
 * Phase 7 — Updates CI/CD settings.
 */
export async function updateCicdSettings(
  projectId: string,
  data: UpdateCicdSettingsRequest,
): Promise<CicdSettingsResponse> {
  const safeId = encodeURIComponent(projectId.trim());
  return apiFetch<CicdSettingsResponse>(`/projects/${safeId}/cicd/settings`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

/**
 * Phase 7 — Gets recent webhook delivery events for auditing.
 */
export async function getWebhookEvents(
  projectId: string,
  limit?: number,
): Promise<WebhookEventsListResponse> {
  const safeId = encodeURIComponent(projectId.trim());
  return apiFetch<WebhookEventsListResponse>(`/projects/${safeId}/cicd/webhook-events${limit ? `?limit=${limit}` : ''}`, {
    method: 'GET',
  });
}






