export type ProjectType =
  | 'WEB_APPLICATION'
  | 'PYTHON_APPLICATION'
  | 'JAVA_APPLICATION'
  | 'GO_APPLICATION'
  | 'DOCKER_APPLICATION'
  | 'UNKNOWN';

export type ApplicationRole =
  | 'FRONTEND'
  | 'BACKEND'
  | 'FULLSTACK'
  | 'API'
  | 'WORKER'
  | 'CLI'
  | 'LIBRARY'
  | 'SERVICE'
  | 'UNKNOWN';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface DetectedEntryPoint {
  path: string;
  isDefault: boolean;
  evidence: string;
}

export interface DetectedCommand {
  command: string;
  isDeclared: boolean;
  source: string;
}

export interface DetectedPort {
  port: number;
  source: string;
  confidence: ConfidenceLevel;
}

export interface DetectedOutputDirectory {
  path: string;
  isConfigured: boolean;
  source: string;
}

export interface DetectedApplication {
  name: string;
  path: string;
  role: ApplicationRole;
  framework: string | null;
  language: string | null;
  packageManager: string | null;
  entryPoint: DetectedEntryPoint | null;
  buildCommand: DetectedCommand | null;
  startCommand: DetectedCommand | null;
  port: DetectedPort | null;
  outputDirectory: DetectedOutputDirectory | null;
  confidence: ConfidenceLevel;
  evidence: string[];
}

export interface ApplicationRelationship {
  source: string;
  target: string;
  relationshipType: 'PROXY' | 'CLIENT_SERVER' | 'SHARED_PACKAGE' | 'UNKNOWN';
  evidence: string[];
}

export interface ApplicationStructureDto {
  primaryRole: ApplicationRole;
  confidence: ConfidenceLevel;
  applications: DetectedApplication[];
  relationships: ApplicationRelationship[];
  topLevelEntryPoint: DetectedEntryPoint | null;
  topLevelBuildCommand: DetectedCommand | null;
  topLevelStartCommand: DetectedCommand | null;
  topLevelPort: DetectedPort | null;
  topLevelOutputDirectory: DetectedOutputDirectory | null;
  detectedEnvironmentVariables?: DeploymentRequirement[];
  evidence: string[];
  detectedAt?: string;
}

export interface ApplicationStructureResponse {
  structure: ApplicationStructureDto;
}

export type DeploymentReadinessStatus =
  | 'READY'
  | 'READY_WITH_WARNINGS'
  | 'BLOCKED'
  | 'UNKNOWN';

export type DeploymentStrategy =
  | 'STATIC_FRONTEND'
  | 'NODE_APPLICATION'
  | 'PYTHON_APPLICATION'
  | 'JAVA_APPLICATION'
  | 'GO_APPLICATION'
  | 'DOCKER_APPLICATION'
  | 'MULTI_APPLICATION'
  | 'UNSUPPORTED'
  | 'UNKNOWN';

export type ReadinessSeverity = 'BLOCKER' | 'WARNING' | 'INFO';

export interface DeploymentBlocker {
  code: string;
  message: string;
  category: string;
  evidence?: string[];
}

export interface DeploymentWarning {
  code: string;
  message: string;
  category: string;
  evidence?: string[];
}

export interface DeploymentRequirement {
  name: string;
  required: boolean;
  documented: boolean;
  source: string;
  confidence?: ConfidenceLevel;
  defaultValue?: string;
  description?: string;
}

export interface DeploymentRecommendation {
  message: string;
  action: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface ScoreBreakdown {
  applicationIdentity: number;
  buildReadiness: number;
  runtimeReadiness: number;
  portReadiness: number;
  outputArtifactReadiness: number;
  environmentConfiguration: number;
  deploymentStrategy: number;
}

export interface SubApplicationReadiness {
  name: string;
  path: string;
  strategy: DeploymentStrategy;
  status: DeploymentReadinessStatus;
  score: number;
}

export interface DeploymentReadinessDto {
  status: DeploymentReadinessStatus;
  score: number; // 0 to 100
  strategy: DeploymentStrategy;
  summary: string;
  blockers: DeploymentBlocker[];
  warnings: DeploymentWarning[];
  requirements: DeploymentRequirement[];
  recommendations: DeploymentRecommendation[];
  scoreBreakdown: ScoreBreakdown;
  subApplicationsReadiness?: SubApplicationReadiness[];
  evaluatedAt?: string;
}

export interface DeploymentReadinessResponse {
  readiness: DeploymentReadinessDto;
}

export interface RepositoryAnalysisDto {
  id: string;
  projectId: string;
  projectType: ProjectType;
  primaryLanguage: string | null;
  framework: string | null;
  packageManager: string | null;
  isMonorepo: boolean | null;
  hasDockerfile: boolean;
  hasDockerCompose: boolean;
  hasEnvExample: boolean;
  detectedFiles: string[];
  structure?: ApplicationStructureDto | null;
  readiness?: DeploymentReadinessDto | null;
  analysisVersion: string;
  createdAt: string;
  updatedAt: string;
}

export interface RepositoryAnalysisResponse {
  analysis: RepositoryAnalysisDto;
}


