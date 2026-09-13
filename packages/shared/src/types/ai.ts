export type AiConfidenceLevel = 'CONFIRMED' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

export type AiRepairRisk = 'LOW' | 'MEDIUM' | 'HIGH';

export type AiRepairStatus = 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'APPLIED';

export type AiDiagnosisCategory = 'BUILD' | 'INCIDENT';

/**
 * Structured AI Repository Understanding response
 */
export interface AiRepositoryUnderstanding {
  summary: string;
  technology: {
    primaryLanguage: string;
    framework: string;
    packageManager: string;
    projectType: string;
  };
  architecture: {
    role: 'FRONTEND' | 'BACKEND' | 'FULL_STACK' | 'WORKER' | 'UNKNOWN';
    components: Array<{
      name: string;
      path: string;
      role: string;
      description: string;
    }>;
    isMonorepo: boolean;
  };
  buildAndRun: {
    buildSystem: string;
    recommendedBuildCommand: string;
    recommendedStartCommand: string;
    outputDirectory?: string;
  };
  deployment: {
    expectedRuntime: string;
    expectedPort: number;
    healthCheckPath: string;
  };
  potentialRisks: Array<{
    category: 'CONFIGURATION' | 'DEPENDENCY' | 'PORT' | 'SECURITY' | 'PERFORMANCE';
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    description: string;
  }>;
  confidence: AiConfidenceLevel;
  evidenceSummary: string[];
  analyzedAt: string;
  modelIdentifier: string;
}

/**
 * AI Deployment Configuration Proposal
 */
export interface AiDeploymentProposal {
  strategy: string;
  suggestedDockerfile?: string;
  dockerfileExplanation?: string;
  buildCommand?: string;
  startCommand?: string;
  exposedPort: number;
  healthCheckPath: string;
  healthCheckStrategy: 'HTTP' | 'PROCESS';
  requiredEnvVars: string[];
  validation: {
    isValid: boolean;
    issues: string[];
    securityPassed: boolean;
  };
  confidence: AiConfidenceLevel;
  modelIdentifier: string;
  proposedAt: string;
}

/**
 * Structured Evidence Item distinguishing factual data from inference
 */
export interface AiEvidenceItem {
  type: 'FACT' | 'INFERENCE';
  source: 'LOGS' | 'MANIFEST' | 'TELEMETRY' | 'EVENT' | 'STRUCTURE' | 'METRICS';
  content: string;
}

/**
 * AI Build / Incident Failure Diagnosis
 */
export interface AiFailureDiagnosis {
  category: AiDiagnosisCategory;
  problem: string;
  likelyCause: string;
  affectedComponent: string;
  evidence: AiEvidenceItem[];
  recommendation: string;
  confidence: AiConfidenceLevel;
  confidenceRationale: string;
  diagnosedAt: string;
  modelIdentifier: string;
}

/**
 * Structured AI Repair Suggestion
 */
export interface AiRepairSuggestion {
  id: string;
  projectId: string;
  deploymentId?: string;
  title: string;
  problem: string;
  proposedChange: {
    type: 'ENVIRONMENT_VARIABLE' | 'DOCKERFILE' | 'BUILD_COMMAND' | 'START_COMMAND' | 'PORT' | 'CONFIG_FILE';
    target: string;
    content?: string;
    diffPreview?: string;
  };
  reasoning: string;
  risk: AiRepairRisk;
  requiresHumanApproval: boolean;
  status: AiRepairStatus;
  evidence: AiEvidenceItem[];
  confidence: AiConfidenceLevel;
  validationRequirements: string[];
  createdAt: string;
  updatedAt: string;
  modelIdentifier: string;
}

/**
 * CloudPilot Agent Tool Definition & Invocations
 */
export type AiAgentToolName =
  | 'inspectRepository'
  | 'getRepositoryAnalysis'
  | 'getApplicationStructure'
  | 'getDeploymentReadiness'
  | 'getDeployment'
  | 'getDeploymentLogs'
  | 'getDeploymentEvents'
  | 'getDeploymentMetrics'
  | 'getHealthStatus';

export interface AiToolInvocation {
  tool: AiAgentToolName;
  input: Record<string, any>;
  output: Record<string, any>;
  timestamp: string;
}

export interface AiAgentStep {
  thought: string;
  toolCall?: {
    tool: AiAgentToolName;
    input: Record<string, any>;
  };
  toolResult?: Record<string, any>;
}

export interface AiAgentRequest {
  prompt: string;
  deploymentId?: string;
}

export interface AiAgentResponse {
  answer: string;
  steps: AiAgentStep[];
  toolsUsed: AiAgentToolName[];
  confidence: AiConfidenceLevel;
  evidenceGathered: AiEvidenceItem[];
  completedAt: string;
  modelIdentifier: string;
}

/**
 * API Response Wrappers
 */
export interface AiRepositoryUnderstandingResponse {
  understanding: AiRepositoryUnderstanding;
}

export interface AiDeploymentProposalResponse {
  proposal: AiDeploymentProposal;
}

export interface AiDiagnosisResponse {
  diagnosis: AiFailureDiagnosis;
}

export interface AiRepairSuggestionsResponse {
  suggestions: AiRepairSuggestion[];
}

export interface AiRepairSuggestionActionResponse {
  suggestion: AiRepairSuggestion;
  message: string;
}
