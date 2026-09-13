'use client';

import React, { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ProjectDto,
  UserDto,
  RepositoryAnalysisDto,
  DeploymentDto,
  DeploymentPlan,
  DeploymentLogEntry,
  DeploymentTelemetrySummary,
  ContainerMetricsSnapshot,
  DeploymentEventDto,
  AiRepositoryUnderstanding,
  AiDeploymentProposal,
  AiFailureDiagnosis,
  AiRepairSuggestion,
  AiAgentResponse,
  EnvironmentDto,
  EnvironmentVariableDto,
  GithubWebhookEventDto,
  CicdSettingsDto,
  RollbackResponse,
} from '@cloudpilot/shared';
import {
  getCurrentUser,
  getProject,
  deleteProject,
  analyzeProject,
  getProjectAnalysis,
  analyzeProjectStructure,
  analyzeProjectReadiness,
  getDeploymentPlan,
  createDeployment,
  cancelDeployment,
  getDeployments,
  getDeploymentLogs,
  getDeploymentTelemetry,
  collectDeploymentMetrics,
  getDeploymentTailLogs,
  getDeploymentEvents,
  getAiRepositoryUnderstanding,
  getAiDeploymentProposal,
  diagnoseAiBuildFailure,
  diagnoseAiIncident,
  getAiRepairSuggestions,
  approveAiRepairSuggestion,
  rejectAiRepairSuggestion,
  runAiAgent,
  getEnvironments,
  createEnvironment,
  updateEnvironment,
  deleteEnvironment,
  getEnvironmentVariables,
  setEnvironmentVariable,
  deleteEnvironmentVariable,
  rollbackDeployment,
  getCicdSettings,
  updateCicdSettings,
  getWebhookEvents,
  logout,
  ApiClientError,
} from '@/lib/api';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import {
  ArrowLeft,
  Lock,
  Globe,
  GitBranch,
  ExternalLink,
  Copy,
  Check,
  Trash2,
  AlertCircle,
  FolderGit2,
  RefreshCw,
  Search,
  Loader2,
  FileCode2,
  Cpu,
  Layers,
  Terminal,
  Play,
  Square,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Rocket,
  Code2,
  Package,
  Sparkles,
  BarChart3,
  Gauge,
  Radio,
  HardDrive,
  Zap,
  AlertTriangle,
  Bell,
  ShieldAlert,
  Bot,
  BrainCircuit,
  Wrench,
  HelpCircle,
  ThumbsUp,
  ThumbsDown,
  CheckCheck,
  FileText,
  RotateCcw,
  Shield,
  Plus,
  KeyRound,
  GitPullRequest,
  Workflow,
  History,
} from 'lucide-react';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function ProjectDetailPage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const { id: projectId } = resolvedParams;

  // Auth & User State
  const [user, setUser] = useState<UserDto | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);

  // Project Data
  const [project, setProject] = useState<ProjectDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState<boolean>(false);

  // Repository Intelligence Analysis State
  const [analysis, setAnalysis] = useState<RepositoryAnalysisDto | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isAnalyzingStructure, setIsAnalyzingStructure] = useState<boolean>(false);
  const [isAnalyzingReadiness, setIsAnalyzingReadiness] = useState<boolean>(false);
  const [analysisSuccessMessage, setAnalysisSuccessMessage] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Phase 4 Deployment Engine State
  const [deployments, setDeployments] = useState<DeploymentDto[]>([]);
  const [deploymentPlan, setDeploymentPlan] = useState<DeploymentPlan | null>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState<boolean>(false);
  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  const [isCancellingId, setIsCancellingId] = useState<string | null>(null);
  const [logsModalData, setLogsModalData] = useState<{ deploymentId: string; logs: DeploymentLogEntry[] } | null>(null);
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(false);
  const [deploymentSuccessMessage, setDeploymentSuccessMessage] = useState<string | null>(null);
  const [deploymentError, setDeploymentError] = useState<string | null>(null);

  // Phase 5 Observability & Telemetry State
  const [telemetry, setTelemetry] = useState<DeploymentTelemetrySummary | null>(null);
  const [isLoadingTelemetry, setIsLoadingTelemetry] = useState<boolean>(false);
  const [isCollectingMetrics, setIsCollectingMetrics] = useState<boolean>(false);
  const [autoRefreshTelemetry, setAutoRefreshTelemetry] = useState<boolean>(true);
  const [liveLogSearch, setLiveLogSearch] = useState<string>('');
  const [liveLogLevel, setLiveLogLevel] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR'>('ALL');
  const [observabilitySuccessMessage, setObservabilitySuccessMessage] = useState<string | null>(null);
  const [observabilityError, setObservabilityError] = useState<string | null>(null);

  // Phase 6 AI Intelligence & Agent State
  const [aiUnderstanding, setAiUnderstanding] = useState<AiRepositoryUnderstanding | null>(null);
  const [isLoadingAiUnderstanding, setIsLoadingAiUnderstanding] = useState<boolean>(false);
  const [aiProposal, setAiProposal] = useState<AiDeploymentProposal | null>(null);
  const [isLoadingAiProposal, setIsLoadingAiProposal] = useState<boolean>(false);
  const [aiDiagnosis, setAiDiagnosis] = useState<AiFailureDiagnosis | null>(null);
  const [isLoadingAiDiagnosis, setIsLoadingAiDiagnosis] = useState<boolean>(false);
  const [aiRepairSuggestions, setAiRepairSuggestions] = useState<AiRepairSuggestion[]>([]);
  const [isLoadingAiRepairs, setIsLoadingAiRepairs] = useState<boolean>(false);
  const [isApprovingRepairId, setIsApprovingRepairId] = useState<string | null>(null);
  const [isRejectingRepairId, setIsRejectingRepairId] = useState<string | null>(null);
  const [aiAgentPrompt, setAiAgentPrompt] = useState<string>('');
  const [aiAgentResponse, setAiAgentResponse] = useState<AiAgentResponse | null>(null);
  const [isAgentRunning, setIsAgentRunning] = useState<boolean>(false);
  const [aiSuccessMessage, setAiSuccessMessage] = useState<string | null>(null);
  const [aiErrorMessage, setAiErrorMessage] = useState<string | null>(null);

  // Phase 7 CI/CD, Environments & Rollback State
  const [environments, setEnvironments] = useState<EnvironmentDto[]>([]);
  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(null);
  const [envVariables, setEnvVariables] = useState<EnvironmentVariableDto[]>([]);
  const [isLoadingEnvironments, setIsLoadingEnvironments] = useState<boolean>(false);
  const [isLoadingVariables, setIsLoadingVariables] = useState<boolean>(false);
  const [showAddVarModal, setShowAddVarModal] = useState<boolean>(false);
  const [newVarKey, setNewVarKey] = useState<string>('');
  const [newVarVal, setNewVarVal] = useState<string>('');
  const [newVarIsSecret, setNewVarIsSecret] = useState<boolean>(true);
  const [isSavingVar, setIsSavingVar] = useState<boolean>(false);
  const [isDeletingVarId, setIsDeletingVarId] = useState<string | null>(null);
  const [editingBranchPattern, setEditingBranchPattern] = useState<string>('');
  const [cicdSettings, setCicdSettings] = useState<CicdSettingsDto | null>(null);
  const [webhookSecretInput, setWebhookSecretInput] = useState<string>('');
  const [isUpdatingWebhookSecret, setIsUpdatingWebhookSecret] = useState<boolean>(false);
  const [webhookEvents, setWebhookEvents] = useState<GithubWebhookEventDto[]>([]);
  const [isLoadingWebhookEvents, setIsLoadingWebhookEvents] = useState<boolean>(false);
  const [rollbackTargetDeployment, setRollbackTargetDeployment] = useState<DeploymentDto | null>(null);
  const [showRollbackModal, setShowRollbackModal] = useState<boolean>(false);
  const [isExecutingRollback, setIsExecutingRollback] = useState<boolean>(false);
  const [cicdSuccessMessage, setCicdSuccessMessage] = useState<string | null>(null);
  const [cicdErrorMessage, setCicdErrorMessage] = useState<string | null>(null);

  // Disconnect Confirmation State
  const [showDisconnectModal, setShowDisconnectModal] = useState<boolean>(false);
  const [isDisconnecting, setIsDisconnecting] = useState<boolean>(false);

  // Copy Feedback State
  const [copiedType, setCopiedType] = useState<'https' | 'ssh' | null>(null);

  // 1. Verify User Session on Mount
  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      try {
        const data = await getCurrentUser();
        if (isMounted) {
          setUser(data.user);
        }
      } catch {
        if (isMounted) {
          router.replace('/');
        }
      } finally {
        if (isMounted) {
          setIsAuthLoading(false);
        }
      }
    }

    loadUser();

    return () => {
      isMounted = false;
    };
  }, [router]);

  // 2. Fetch Project Details & Existing Analysis
  const loadProject = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setIsNotFound(false);

    try {
      const response = await getProject(projectId);
      setProject(response.project);

      // Try loading existing analysis
      try {
        const analysisRes = await getProjectAnalysis(projectId);
        setAnalysis(analysisRes.analysis);
      } catch (err: any) {
        // 404 is normal if project has not been analyzed yet
        if (err?.status !== 404) {
          console.warn('Could not load analysis:', err);
        }
      }

      // Try loading deployments (Phase 4)
      try {
        const depRes = await getDeployments(projectId);
        setDeployments(depRes.deployments);
      } catch (err: any) {
        if (err?.status !== 404) {
          console.warn('Could not load deployments:', err);
        }
      }

      // Try loading environments (Phase 7)
      try {
        const envRes = await getEnvironments(projectId);
        setEnvironments(envRes.environments);
        if (envRes.environments.length > 0) {
          setSelectedEnvId((prev) => {
            if (prev && envRes.environments.some((e) => e.id === prev)) return prev;
            const prod = envRes.environments.find((e) => e.name === 'production' || e.type === 'PRODUCTION');
            return prod ? prod.id : envRes.environments[0].id;
          });
        }
      } catch (err: any) {
        if (err?.status !== 404) {
          console.warn('Could not load environments:', err);
        }
      }

      // Try loading CI/CD settings (Phase 7)
      try {
        const cicdRes = await getCicdSettings(projectId);
        setCicdSettings(cicdRes.settings);
      } catch (err: any) {
        if (err?.status !== 404) {
          console.warn('Could not load CI/CD settings:', err);
        }
      }

      // Try loading Webhook Events (Phase 7)
      try {
        const webhookRes = await getWebhookEvents(projectId, 20);
        setWebhookEvents(webhookRes.events);
      } catch (err: any) {
        if (err?.status !== 404) {
          console.warn('Could not load webhook events:', err);
        }
      }
    } catch (err: any) {
      if (err instanceof ApiClientError) {
        if (err.status === 401) {
          router.replace('/');
          return;
        }
        if (err.status === 404) {
          setIsNotFound(true);
          return;
        }
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to load project details. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [projectId, router]);

  useEffect(() => {
    if (user) {
      loadProject();
    }
  }, [user, loadProject]);

  // Handle Triggering Static Repository Analysis
  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisSuccessMessage(null);

    try {
      const response = await analyzeProject(projectId);
      setAnalysis(response.analysis);
      setAnalysisSuccessMessage('Repository analyzed successfully');
    } catch (err: any) {
      if (err instanceof ApiClientError) {
        setAnalysisError(err.message);
      } else {
        setAnalysisError('Unable to analyze repository. Please try again.');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle Triggering Phase 3.3 Application Structure Detection
  const handleAnalyzeStructure = async () => {
    setIsAnalyzingStructure(true);
    setAnalysisError(null);
    setAnalysisSuccessMessage(null);

    try {
      const response = await analyzeProjectStructure(projectId);
      if (analysis) {
        setAnalysis({
          ...analysis,
          structure: response.structure,
        });
      }
      setAnalysisSuccessMessage('Application structure detected successfully');
    } catch (err: any) {
      if (err instanceof ApiClientError) {
        setAnalysisError(err.message);
      } else {
        setAnalysisError('Unable to detect application structure. Please try again.');
      }
    } finally {
      setIsAnalyzingStructure(false);
    }
  };

  // Handle Triggering Phase 3.4 Deployment Readiness Analysis
  const handleAnalyzeReadiness = async () => {
    setIsAnalyzingReadiness(true);
    setAnalysisError(null);
    setAnalysisSuccessMessage(null);

    try {
      const response = await analyzeProjectReadiness(projectId);
      if (analysis) {
        setAnalysis({
          ...analysis,
          readiness: response.readiness,
        });
      }
      setAnalysisSuccessMessage('Deployment readiness evaluated successfully');
    } catch (err: any) {
      if (err instanceof ApiClientError) {
        setAnalysisError(err.message);
      } else {
        setAnalysisError('Unable to evaluate deployment readiness. Please try again.');
      }
    } finally {
      setIsAnalyzingReadiness(false);
    }
  };

  // Handle Generating Phase 4 Deployment Plan
  const handleGeneratePlan = async () => {
    setIsGeneratingPlan(true);
    setDeploymentError(null);
    setDeploymentSuccessMessage(null);

    try {
      const response = await getDeploymentPlan(projectId);
      setDeploymentPlan(response.plan);
      setDeploymentSuccessMessage('Deployment plan generated successfully.');
    } catch (err: any) {
      if (err instanceof ApiClientError) {
        setDeploymentError(err.message);
      } else {
        setDeploymentError('Unable to generate deployment plan. Please try again.');
      }
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  // Handle Triggering Phase 4 Deployment
  const handleDeploy = async () => {
    setIsDeploying(true);
    setDeploymentError(null);
    setDeploymentSuccessMessage(null);

    try {
      const response = await createDeployment(projectId, selectedEnvId || undefined);
      setDeployments((prev) => [response.deployment, ...prev]);
      setDeploymentSuccessMessage('Deployment initiated! Container build & run in progress.');

      // Poll deployments after 3s and 8s to update live progress
      setTimeout(async () => {
        try {
          const updated = await getDeployments(projectId);
          setDeployments(updated.deployments);
        } catch {}
      }, 3000);

      setTimeout(async () => {
        try {
          const updated = await getDeployments(projectId);
          setDeployments(updated.deployments);
        } catch {}
      }, 8000);
    } catch (err: any) {
      if (err instanceof ApiClientError) {
        setDeploymentError(err.message);
      } else {
        setDeploymentError('Unable to trigger deployment. Please try again.');
      }
    } finally {
      setIsDeploying(false);
    }
  };

  // Handle Cancelling an Active Deployment
  const handleCancelDeployment = async (deploymentId: string) => {
    setIsCancellingId(deploymentId);
    setDeploymentError(null);

    try {
      const response = await cancelDeployment(projectId, deploymentId);
      setDeployments((prev) => prev.map((d) => (d.id === deploymentId ? response.deployment : d)));
      setDeploymentSuccessMessage('Deployment cancelled successfully.');
    } catch (err: any) {
      if (err instanceof ApiClientError) {
        setDeploymentError(err.message);
      } else {
        setDeploymentError('Unable to cancel deployment.');
      }
    } finally {
      setIsCancellingId(null);
    }
  };

  // Handle Viewing Deployment Logs
  const handleViewLogs = async (deploymentId: string) => {
    setIsLoadingLogs(true);
    setDeploymentError(null);

    try {
      const res = await getDeploymentLogs(projectId, deploymentId);
      setLogsModalData({ deploymentId, logs: res.logs });
    } catch (err: any) {
      setDeploymentError('Unable to fetch deployment logs.');
    } finally {
      setIsLoadingLogs(false);
    }
  };

  // Phase 5: Fetch Live Telemetry
  const handleFetchTelemetry = useCallback(async (deploymentId: string) => {
    setIsLoadingTelemetry(true);
    setObservabilityError(null);

    try {
      const res = await getDeploymentTelemetry(projectId, deploymentId);
      setTelemetry(res.telemetry);
    } catch (err: any) {
      if (err instanceof ApiClientError) {
        setObservabilityError(err.message);
      } else {
        setObservabilityError('Unable to fetch telemetry data.');
      }
    } finally {
      setIsLoadingTelemetry(false);
    }
  }, [projectId]);

  // Phase 5: On-Demand Metrics Collection
  const handleCollectMetrics = async (deploymentId: string) => {
    setIsCollectingMetrics(true);
    setObservabilityError(null);

    try {
      await collectDeploymentMetrics(projectId, deploymentId);
      const res = await getDeploymentTelemetry(projectId, deploymentId);
      setTelemetry(res.telemetry);
      setObservabilitySuccessMessage('Live container metrics collected successfully.');
      setTimeout(() => setObservabilitySuccessMessage(null), 3000);
    } catch (err: any) {
      if (err instanceof ApiClientError) {
        setObservabilityError(err.message);
      } else {
        setObservabilityError('Unable to collect live container metrics.');
      }
    } finally {
      setIsCollectingMetrics(false);
    }
  };

  // Phase 5: Auto-refresh Telemetry when Running deployment exists
  useEffect(() => {
    const latest = deployments[0];
    if (!latest) return;

    if (latest.status === 'RUNNING' || latest.containerName) {
      handleFetchTelemetry(latest.id);
    }

    if (!autoRefreshTelemetry || latest.status !== 'RUNNING') return;

    const interval = setInterval(() => {
      handleFetchTelemetry(latest.id);
    }, 5000);

    return () => clearInterval(interval);
  }, [deployments, autoRefreshTelemetry, handleFetchTelemetry]);


  // Phase 6 AI: Explain Project with AI
  const handleExplainProject = async () => {
    setIsLoadingAiUnderstanding(true);
    setAiErrorMessage(null);
    setAiSuccessMessage(null);
    try {
      const res = await getAiRepositoryUnderstanding(projectId);
      setAiUnderstanding(res.understanding);
      setAiSuccessMessage('AI repository understanding generated successfully.');
    } catch (err: any) {
      setAiErrorMessage(err.message || 'Failed to generate AI understanding.');
    } finally {
      setIsLoadingAiUnderstanding(false);
    }
  };

  // Phase 6 AI: Generate Deployment Proposal
  const handleGenerateAiProposal = async () => {
    setIsLoadingAiProposal(true);
    setAiErrorMessage(null);
    setAiSuccessMessage(null);
    try {
      const res = await getAiDeploymentProposal(projectId);
      setAiProposal(res.proposal);
      setAiSuccessMessage('AI deployment configuration generated & validated.');
    } catch (err: any) {
      setAiErrorMessage(err.message || 'Failed to generate deployment proposal.');
    } finally {
      setIsLoadingAiProposal(false);
    }
  };

  // Phase 6 AI: Diagnose Build / Incident Failure
  const handleDiagnoseDeployment = async (deploymentId: string, isBuildFailure: boolean) => {
    setIsLoadingAiDiagnosis(true);
    setAiErrorMessage(null);
    setAiSuccessMessage(null);
    try {
      const res = isBuildFailure
        ? await diagnoseAiBuildFailure(projectId, deploymentId)
        : await diagnoseAiIncident(projectId, deploymentId);
      setAiDiagnosis(res.diagnosis);
      setAiSuccessMessage('AI diagnosis completed.');
      // Also fetch repair suggestions
      handleFetchRepairSuggestions(deploymentId);
    } catch (err: any) {
      setAiErrorMessage(err.message || 'Failed to diagnose deployment.');
    } finally {
      setIsLoadingAiDiagnosis(false);
    }
  };

  // Phase 6 AI: Fetch Repair Suggestions
  const handleFetchRepairSuggestions = async (deploymentId: string) => {
    setIsLoadingAiRepairs(true);
    try {
      const res = await getAiRepairSuggestions(projectId, deploymentId);
      setAiRepairSuggestions(res.suggestions);
    } catch (err: any) {
      console.warn('Could not fetch repair suggestions:', err);
    } finally {
      setIsLoadingAiRepairs(false);
    }
  };

  // Phase 6 AI: Approve Repair Suggestion
  const handleApproveRepair = async (suggestionId: string) => {
    setIsApprovingRepairId(suggestionId);
    setAiErrorMessage(null);
    try {
      const res = await approveAiRepairSuggestion(projectId, suggestionId);
      setAiRepairSuggestions((prev) =>
        prev.map((s) => (s.id === suggestionId ? res.suggestion : s)),
      );
      setAiSuccessMessage('Repair suggestion approved! Review parameters before redeploying.');
    } catch (err: any) {
      setAiErrorMessage(err.message || 'Failed to approve suggestion.');
    } finally {
      setIsApprovingRepairId(null);
    }
  };

  // Phase 6 AI: Reject Repair Suggestion
  const handleRejectRepair = async (suggestionId: string) => {
    setIsRejectingRepairId(suggestionId);
    setAiErrorMessage(null);
    try {
      const res = await rejectAiRepairSuggestion(projectId, suggestionId);
      setAiRepairSuggestions((prev) =>
        prev.map((s) => (s.id === suggestionId ? res.suggestion : s)),
      );
      setAiSuccessMessage('Repair suggestion rejected.');
    } catch (err: any) {
      setAiErrorMessage(err.message || 'Failed to reject suggestion.');
    } finally {
      setIsRejectingRepairId(null);
    }
  };

  // Phase 6 AI: Run Interactive Agent
  const handleRunAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiAgentPrompt.trim() || isAgentRunning) return;

    setIsAgentRunning(true);
    setAiErrorMessage(null);
    try {
      const res = await runAiAgent(projectId, {
        prompt: aiAgentPrompt.trim(),
        deploymentId: deployments[0]?.id,
      });
      setAiAgentResponse(res);
    } catch (err: any) {
      setAiErrorMessage(err.message || 'AI agent execution failed.');
    } finally {
      setIsAgentRunning(false);
    }
  };

  // Phase 7: Fetch Environment Variables when selected environment changes
  useEffect(() => {
    if (!selectedEnvId) return;
    let isMounted = true;
    setIsLoadingVariables(true);

    getEnvironmentVariables(projectId, selectedEnvId)
      .then((res) => {
        if (isMounted) {
          setEnvVariables(res.variables);
        }
      })
      .catch((err) => {
        console.warn('Could not load environment variables:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingVariables(false);
      });

    return () => {
      isMounted = false;
    };
  }, [projectId, selectedEnvId]);

  // Phase 7: Update Environment Settings (branchPattern, autoDeploy, autoRollback)
  const handleUpdateEnvironment = async (
    envId: string,
    updates: { branchPattern?: string; autoDeployEnabled?: boolean; autoRollbackEnabled?: boolean },
  ) => {
    setCicdErrorMessage(null);
    setCicdSuccessMessage(null);
    try {
      const res = await updateEnvironment(projectId, envId, updates);
      setEnvironments((prev) => prev.map((e) => (e.id === envId ? res.environment : e)));
      setCicdSuccessMessage(`Environment '${res.environment.name}' updated successfully.`);
      setTimeout(() => setCicdSuccessMessage(null), 3000);
    } catch (err: any) {
      setCicdErrorMessage(err.message || 'Failed to update environment settings.');
    }
  };

  // Phase 7: Set Environment Variable
  const handleSetVariable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnvId || !newVarKey.trim() || !newVarVal) return;

    setIsSavingVar(true);
    setCicdErrorMessage(null);
    setCicdSuccessMessage(null);
    try {
      const res = await setEnvironmentVariable(projectId, selectedEnvId, {
        key: newVarKey.trim(),
        value: newVarVal,
        isSecret: newVarIsSecret,
      });

      setEnvVariables((prev) => {
        const existingIdx = prev.findIndex((v) => v.id === res.variable.id);
        if (existingIdx !== -1) {
          const copy = [...prev];
          copy[existingIdx] = res.variable;
          return copy;
        }
        return [...prev, res.variable];
      });

      // Update variables count in environments state
      setEnvironments((prev) =>
        prev.map((env) =>
          env.id === selectedEnvId
            ? { ...env, variablesCount: (env.variablesCount || 0) + 1 }
            : env,
        ),
      );

      setNewVarKey('');
      setNewVarVal('');
      setNewVarIsSecret(true);
      setShowAddVarModal(false);
      setCicdSuccessMessage(`Variable '${res.variable.key}' saved and encrypted.`);
      setTimeout(() => setCicdSuccessMessage(null), 3000);
    } catch (err: any) {
      setCicdErrorMessage(err.message || 'Failed to save environment variable.');
    } finally {
      setIsSavingVar(false);
    }
  };

  // Phase 7: Delete Environment Variable
  const handleDeleteVariable = async (varId: string, varKey: string) => {
    if (!selectedEnvId) return;
    setIsDeletingVarId(varId);
    setCicdErrorMessage(null);
    setCicdSuccessMessage(null);
    try {
      await deleteEnvironmentVariable(projectId, selectedEnvId, varId);
      setEnvVariables((prev) => prev.filter((v) => v.id !== varId));
      setEnvironments((prev) =>
        prev.map((env) =>
          env.id === selectedEnvId
            ? { ...env, variablesCount: Math.max(0, (env.variablesCount || 1) - 1) }
            : env,
        ),
      );
      setCicdSuccessMessage(`Variable '${varKey}' deleted.`);
      setTimeout(() => setCicdSuccessMessage(null), 3000);
    } catch (err: any) {
      setCicdErrorMessage(err.message || 'Failed to delete variable.');
    } finally {
      setIsDeletingVarId(null);
    }
  };

  // Phase 7: Save Webhook Secret
  const handleSaveWebhookSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingWebhookSecret(true);
    setCicdErrorMessage(null);
    setCicdSuccessMessage(null);
    try {
      const res = await updateCicdSettings(projectId, {
        webhookSecret: webhookSecretInput.trim() || undefined,
      });
      setCicdSettings(res.settings);
      setWebhookSecretInput('');
      setCicdSuccessMessage('CI/CD Webhook Secret updated successfully.');
      setTimeout(() => setCicdSuccessMessage(null), 3000);
    } catch (err: any) {
      setCicdErrorMessage(err.message || 'Failed to update Webhook Secret.');
    } finally {
      setIsUpdatingWebhookSecret(false);
    }
  };

  // Phase 7: Open Rollback Modal
  const handleOpenRollbackModal = (targetDep: DeploymentDto) => {
    setRollbackTargetDeployment(targetDep);
    setShowRollbackModal(true);
    setCicdErrorMessage(null);
  };

  // Phase 7: Execute Rollback
  const handleExecuteRollback = async () => {
    if (!rollbackTargetDeployment) return;
    const latestDep = deployments[0];
    if (!latestDep) return;

    setIsExecutingRollback(true);
    setCicdErrorMessage(null);
    try {
      const res = await rollbackDeployment(projectId, latestDep.id, {
        targetDeploymentId: rollbackTargetDeployment.id,
      });

      setDeployments((prev) => [res.rollbackDeployment, ...prev]);
      setShowRollbackModal(false);
      setDeploymentSuccessMessage(
        `Rollback initiated! Deployment #${res.rollbackDeployment.deploymentNumber} created to restore known-healthy commit ${rollbackTargetDeployment.commitSha?.substring(0, 7) || 'target'}.`,
      );

      // Reload deployments after 3s
      setTimeout(async () => {
        try {
          const updated = await getDeployments(projectId);
          setDeployments(updated.deployments);
        } catch {}
      }, 3000);
    } catch (err: any) {
      setCicdErrorMessage(err.message || 'Rollback failed.');
    } finally {
      setIsExecutingRollback(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      router.replace('/');
    }
  };

  // Copy Helper
  const handleCopy = (text: string, type: 'https' | 'ssh') => {
    if (!navigator?.clipboard) return;
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  // Handle Disconnect Project
  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await deleteProject(projectId);
      router.replace('/dashboard');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to disconnect project');
      setIsDisconnecting(false);
      setShowDisconnectModal(false);
    }
  };

  const formatProjectType = (type?: string | null) => {
    switch (type) {
      case 'WEB_APPLICATION':
        return 'Web Application';
      case 'PYTHON_APPLICATION':
        return 'Python Application';
      case 'JAVA_APPLICATION':
        return 'Java Application';
      case 'GO_APPLICATION':
        return 'Go Application';
      case 'DOCKER_APPLICATION':
        return 'Docker Application';
      default:
        return 'Unknown Type';
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center text-slate-400">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-10 h-10 border-4 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin" />
          <p className="text-sm font-medium">Verifying CloudPilot session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col justify-between relative overflow-hidden">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[360px] bg-gradient-to-b from-blue-600/10 via-cyan-500/5 to-transparent blur-3xl pointer-events-none" />

      {/* Top Header */}
      <DashboardHeader
        user={user}
        onLogout={handleLogout}
        loggingOut={isLoggingOut}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {/* Back Link Breadcrumb */}
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-400 hover:text-cyan-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded p-1 -m-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Control Plane</span>
          </Link>
        </div>

        {/* Error State */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-300 flex items-start justify-between gap-3">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-white">Error Loading Project</p>
                <p className="text-xs text-red-300/90 mt-0.5">{errorMessage}</p>
              </div>
            </div>
            <button
              onClick={loadProject}
              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 text-xs font-semibold transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* 404 Not Found State */}
        {isNotFound ? (
          <div className="flex flex-col items-center justify-center p-16 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30">
            <div className="p-3.5 rounded-2xl bg-amber-500/10 text-amber-400 mb-4 ring-1 ring-amber-500/20">
              <FolderGit2 className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-slate-100 mb-1">Project Not Found</h2>
            <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
              The project you requested does not exist or you do not have permission to view it.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Dashboard</span>
            </Link>
          </div>
        ) : isLoading || !project ? (
          /* Loading Skeleton */
          <div className="space-y-6 animate-pulse">
            <div className="h-44 rounded-2xl border border-slate-800 bg-slate-900/40 p-8" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-48 rounded-2xl border border-slate-800 bg-slate-900/40 p-6" />
              <div className="h-48 rounded-2xl border border-slate-800 bg-slate-900/40 p-6" />
            </div>
          </div>
        ) : (
          /* Main Project Detail Content */
          <div className="space-y-8">
            {/* Header Card */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-md p-6 sm:p-8 shadow-xl">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-800/80">
                <div>
                  <div className="flex flex-wrap items-center gap-2.5 mb-2">
                    <span className="text-sm font-semibold text-slate-400">
                      {project.repositoryOwner}
                    </span>
                    <span className="text-slate-600">/</span>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                      {project.repositoryName}
                    </h1>

                    {project.private ? (
                      <span className="inline-flex items-center space-x-1 text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 font-medium">
                        <Lock className="w-3 h-3" />
                        <span>Private</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 text-[11px] px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                        <Globe className="w-3 h-3" />
                        <span>Public</span>
                      </span>
                    )}

                    <span className="inline-flex items-center space-x-1 text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-medium">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>{project.status}</span>
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 font-mono">
                    Project ID: {project.id}
                  </p>
                </div>

                {/* Header Action Buttons */}
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href={project.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                  >
                    <span>View on GitHub</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <button
                    onClick={() => setShowDisconnectModal(true)}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-red-500/15 text-slate-300 hover:text-red-400 border border-slate-700 hover:border-red-500/30 text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Disconnect Project</span>
                  </button>
                </div>
              </div>

              {/* Status Row */}
              <div className="flex flex-wrap items-center gap-x-8 gap-y-3 pt-6 text-xs text-slate-400">
                <div className="flex items-center space-x-1.5 font-mono text-cyan-400">
                  <GitBranch className="w-4 h-4" />
                  <span>Deployment Branch: <strong>{project.defaultBranch}</strong></span>
                </div>

                <div>
                  <span>Connected on: </span>
                  <strong className="text-slate-200">
                    {new Date(project.createdAt).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </strong>
                </div>
              </div>
            </div>

            {/* REPOSITORY INTELLIGENCE CARD (Phase 3.1) */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md p-6 sm:p-8 shadow-xl relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
                <div className="flex items-start space-x-3.5">
                  <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                    <Cpu className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-lg font-bold text-white tracking-tight">
                        Repository Intelligence
                      </h2>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-semibold">
                        Phase 3.1
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Automated static analysis of technology stack, frameworks, manifests, and container configurations.
                    </p>
                  </div>
                </div>

                {/* Trigger Analysis Button */}
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs font-semibold shadow-lg shadow-indigo-950/50 hover:shadow-indigo-500/20 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-60 flex-shrink-0"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Analyzing repository...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{analysis ? 'Re-analyze Repository' : 'Analyze Repository'}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Analysis Success Banner */}
              {analysisSuccessMessage && (
                <div className="mt-5 p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs flex items-center space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>{analysisSuccessMessage}</span>
                </div>
              )}

              {/* Analysis Error Banner */}
              {analysisError && (
                <div className="mt-5 p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-xs flex items-center justify-between gap-3">
                  <div className="flex items-center space-x-2.5">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <span>{analysisError}</span>
                  </div>
                  <button
                    onClick={handleAnalyze}
                    className="text-xs font-semibold text-red-200 hover:underline"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Analysis Results Display */}
              {analysis ? (
                <div className="mt-6 space-y-6">
                  {/* Key Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {/* Project Type */}
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                      <div className="flex items-center space-x-2 text-xs text-slate-400 mb-1.5">
                        <Layers className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Project Type</span>
                      </div>
                      <p className="text-sm font-bold text-white">
                        {formatProjectType(analysis.projectType)}
                      </p>
                    </div>

                    {/* Language */}
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                      <div className="flex items-center space-x-2 text-xs text-slate-400 mb-1.5">
                        <Code2 className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Primary Language</span>
                      </div>
                      <p className="text-sm font-bold text-cyan-300">
                        {analysis.primaryLanguage || 'Not detected'}
                      </p>
                    </div>

                    {/* Framework */}
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                      <div className="flex items-center space-x-2 text-xs text-slate-400 mb-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Framework</span>
                      </div>
                      <p className="text-sm font-bold text-slate-200">
                        {analysis.framework || 'None / Standard'}
                      </p>
                    </div>

                    {/* Package Manager */}
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                      <div className="flex items-center space-x-2 text-xs text-slate-400 mb-1.5">
                        <Package className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Package Manager</span>
                      </div>
                      <p className="text-sm font-bold font-mono text-emerald-300">
                        {analysis.packageManager || 'Not detected'}
                      </p>
                    </div>
                  </div>

                  {/* Structural Flags Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    {/* Monorepo */}
                    <div className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-950/40 text-xs">
                      <span className="text-slate-400">Monorepo</span>
                      <span
                        className={`font-semibold ${
                          analysis.isMonorepo ? 'text-cyan-400' : 'text-slate-500'
                        }`}
                      >
                        {analysis.isMonorepo ? 'Yes' : 'No'}
                      </span>
                    </div>

                    {/* Dockerfile */}
                    <div className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-950/40 text-xs">
                      <span className="text-slate-400">Dockerfile</span>
                      <span
                        className={`font-semibold ${
                          analysis.hasDockerfile ? 'text-emerald-400' : 'text-slate-500'
                        }`}
                      >
                        {analysis.hasDockerfile ? 'Detected' : 'Not detected'}
                      </span>
                    </div>

                    {/* Docker Compose */}
                    <div className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-950/40 text-xs">
                      <span className="text-slate-400">Docker Compose</span>
                      <span
                        className={`font-semibold ${
                          analysis.hasDockerCompose ? 'text-emerald-400' : 'text-slate-500'
                        }`}
                      >
                        {analysis.hasDockerCompose ? 'Detected' : 'Not detected'}
                      </span>
                    </div>

                    {/* .env.example */}
                    <div className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-950/40 text-xs">
                      <span className="text-slate-400">.env.example</span>
                      <span
                        className={`font-semibold ${
                          analysis.hasEnvExample ? 'text-emerald-400' : 'text-slate-500'
                        }`}
                      >
                        {analysis.hasEnvExample ? 'Detected' : 'Not detected'}
                      </span>
                    </div>
                  </div>

                  {/* Detected Files Tag Cloud */}
                  {analysis.detectedFiles && analysis.detectedFiles.length > 0 && (
                    <div className="pt-2">
                      <span className="text-[11px] font-semibold text-slate-400 block mb-2">
                        Detected Configuration & Manifest Files
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {analysis.detectedFiles.map((file, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-mono text-[11px]"
                          >
                            <FileCode2 className="w-3 h-3 text-cyan-400" />
                            <span>{file}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Phase 3.3 — Application Structure Section */}
                  <div className="pt-4 border-t border-slate-800/80">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        <Cpu className="w-4 h-4 text-indigo-400" />
                        <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                          Application Structure (Phase 3.3)
                        </h4>
                      </div>
                      <button
                        onClick={handleAnalyzeStructure}
                        disabled={isAnalyzingStructure}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-all disabled:opacity-60"
                      >
                        {isAnalyzingStructure ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                            <span>Detecting...</span>
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-3 h-3" />
                            <span>{analysis.structure ? 'Re-detect Structure' : 'Detect Structure'}</span>
                          </>
                        )}
                      </button>
                    </div>

                    {analysis.structure ? (
                      <div className="space-y-4">
                        {/* Top-Level Structure Overview */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                          {/* Role */}
                          <div className="rounded-xl border border-slate-800/80 bg-slate-950/80 p-3">
                            <span className="text-[11px] text-slate-400 block mb-1">Primary Role</span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                              {analysis.structure.primaryRole}
                            </span>
                          </div>

                          {/* Entry Point */}
                          <div className="rounded-xl border border-slate-800/80 bg-slate-950/80 p-3">
                            <span className="text-[11px] text-slate-400 block mb-1">Entry Point</span>
                            <span className="text-xs font-mono text-cyan-300 truncate block">
                              {analysis.structure.topLevelEntryPoint?.path || 'None'}
                            </span>
                          </div>

                          {/* Build Command */}
                          <div className="rounded-xl border border-slate-800/80 bg-slate-950/80 p-3">
                            <span className="text-[11px] text-slate-400 block mb-1">
                              Build {analysis.structure.topLevelBuildCommand?.isDeclared ? '(Declared)' : '(Inferred)'}
                            </span>
                            <span className="text-xs font-mono text-emerald-300 truncate block">
                              {analysis.structure.topLevelBuildCommand?.command || 'None'}
                            </span>
                          </div>

                          {/* Start Command */}
                          <div className="rounded-xl border border-slate-800/80 bg-slate-950/80 p-3">
                            <span className="text-[11px] text-slate-400 block mb-1">
                              Start {analysis.structure.topLevelStartCommand?.isDeclared ? '(Declared)' : '(Inferred)'}
                            </span>
                            <span className="text-xs font-mono text-amber-300 truncate block">
                              {analysis.structure.topLevelStartCommand?.command || 'None'}
                            </span>
                          </div>

                          {/* Port */}
                          <div className="rounded-xl border border-slate-800/80 bg-slate-950/80 p-3">
                            <span className="text-[11px] text-slate-400 block mb-1">Port</span>
                            <span className="text-xs font-mono text-purple-300 font-bold">
                              {analysis.structure.topLevelPort ? `${analysis.structure.topLevelPort.port}` : 'None'}
                            </span>
                          </div>
                        </div>

                        {/* Monorepo Sub-Applications if multiple */}
                        {analysis.structure.applications && analysis.structure.applications.length > 1 && (
                          <div className="pt-2">
                            <span className="text-[11px] font-semibold text-slate-400 block mb-2">
                              Discovered Sub-Applications ({analysis.structure.applications.length})
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              {analysis.structure.applications.map((app, i) => (
                                <div
                                  key={i}
                                  className="p-3 rounded-xl border border-slate-800 bg-slate-950/60 flex flex-col space-y-1.5"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-white font-mono">{app.name}</span>
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                                      {app.role}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-400 flex items-center space-x-3">
                                    <span>Path: <span className="text-slate-300 font-mono">{app.path}</span></span>
                                    {app.framework && <span>Framework: <span className="text-cyan-300">{app.framework}</span></span>}
                                    {app.port && <span>Port: <span className="text-purple-300 font-mono">{app.port.port}</span></span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Application Relationships if present */}
                        {analysis.structure.relationships && analysis.structure.relationships.length > 0 && (
                          <div className="pt-2">
                            <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                              Detected Application Relationships
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {analysis.structure.relationships.map((rel, i) => (
                                <span
                                  key={i}
                                  className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-indigo-950/40 border border-indigo-800/40 text-indigo-300 text-xs"
                                >
                                  <span className="font-mono font-bold">{rel.source}</span>
                                  <span>→</span>
                                  <span className="font-mono font-bold">{rel.target}</span>
                                  <span className="text-[10px] text-indigo-400">({rel.relationshipType})</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl border border-slate-800/60 bg-slate-950/40 text-center">
                        <p className="text-xs text-slate-400 mb-2">
                          Application structure details (roles, entry points, scripts, ports) have not been computed yet.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Phase 3.4 — Deployment Readiness Section */}
                  <div className="pt-4 border-t border-slate-800/80">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        <Rocket className="w-4 h-4 text-emerald-400" />
                        <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                          Deployment Readiness & Feasibility (Phase 3.4)
                        </h4>
                      </div>
                      <button
                        onClick={handleAnalyzeReadiness}
                        disabled={isAnalyzingReadiness}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-all disabled:opacity-60"
                      >
                        {isAnalyzingReadiness ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                            <span>Evaluating...</span>
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-3 h-3" />
                            <span>{analysis.readiness ? 'Re-evaluate Readiness' : 'Evaluate Readiness'}</span>
                          </>
                        )}
                      </button>
                    </div>

                    {analysis.readiness ? (
                      <div className="space-y-4">
                        {/* Readiness Summary Header */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {/* Status */}
                          <div className="rounded-xl border border-slate-800/80 bg-slate-950/80 p-3">
                            <span className="text-[11px] text-slate-400 block mb-1">Readiness Status</span>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                                analysis.readiness.status === 'READY'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : analysis.readiness.status === 'READY_WITH_WARNINGS'
                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              }`}
                            >
                              {analysis.readiness.status.replace(/_/g, ' ')}
                            </span>
                          </div>

                          {/* Strategy */}
                          <div className="rounded-xl border border-slate-800/80 bg-slate-950/80 p-3">
                            <span className="text-[11px] text-slate-400 block mb-1">Recommended Strategy</span>
                            <span className="text-xs font-mono text-cyan-300 font-semibold block truncate">
                              {analysis.readiness.strategy.replace(/_/g, ' ')}
                            </span>
                          </div>

                          {/* Score */}
                          <div className="rounded-xl border border-slate-800/80 bg-slate-950/80 p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] text-slate-400">Readiness Score</span>
                              <span
                                className={`text-xs font-bold font-mono ${
                                  analysis.readiness.score >= 90
                                    ? 'text-emerald-400'
                                    : analysis.readiness.score >= 70
                                      ? 'text-amber-400'
                                      : 'text-rose-400'
                                }`}
                              >
                                {analysis.readiness.score}/100
                              </span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  analysis.readiness.score >= 90
                                    ? 'bg-emerald-500'
                                    : analysis.readiness.score >= 70
                                      ? 'bg-amber-500'
                                      : 'bg-rose-500'
                                }`}
                                style={{ width: `${analysis.readiness.score}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Summary Message */}
                        <p className="text-xs text-slate-300 bg-slate-950/40 p-3 rounded-xl border border-slate-800/60">
                          {analysis.readiness.summary}
                        </p>

                        {/* Blockers if present */}
                        {analysis.readiness.blockers && analysis.readiness.blockers.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[11px] font-semibold text-rose-400 block">
                              Deployment Blockers ({analysis.readiness.blockers.length})
                            </span>
                            {analysis.readiness.blockers.map((b, i) => (
                              <div
                                key={i}
                                className="p-2.5 rounded-lg bg-rose-950/20 border border-rose-800/30 text-rose-200 text-xs flex items-start space-x-2"
                              >
                                <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-semibold">{b.code}: </span>
                                  <span>{b.message}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Warnings if present */}
                        {analysis.readiness.warnings && analysis.readiness.warnings.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[11px] font-semibold text-amber-400 block">
                              Warnings & Optimization Items ({analysis.readiness.warnings.length})
                            </span>
                            {analysis.readiness.warnings.map((w, i) => (
                              <div
                                key={i}
                                className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-800/30 text-amber-200 text-xs flex items-start space-x-2"
                              >
                                <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-semibold">{w.code}: </span>
                                  <span>{w.message}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Recommendations */}
                        {analysis.readiness.recommendations && analysis.readiness.recommendations.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[11px] font-semibold text-slate-400 block">
                              Actionable Recommendations
                            </span>
                            <div className="space-y-1">
                              {analysis.readiness.recommendations.map((rec, i) => (
                                <div
                                  key={i}
                                  className="p-2 rounded-lg bg-slate-950 border border-slate-800/80 text-slate-300 text-xs flex items-center justify-between"
                                >
                                  <span>{rec.message}</span>
                                  <span
                                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                      rec.priority === 'HIGH'
                                        ? 'bg-rose-500/10 text-rose-400'
                                        : rec.priority === 'MEDIUM'
                                          ? 'bg-amber-500/10 text-amber-400'
                                          : 'bg-slate-800 text-slate-400'
                                    }`}
                                  >
                                    {rec.priority}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl border border-slate-800/60 bg-slate-950/40 text-center">
                        <p className="text-xs text-slate-400 mb-2">
                          Deployment readiness has not been evaluated yet. Run evaluation to check deployment feasibility, score, and blockers.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Unanalyzed Empty State */
                <div className="mt-6 p-8 text-center rounded-xl border border-dashed border-slate-800 bg-slate-950/30">
                  <Cpu className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-slate-200 mb-1">
                    Repository has not been analyzed yet
                  </h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
                    Run static analysis to inspect the project structure, detect framework dependencies,
                    and verify container configurations.
                  </p>
                  <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                    className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:opacity-60"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Run Static Analysis</span>
                  </button>
                </div>
              )}
            </div>

            {/* Phase 4 — Deployment Engine */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
                <div className="flex items-start space-x-3">
                  <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 mt-0.5">
                    <Rocket className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-base font-bold text-white tracking-tight">
                        Deployment Engine
                      </h2>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-semibold">
                        Phase 4
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Isolated Docker-based image building, runtime container management, health verification, and logs.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleGeneratePlan}
                    disabled={isGeneratingPlan || !analysis?.readiness}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:opacity-50"
                  >
                    {isGeneratingPlan ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                        <span>Planning...</span>
                      </>
                    ) : (
                      <>
                        <Layers className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Generate Plan</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleDeploy}
                    disabled={
                      isDeploying ||
                      !analysis?.readiness ||
                      analysis.readiness.status === 'BLOCKED' ||
                      analysis.readiness.strategy === 'UNSUPPORTED'
                    }
                    className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-cyan-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDeploying ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-950" />
                        <span>Deploying...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Deploy Application</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Deployment Banners */}
              {deploymentError && (
                <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  <span>{deploymentError}</span>
                </div>
              )}

              {deploymentSuccessMessage && (
                <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>{deploymentSuccessMessage}</span>
                </div>
              )}

              {/* Deployment Plan Preview */}
              {deploymentPlan && (
                <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/10 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center space-x-1.5">
                      <FileCode2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Generated Deployment Plan</span>
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        deploymentPlan.canDeploy
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {deploymentPlan.canDeploy ? 'CAN DEPLOY' : 'BLOCKED'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Strategy</span>
                      <span className="font-mono text-slate-200 font-semibold">{deploymentPlan.strategy}</span>
                    </div>
                    <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Dockerfile Strategy</span>
                      <span className="font-mono text-cyan-300 font-semibold">{deploymentPlan.dockerfileStrategy}</span>
                    </div>
                    <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Exposed Port</span>
                      <span className="font-mono text-slate-200 font-semibold">{deploymentPlan.exposedPort || 'None (Worker)'}</span>
                    </div>
                    <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Health Check</span>
                      <span className="font-mono text-slate-200 font-semibold">{deploymentPlan.healthCheckStrategy}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300">{deploymentPlan.summary}</p>
                </div>
              )}

              {/* Latest Active / Recent Deployment Card */}
              {deployments.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-1.5">
                    <Activity className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Active / Latest Deployment</span>
                  </h3>

                  {(() => {
                    const latest = deployments[0];
                    const isActive = ['PENDING', 'VALIDATING', 'BUILDING', 'STARTING', 'HEALTH_CHECKING'].includes(latest.status);
                    return (
                      <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-mono text-slate-400">ID: {latest.id.substring(0, 8)}</span>
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                                latest.status === 'RUNNING'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : latest.status === 'FAILED'
                                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                    : latest.status === 'CANCELLED'
                                      ? 'bg-slate-800 text-slate-400 border-slate-700'
                                      : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30 animate-pulse'
                              }`}
                            >
                              {latest.status}
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded ${
                                latest.healthStatus === 'HEALTHY'
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : latest.healthStatus === 'UNHEALTHY'
                                    ? 'bg-rose-500/10 text-rose-400'
                                    : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              Health: {latest.healthStatus}
                            </span>
                          </div>

                          <div className="flex items-center space-x-2">
                            {isActive && (
                              <button
                                onClick={() => handleCancelDeployment(latest.id)}
                                disabled={isCancellingId === latest.id}
                                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-300 text-xs font-semibold transition-all disabled:opacity-50"
                              >
                                <Square className="w-3 h-3 fill-current" />
                                <span>Cancel</span>
                              </button>
                            )}

                            <button
                              onClick={() => handleViewLogs(latest.id)}
                              disabled={isLoadingLogs}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all"
                            >
                              <Terminal className="w-3 h-3 text-cyan-400" />
                              <span>View Logs</span>
                            </button>
                          </div>
                        </div>

                        {latest.url && latest.status === 'RUNNING' && (
                          <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-800/30 flex items-center justify-between text-xs">
                            <span className="text-emerald-300 font-semibold">Live URL:</span>
                            <a
                              href={latest.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center space-x-1 font-mono text-emerald-400 hover:underline"
                            >
                              <span>{latest.url}</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}

                        {latest.errorMessage && (
                          <div className="p-2.5 rounded-lg bg-rose-950/20 border border-rose-800/30 text-rose-300 text-xs">
                            <span className="font-bold">Error: </span>
                            <span>{latest.errorMessage}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Deployment History Table */}
              {deployments.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Deployment History ({deployments.length})</span>
                  </h3>

                  <div className="overflow-x-auto rounded-xl border border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[11px] uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">Environment</th>
                          <th className="py-2.5 px-3">Commit / Branch</th>
                          <th className="py-2.5 px-3">Trigger</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Health</th>
                          <th className="py-2.5 px-3">Created</th>
                          <th className="py-2.5 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-900/30">
                        {deployments.map((d, idx) => (
                          <tr key={d.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-2.5 px-3 font-mono font-bold text-cyan-300">
                              #{d.deploymentNumber || (deployments.length - idx)}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-200 border border-slate-700">
                                {environments.find((e) => e.id === d.environmentId)?.name || 'production'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-300">
                              <span className="text-cyan-400 font-semibold">{d.commitSha ? d.commitSha.substring(0, 7) : 'latest'}</span>
                              <span className="text-slate-500 mx-1">@</span>
                              <span className="text-slate-400">{d.branch || project.defaultBranch}</span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  d.triggerType === 'WEBHOOK'
                                    ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                                    : d.triggerType === 'ROLLBACK' || d.isRollback
                                      ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                                      : 'bg-slate-800 text-slate-300'
                                }`}
                              >
                                {d.triggerType === 'ROLLBACK' || d.isRollback ? 'Rollback' : d.triggerType || 'Manual'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                                  d.status === 'RUNNING'
                                    ? 'bg-emerald-500/10 text-emerald-400'
                                    : d.status === 'FAILED'
                                      ? 'bg-rose-500/10 text-rose-400'
                                      : d.status === 'CANCELLED'
                                        ? 'bg-slate-800 text-slate-400'
                                        : 'bg-cyan-500/10 text-cyan-300'
                                }`}
                              >
                                {d.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`text-[10px] font-semibold ${
                                  d.healthStatus === 'HEALTHY'
                                    ? 'text-emerald-400'
                                    : d.healthStatus === 'UNHEALTHY'
                                      ? 'text-rose-400'
                                      : 'text-slate-400'
                                }`}
                              >
                                {d.healthStatus}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                              {new Date(d.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="inline-flex items-center space-x-1.5">
                                <button
                                  onClick={() => handleViewLogs(d.id)}
                                  className="inline-flex items-center space-x-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition-colors"
                                >
                                  <Terminal className="w-2.5 h-2.5 text-cyan-400" />
                                  <span>Logs</span>
                                </button>
                                {idx > 0 && d.status === 'RUNNING' || d.healthStatus === 'HEALTHY' ? (
                                  <button
                                    onClick={() => handleOpenRollbackModal(d)}
                                    title={`Roll back to deployment #${d.deploymentNumber || (deployments.length - idx)}`}
                                    className="inline-flex items-center space-x-1 px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-medium transition-colors"
                                  >
                                    <RotateCcw className="w-2.5 h-2.5" />
                                    <span>Rollback to this</span>
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Phase 5: Observability, Telemetry & Real-Time Monitoring Card */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-base font-bold text-white">
                        Phase 5: Observability, Telemetry & Real-Time Monitoring
                      </h2>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                        Live SRE
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Real-time container resource telemetry, health monitoring, incident alerts, and log streaming.
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setAutoRefreshTelemetry((prev) => !prev)}
                    className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      autoRefreshTelemetry
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    <Radio className={`w-3.5 h-3.5 ${autoRefreshTelemetry ? 'text-emerald-400 animate-pulse' : ''}`} />
                    <span>Auto-refresh {autoRefreshTelemetry ? 'ON' : 'OFF'}</span>
                  </button>

                  {deployments[0] && (
                    <button
                      onClick={() => handleCollectMetrics(deployments[0].id)}
                      disabled={isCollectingMetrics || isLoadingTelemetry}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all disabled:opacity-50"
                    >
                      {isCollectingMetrics ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      <span>Collect Metrics</span>
                    </button>
                  )}
                </div>
              </div>

              {observabilitySuccessMessage && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>{observabilitySuccessMessage}</span>
                </div>
              )}

              {observabilityError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{observabilityError}</span>
                </div>
              )}

              {deployments.length === 0 ? (
                <div className="p-8 rounded-xl border border-dashed border-slate-800 text-center space-y-3">
                  <Activity className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Deploy your application in Phase 4 above to begin collecting live container CPU/memory telemetry, active health probes, and streaming logs.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* KPI Telemetry Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* CPU Utilization Tile */}
                    <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="font-semibold">CPU Utilization</span>
                        <Cpu className="w-4 h-4 text-cyan-400" />
                      </div>
                      <div className="flex items-baseline space-x-1.5">
                        <span className="text-2xl font-bold font-mono text-white">
                          {telemetry?.liveSnapshot?.cpuPercent?.toFixed(1) ?? '0.0'}%
                        </span>
                        <span className="text-[11px] text-slate-400">
                          (Avg: {telemetry?.avgCpuPercent?.toFixed(1) ?? '0.0'}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            (telemetry?.liveSnapshot?.cpuPercent ?? 0) > 85
                              ? 'bg-rose-500'
                              : (telemetry?.liveSnapshot?.cpuPercent ?? 0) > 70
                                ? 'bg-amber-400'
                                : 'bg-cyan-400'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(2, telemetry?.liveSnapshot?.cpuPercent ?? 0))}%` }}
                        />
                      </div>
                    </div>

                    {/* Memory Usage Tile */}
                    <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="font-semibold">Memory Usage</span>
                        <HardDrive className="w-4 h-4 text-purple-400" />
                      </div>
                      <div className="flex items-baseline space-x-1.5">
                        <span className="text-2xl font-bold font-mono text-white">
                          {((telemetry?.liveSnapshot?.memoryUsageBytes ?? 0) / (1024 * 1024)).toFixed(1)} MB
                        </span>
                        <span className="text-[11px] text-slate-400">
                          / {((telemetry?.liveSnapshot?.memoryLimitBytes ?? 0) / (1024 * 1024)).toFixed(0) || '512'} MB
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            (telemetry?.liveSnapshot?.memoryPercent ?? 0) > 85
                              ? 'bg-rose-500'
                              : (telemetry?.liveSnapshot?.memoryPercent ?? 0) > 70
                                ? 'bg-amber-400'
                                : 'bg-purple-400'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(2, telemetry?.liveSnapshot?.memoryPercent ?? 0))}%` }}
                        />
                      </div>
                    </div>

                    {/* Network Throughput Tile */}
                    <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="font-semibold">Network I/O</span>
                        <Zap className="w-4 h-4 text-amber-400" />
                      </div>
                      <div className="space-y-1 text-xs font-mono">
                        <div className="flex justify-between text-slate-300">
                          <span className="text-slate-500">IN:</span>
                          <span>{((telemetry?.liveSnapshot?.networkInputBytes ?? 0) / 1024).toFixed(1)} KB</span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span className="text-slate-500">OUT:</span>
                          <span>{((telemetry?.liveSnapshot?.networkOutputBytes ?? 0) / 1024).toFixed(1)} KB</span>
                        </div>
                      </div>
                    </div>

                    {/* Container Health & Status Tile */}
                    <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="font-semibold">Health & Status</span>
                        <Activity className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="flex items-center space-x-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                            telemetry?.healthStatus === 'HEALTHY'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : telemetry?.healthStatus === 'UNHEALTHY'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {telemetry?.healthStatus ?? 'UNKNOWN'}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          {telemetry?.liveSnapshot?.containerStatus ?? (deployments[0]?.status || 'UNKNOWN')}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Uptime: <span className="font-mono text-slate-200">{telemetry?.uptimeSeconds ? `${telemetry.uptimeSeconds}s` : '0s'}</span> • PIDs: <span className="font-mono text-slate-200">{telemetry?.liveSnapshot?.pids ?? 1}</span>
                      </div>
                    </div>
                  </div>

                  {/* Incident Alerts Feed */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Bell className="w-4 h-4 text-cyan-400" />
                        <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                          Operational Events & Alerts ({telemetry?.recentEvents?.length ?? 0})
                        </h3>
                      </div>
                      {telemetry?.activeAlertsCount ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          {telemetry.activeAlertsCount} Warning(s)
                        </span>
                      ) : null}
                    </div>

                    {!telemetry?.recentEvents || telemetry.recentEvents.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No operational incidents or threshold alerts recorded.</p>
                    ) : (
                      <div className="space-y-2">
                        {telemetry.recentEvents.slice(0, 5).map((evt) => (
                          <div
                            key={evt.id}
                            className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center space-x-2">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  evt.severity === 'CRITICAL'
                                    ? 'bg-rose-500/10 text-rose-400'
                                    : evt.severity === 'WARNING'
                                      ? 'bg-amber-500/10 text-amber-300'
                                      : 'bg-cyan-500/10 text-cyan-300'
                                }`}
                              >
                                {evt.severity}
                              </span>
                              <span className="font-mono text-slate-400 text-[11px]">[{evt.type}]</span>
                              <span className="text-slate-200">{evt.message}</span>
                            </div>
                            <span className="text-[11px] text-slate-500">
                              {new Date(evt.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Phase 6 — AI Intelligence & Agent Layer Card */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-md p-6 sm:p-8 shadow-xl space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/20">
                    <BrainCircuit className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-lg font-bold text-white tracking-tight">
                        AI Intelligence & Agent Layer
                      </h2>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/30">
                        Phase 6
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      AI proposes — Deterministic systems validate. Zero arbitrary shell or Docker execution.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleExplainProject}
                    disabled={isLoadingAiUnderstanding || !analysis}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-all disabled:opacity-50"
                  >
                    {isLoadingAiUnderstanding ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>Explain Project</span>
                  </button>

                  <button
                    onClick={handleGenerateAiProposal}
                    disabled={isLoadingAiProposal || !analysis}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all disabled:opacity-50"
                  >
                    {isLoadingAiProposal ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FileCode2 className="w-3.5 h-3.5 text-cyan-400" />
                    )}
                    <span>Generate Config Proposal</span>
                  </button>
                </div>
              </div>

              {/* Feedback Notifications */}
              {aiSuccessMessage && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
                  <span>{aiSuccessMessage}</span>
                  <button onClick={() => setAiSuccessMessage(null)} className="text-emerald-400 hover:text-white font-bold ml-2">×</button>
                </div>
              )}
              {aiErrorMessage && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
                  <span>{aiErrorMessage}</span>
                  <button onClick={() => setAiErrorMessage(null)} className="text-rose-400 hover:text-white font-bold ml-2">×</button>
                </div>
              )}

              {/* AI Understanding Drawer */}
              {aiUnderstanding && (
                <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-950/20 space-y-4 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-purple-300 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      <span>AI Repository Interpretation</span>
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-200">
                      Confidence: {aiUnderstanding.confidence}
                    </span>
                  </div>
                  <p className="text-slate-200 leading-relaxed font-sans">{aiUnderstanding.summary}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Primary Role</span>
                      <span className="text-white font-semibold">{aiUnderstanding.architecture.role}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Predicted Runtime Port</span>
                      <span className="text-cyan-300 font-mono font-semibold">:{aiUnderstanding.deployment.expectedPort}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Recommended Start</span>
                      <span className="text-white font-mono">{aiUnderstanding.buildAndRun.recommendedStartCommand}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* AI Deployment Proposal Drawer */}
              {aiProposal && (
                <div className="p-4 rounded-xl border border-cyan-500/30 bg-cyan-950/20 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-cyan-300 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                      <FileCode2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>AI Proposed Docker Configuration</span>
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Security Validated: {aiProposal.validation.securityPassed ? 'PASS' : 'FAIL'}
                    </span>
                  </div>
                  <p className="text-slate-300">{aiProposal.dockerfileExplanation}</p>
                  {aiProposal.suggestedDockerfile && (
                    <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-48">
                      {aiProposal.suggestedDockerfile}
                    </pre>
                  )}
                </div>
              )}

              {/* AI Failure Diagnosis & Repair Suggestions */}
              {deployments.length > 0 && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                      <Wrench className="w-3.5 h-3.5 text-amber-400" />
                      <span>Diagnosis & Repair Advisor</span>
                    </h3>
                    <button
                      onClick={() => handleDiagnoseDeployment(deployments[0].id, deployments[0].status === 'FAILED')}
                      disabled={isLoadingAiDiagnosis}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center space-x-1"
                    >
                      {isLoadingAiDiagnosis ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                      <span>Diagnose Latest Deployment ({deployments[0].status})</span>
                    </button>
                  </div>

                  {aiDiagnosis && (
                    <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-950/20 space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-300 font-mono text-[11px]">
                          [{aiDiagnosis.category}] {aiDiagnosis.problem}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-200">
                          {aiDiagnosis.confidence}
                        </span>
                      </div>
                      <p className="text-slate-200"><strong>Likely Cause:</strong> {aiDiagnosis.likelyCause}</p>
                      <p className="text-emerald-300"><strong>Recommendation:</strong> {aiDiagnosis.recommendation}</p>
                      
                      {aiDiagnosis.evidence.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[10px] text-slate-400 uppercase font-bold">Evidence Items:</span>
                          {aiDiagnosis.evidence.map((ev, i) => (
                            <div key={i} className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center space-x-2">
                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${ev.type === 'FACT' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-purple-500/20 text-purple-300'}`}>
                                {ev.type}
                              </span>
                              <span className="font-mono text-slate-400 text-[10px]">[{ev.source}]</span>
                              <span className="text-slate-200">{ev.content}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Repair Suggestions Feed */}
                  {aiRepairSuggestions.length > 0 && (
                    <div className="space-y-3">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Structured Repair Proposals ({aiRepairSuggestions.length})
                      </span>
                      {aiRepairSuggestions.map((sug) => (
                        <div key={sug.id} className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-3 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white text-xs">{sug.title}</span>
                            <div className="flex items-center space-x-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${sug.risk === 'HIGH' ? 'bg-rose-500/10 text-rose-400' : sug.risk === 'MEDIUM' ? 'bg-amber-500/10 text-amber-300' : 'bg-emerald-500/10 text-emerald-300'}`}>
                                Risk: {sug.risk}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                                {sug.status}
                              </span>
                            </div>
                          </div>
                          <p className="text-slate-300">{sug.problem}</p>
                          {sug.proposedChange?.diffPreview && (
                            <pre className="p-2.5 rounded bg-slate-900 border border-slate-800 font-mono text-[11px] text-emerald-300 overflow-x-auto">
                              {sug.proposedChange.diffPreview}
                            </pre>
                          )}
                          <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                            <span className="text-[10px] text-slate-400">
                              Requires human review before applying.
                            </span>
                            <div className="flex items-center space-x-2">
                              {sug.status === 'PROPOSED' ? (
                                <>
                                  <button
                                    onClick={() => handleRejectRepair(sug.id)}
                                    disabled={isRejectingRepairId === sug.id}
                                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center space-x-1"
                                  >
                                    <ThumbsDown className="w-3 h-3" />
                                    <span>Reject</span>
                                  </button>
                                  <button
                                    onClick={() => handleApproveRepair(sug.id)}
                                    disabled={isApprovingRepairId === sug.id}
                                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center space-x-1"
                                  >
                                    {isApprovingRepairId === sug.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ThumbsUp className="w-3 h-3" />}
                                    <span>Approve Fix</span>
                                  </button>
                                </>
                              ) : (
                                <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                                  <CheckCheck className="w-4 h-4" />
                                  <span>{sug.status}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* CloudPilot AI Agent Interaction */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-4">
                <div className="flex items-center space-x-2">
                  <Bot className="w-4 h-4 text-purple-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    CloudPilot AI Agent (Controlled Tools)
                  </h3>
                </div>

                <form onSubmit={handleRunAgent} className="flex gap-2">
                  <input
                    type="text"
                    value={aiAgentPrompt}
                    onChange={(e) => setAiAgentPrompt(e.target.value)}
                    placeholder="Ask the AI agent about your project, architecture, or deployments..."
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                  <button
                    type="submit"
                    disabled={isAgentRunning || !aiAgentPrompt.trim()}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-all disabled:opacity-50 flex items-center space-x-1.5"
                  >
                    {isAgentRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
                    <span>Ask Agent</span>
                  </button>
                </form>

                {aiAgentResponse && (
                  <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-950/10 space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-purple-300">Agent Verified Answer</span>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-[10px] text-slate-400">
                          Tools Used: {aiAgentResponse.toolsUsed.join(', ') || 'None'}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-200">
                          {aiAgentResponse.confidence}
                        </span>
                      </div>
                    </div>
                    <p className="text-slate-200 leading-relaxed">{aiAgentResponse.answer}</p>

                    {aiAgentResponse.steps.length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                        <span className="text-[10px] text-slate-400 uppercase font-bold">Reasoning Trajectory:</span>
                        {aiAgentResponse.steps.map((step, idx) => (
                          <div key={idx} className="p-2 rounded bg-slate-900/90 border border-slate-800/80 font-mono text-[11px] text-slate-300 space-y-1">
                            <div className="text-purple-300 font-sans">Thought: {step.thought}</div>
                            {step.toolCall && (
                              <div className="text-cyan-400 text-[10px]">
                                Tool Executed: <strong>{step.toolCall.tool}</strong>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* PHASE 7: CI/CD, ENVIRONMENTS & PIPELINE ENGINEERING CARD */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md p-6 sm:p-8 shadow-xl relative overflow-hidden space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
                <div className="flex items-start space-x-3.5">
                  <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
                    <Workflow className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-lg font-bold text-white tracking-tight">
                        CI/CD, Environments & Automated Pipelines
                      </h2>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 font-semibold">
                        Phase 7
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      First-class environment management, AES-256 encrypted configuration at rest, GitHub webhook triggers, and deterministic rollback policies.
                    </p>
                  </div>
                </div>
              </div>

              {/* Feedback Banners */}
              {cicdSuccessMessage && (
                <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs flex items-center space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>{cicdSuccessMessage}</span>
                </div>
              )}
              {cicdErrorMessage && (
                <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-xs flex items-center space-x-2.5">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span>{cicdErrorMessage}</span>
                </div>
              )}

              {/* 1. Environment Tabs & Variables */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-2">
                    <Layers className="w-4 h-4 text-blue-400" />
                    <span>Target Environments</span>
                  </h3>
                  <button
                    onClick={() => setShowAddVarModal(true)}
                    disabled={!selectedEnvId}
                    className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Variable / Secret</span>
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {environments.map((env) => {
                    const isSelected = env.id === selectedEnvId;
                    return (
                      <button
                        key={env.id}
                        onClick={() => setSelectedEnvId(env.id)}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                          isSelected
                            ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-md shadow-blue-950/50'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        <span className="capitalize">{env.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                          {env.variablesCount || 0} vars
                        </span>
                        {env.autoDeployEnabled && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400" title="Auto-deploy active" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Selected Environment Settings & Variable Panel */}
                {selectedEnvId && (() => {
                  const currentEnv = environments.find((e) => e.id === selectedEnvId);
                  if (!currentEnv) return null;
                  return (
                    <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-4 space-y-4">
                      {/* Environment Config Row */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4 border-b border-slate-800/80">
                        {/* Branch Pattern */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-400 block">
                            Trigger Branch Pattern
                          </label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="text"
                              defaultValue={currentEnv.branchPattern}
                              onBlur={(e) => {
                                if (e.target.value !== currentEnv.branchPattern) {
                                  handleUpdateEnvironment(currentEnv.id, { branchPattern: e.target.value });
                                }
                              }}
                              className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                              placeholder="e.g. main, staging, develop"
                            />
                          </div>
                        </div>

                        {/* Auto-Deploy Toggle */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-400 block">
                            Auto-Deploy on Push
                          </label>
                          <button
                            onClick={() =>
                              handleUpdateEnvironment(currentEnv.id, {
                                autoDeployEnabled: !currentEnv.autoDeployEnabled,
                              })
                            }
                            className={`w-full py-1.5 px-3 rounded-lg border text-xs font-semibold transition-all flex items-center justify-between ${
                              currentEnv.autoDeployEnabled
                                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                                : 'bg-slate-900 border-slate-700 text-slate-400'
                            }`}
                          >
                            <span>{currentEnv.autoDeployEnabled ? 'Enabled' : 'Disabled'}</span>
                            <div
                              className={`w-3 h-3 rounded-full ${
                                currentEnv.autoDeployEnabled ? 'bg-emerald-400' : 'bg-slate-600'
                              }`}
                            />
                          </button>
                        </div>

                        {/* Auto-Rollback Toggle */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-400 block">
                            Auto-Rollback on Failure
                          </label>
                          <button
                            onClick={() =>
                              handleUpdateEnvironment(currentEnv.id, {
                                autoRollbackEnabled: !currentEnv.autoRollbackEnabled,
                              })
                            }
                            className={`w-full py-1.5 px-3 rounded-lg border text-xs font-semibold transition-all flex items-center justify-between ${
                              currentEnv.autoRollbackEnabled
                                ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                                : 'bg-slate-900 border-slate-700 text-slate-400'
                            }`}
                          >
                            <span>{currentEnv.autoRollbackEnabled ? 'Active (Loop Guard)' : 'Disabled'}</span>
                            <div
                              className={`w-3 h-3 rounded-full ${
                                currentEnv.autoRollbackEnabled ? 'bg-amber-400' : 'bg-slate-600'
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Variables Table */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-300">
                            Variables & Secrets ({envVariables.length})
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            Stored with AES-256-GCM encryption
                          </span>
                        </div>

                        {isLoadingVariables ? (
                          <div className="py-6 flex items-center justify-center text-slate-500 text-xs">
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            <span>Loading environment variables...</span>
                          </div>
                        ) : envVariables.length === 0 ? (
                          <div className="py-6 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
                            No variables configured for {currentEnv.name}. Click &quot;Add Variable / Secret&quot; above to configure database URLs, API tokens, etc.
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-lg border border-slate-800">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-900/80 text-slate-400 text-[11px] uppercase">
                                <tr>
                                  <th className="py-2 px-3">Key</th>
                                  <th className="py-2 px-3">Value</th>
                                  <th className="py-2 px-3">Security</th>
                                  <th className="py-2 px-3 text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                                {envVariables.map((v) => (
                                  <tr key={v.id} className="hover:bg-slate-900/30">
                                    <td className="py-2 px-3 font-mono text-cyan-300 font-medium">
                                      {v.key}
                                    </td>
                                    <td className="py-2 px-3 font-mono text-slate-400">
                                      {v.maskedValue || '••••••••'}
                                    </td>
                                    <td className="py-2 px-3">
                                      {v.isSecret ? (
                                        <span className="inline-flex items-center space-x-1 text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-medium">
                                          <Shield className="w-2.5 h-2.5" />
                                          <span>Encrypted Secret</span>
                                        </span>
                                      ) : (
                                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                                          Plaintext
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2 px-3 text-right">
                                      <button
                                        onClick={() => handleDeleteVariable(v.id, v.key)}
                                        disabled={isDeletingVarId === v.id}
                                        className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                                        title="Delete variable"
                                      >
                                        {isDeletingVarId === v.id ? (
                                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                          <Trash2 className="w-3.5 h-3.5" />
                                        )}
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* 2. GitHub Webhook Ingestion & Audit Section */}
              <div className="pt-4 border-t border-slate-800/80 space-y-4">
                <div className="flex items-center space-x-2">
                  <GitPullRequest className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    GitHub Webhook Ingestion & CI/CD Trigger
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Webhook URL Card */}
                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2">
                    <label className="text-[11px] font-semibold text-slate-400 block">
                      Webhook Payload URL
                    </label>
                    <div className="flex items-center rounded-lg bg-slate-900 border border-slate-800 p-2">
                      <input
                        type="text"
                        readOnly
                        value={
                          typeof window !== 'undefined'
                            ? `${window.location.protocol}//${window.location.hostname}:3001/webhooks/github`
                            : 'http://localhost:3001/webhooks/github'
                        }
                        className="flex-1 bg-transparent text-xs text-slate-200 font-mono focus:outline-none select-all"
                      />
                      <button
                        onClick={() =>
                          handleCopy(
                            typeof window !== 'undefined'
                              ? `${window.location.protocol}//${window.location.hostname}:3001/webhooks/github`
                              : 'http://localhost:3001/webhooks/github',
                            'https',
                          )
                        }
                        className="p-1 rounded text-slate-400 hover:text-cyan-400"
                        title="Copy Webhook URL"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Configure this in GitHub Repo Settings &gt; Webhooks with Content type: <code>application/json</code>.
                    </p>
                  </div>

                  {/* Webhook Secret Card */}
                  <form
                    onSubmit={handleSaveWebhookSecret}
                    className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold text-slate-400">
                        HMAC SHA-256 Webhook Secret
                      </label>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                          cicdSettings?.webhookSecretConfigured
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {cicdSettings?.webhookSecretConfigured ? 'Configured' : 'Not Set'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="password"
                        value={webhookSecretInput}
                        onChange={(e) => setWebhookSecretInput(e.target.value)}
                        placeholder="Enter secret or new token..."
                        className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                      />
                      <button
                        type="submit"
                        disabled={isUpdatingWebhookSecret || !webhookSecretInput.trim()}
                        className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
                      >
                        {isUpdatingWebhookSecret ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Used to verify <code>X-Hub-Signature-256</code> payloads with constant-time equality.
                    </p>
                  </form>
                </div>

                {/* Recent Webhook Events Audit Log */}
                {webhookEvents.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <span className="text-xs font-bold text-slate-300 block">
                      Recent Webhook Deliveries ({webhookEvents.length})
                    </span>
                    <div className="overflow-x-auto rounded-lg border border-slate-800 max-h-48 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-900 text-slate-400 text-[11px] uppercase sticky top-0">
                          <tr>
                            <th className="py-2 px-3">Delivery ID</th>
                            <th className="py-2 px-3">Event</th>
                            <th className="py-2 px-3">Sender</th>
                            <th className="py-2 px-3">Branch / Ref</th>
                            <th className="py-2 px-3">Status</th>
                            <th className="py-2 px-3">Reason</th>
                            <th className="py-2 px-3">Time</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                          {webhookEvents.map((evt) => (
                            <tr key={evt.id} className="hover:bg-slate-900/30">
                              <td className="py-2 px-3 font-mono text-cyan-300 text-[11px]">
                                {evt.deliveryId.substring(0, 8)}...
                              </td>
                              <td className="py-2 px-3 text-slate-300 font-mono">{evt.event}</td>
                              <td className="py-2 px-3 text-slate-300">{evt.sender || 'octocat'}</td>
                              <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">
                                {evt.ref || evt.commitSha?.substring(0, 7) || 'main'}
                              </td>
                              <td className="py-2 px-3">
                                <span
                                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    evt.status === 'PROCESSED'
                                      ? 'bg-emerald-500/10 text-emerald-400'
                                      : evt.status === 'IGNORED'
                                        ? 'bg-amber-500/10 text-amber-300'
                                        : 'bg-rose-500/10 text-rose-400'
                                  }`}
                                >
                                  {evt.status}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-slate-400 text-[11px] truncate max-w-xs">
                                {evt.reason || 'Deployed successfully'}
                              </td>
                              <td className="py-2 px-3 text-slate-500 text-[11px]">
                                {new Date(evt.createdAt).toLocaleTimeString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Clone Information & Project Metadata Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Clone URLs */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
                <h3 className="text-sm font-bold text-white mb-4">Repository Clone URLs</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                      HTTPS
                    </label>
                    <div className="flex items-center rounded-xl bg-slate-950 border border-slate-800 p-2">
                      <input
                        type="text"
                        readOnly
                        value={project.cloneUrl}
                        className="flex-1 bg-transparent text-xs text-slate-200 font-mono focus:outline-none select-all"
                      />
                      <button
                        onClick={() => handleCopy(project.cloneUrl, 'https')}
                        title="Copy HTTPS URL"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition-colors focus:outline-none"
                      >
                        {copiedType === 'https' ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Project Metadata */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white mb-4">Project Information</h3>
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between py-2 border-b border-slate-800/60">
                      <span className="text-slate-400">Repository ID</span>
                      <span className="font-mono text-slate-200">{project.githubRepositoryId}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-800/60">
                      <span className="text-slate-400">Created At</span>
                      <span className="text-slate-200">
                        {new Date(project.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-slate-400">Last Updated</span>
                      <span className="text-slate-200">
                        {new Date(project.updatedAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Disconnect Project Confirmation Modal */}
      {showDisconnectModal && project && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
        >
          <div
            onClick={() => !isDisconnecting && setShowDisconnectModal(false)}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-md rounded-2xl border border-red-500/30 bg-slate-900 p-6 z-10 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">Disconnect Project?</h3>
            <p className="text-xs text-slate-300 mb-6 leading-relaxed">
              Are you sure you want to disconnect{' '}
              <strong className="font-mono text-cyan-300">{project.repositoryFullName}</strong>?
              This removes the project record and its repository intelligence analysis from CloudPilot. Your GitHub repository will not be affected.
            </p>
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowDisconnectModal(false)}
                disabled={isDisconnecting}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold disabled:opacity-50"
              >
                {isDisconnecting ? 'Disconnecting...' : 'Yes, Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deployment Logs Modal */}
      {logsModalData && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
        >
          <div
            onClick={() => setLogsModalData(null)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-4xl max-h-[85vh] rounded-2xl border border-cyan-500/30 bg-slate-950 p-6 z-10 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Terminal className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">
                  Deployment Logs — <span className="font-mono text-cyan-300">{logsModalData.deploymentId.substring(0, 8)}</span>
                </h3>
              </div>
              <button
                onClick={() => setLogsModalData(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto mt-4 p-4 rounded-xl bg-slate-900/90 border border-slate-800 font-mono text-xs space-y-1.5 min-h-[300px] max-h-[550px]">
              {logsModalData.logs.length === 0 ? (
                <div className="text-slate-500 italic">No logs available for this deployment yet.</div>
              ) : (
                logsModalData.logs.map((log, index) => (
                  <div
                    key={index}
                    className={`leading-relaxed whitespace-pre-wrap break-all ${
                      log.level === 'ERROR'
                        ? 'text-rose-400'
                        : log.level === 'WARN'
                          ? 'text-amber-300'
                          : 'text-slate-300'
                    }`}
                  >
                    <span className="text-slate-500 select-none mr-2">
                      [{new Date(log.timestamp).toLocaleTimeString()}]
                    </span>
                    {log.stage && (
                      <span className="text-cyan-400 font-semibold select-none mr-2">
                        [{log.stage}]
                      </span>
                    )}
                    <span>{log.message}</span>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800 mt-4 text-xs text-slate-400">
              <span>{logsModalData.logs.length} log lines captured</span>
              <button
                onClick={() => setLogsModalData(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 7: Add Environment Variable Modal */}
      {showAddVarModal && selectedEnvId && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
        >
          <div
            onClick={() => !isSavingVar && setShowAddVarModal(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />
          <form
            onSubmit={handleSetVariable}
            className="relative w-full max-w-lg rounded-2xl border border-blue-500/30 bg-slate-950 p-6 z-10 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <KeyRound className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-bold text-white">Add Environment Variable</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddVarModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Variable Key (Name)</label>
                <input
                  type="text"
                  required
                  value={newVarKey}
                  onChange={(e) => setNewVarKey(e.target.value)}
                  placeholder="e.g. DATABASE_URL, API_KEY, PORT"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Variable Value</label>
                <textarea
                  required
                  rows={3}
                  value={newVarVal}
                  onChange={(e) => setNewVarVal(e.target.value)}
                  placeholder="Enter secret connection string, key, or configuration value..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="isSecretCheckbox"
                  checked={newVarIsSecret}
                  onChange={(e) => setNewVarIsSecret(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-blue-500"
                />
                <label htmlFor="isSecretCheckbox" className="text-slate-300 font-medium cursor-pointer">
                  Encrypt with AES-256-GCM (Secret, masked in UI and AI responses)
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddVarModal(false)}
                disabled={isSavingVar}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingVar || !newVarKey.trim() || !newVarVal}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-50 flex items-center space-x-1.5"
              >
                {isSavingVar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
                <span>Save Variable</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Phase 7: Rollback Confirmation Modal */}
      {showRollbackModal && rollbackTargetDeployment && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
        >
          <div
            onClick={() => !isExecutingRollback && setShowRollbackModal(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-md rounded-2xl border border-amber-500/30 bg-slate-950 p-6 z-10 shadow-2xl space-y-4">
            <div className="flex items-center space-x-2 pb-2 border-b border-slate-800">
              <RotateCcw className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-bold text-white">Confirm Deployment Rollback</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              You are initiating a rollback to restore known-healthy{' '}
              <strong className="font-mono text-cyan-300">
                Deployment #{rollbackTargetDeployment.deploymentNumber || 'Target'}
              </strong>{' '}
              (Commit SHA: <code className="text-amber-300">{rollbackTargetDeployment.commitSha?.substring(0, 7) || 'N/A'}</code>).
            </p>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs space-y-1">
              <span className="font-bold block text-amber-300">Deterministic Invariant Safeguard:</span>
              <p className="text-[11px] leading-normal text-amber-200/90">
                Rollback will spawn a NEW immutable deployment record referencing the previous healthy image/commit. Historical logs and build artifacts will remain intact.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowRollbackModal(false)}
                disabled={isExecutingRollback}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteRollback}
                disabled={isExecutingRollback}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold disabled:opacity-50 flex items-center space-x-1.5"
              >
                {isExecutingRollback ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Executing Rollback...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Execute Rollback</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500 bg-[#090d16]/80 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>&copy; {new Date().getFullYear()} CloudPilot Platform. Phase 3.1 Ready.</span>
          <div className="flex items-center space-x-4 text-slate-400">
            <span>Next.js 15</span>
            <span>&bull;</span>
            <span>NestJS 11</span>
            <span>&bull;</span>
            <span>Prisma</span>
            <span>&bull;</span>
            <span>PostgreSQL</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
