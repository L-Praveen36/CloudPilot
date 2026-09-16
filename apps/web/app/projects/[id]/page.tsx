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
  DeploymentTelemetrySummary,
  AiRepositoryUnderstanding,
  AiDeploymentProposal,
  AiFailureDiagnosis,
  AiRepairSuggestion,
  AiAgentResponse,
  EnvironmentDto,
  EnvironmentVariableDto,
  GithubWebhookEventDto,
  CicdSettingsDto,
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
  getDeploymentTelemetry,
  collectDeploymentMetrics,
  getAiRepositoryUnderstanding,
  getAiDeploymentProposal,
  diagnoseAiBuildFailure,
  diagnoseAiIncident,
  getAiRepairSuggestions,
  approveAiRepairSuggestion,
  rejectAiRepairSuggestion,
  runAiAgent,
  getEnvironments,
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
import { ProjectHeader } from '@/components/project/project-header';
import { ProjectHealthSummary } from '@/components/project/project-health-summary';
import { ProjectNav, ProjectTabType } from '@/components/project/project-nav';
import { OverviewTab } from '@/components/project/tabs/overview-tab';
import { ApplicationsTab } from '@/components/project/tabs/applications-tab';
import { RepositoryTab } from '@/components/project/tabs/repository-tab';
import { ReadinessTab } from '@/components/project/tabs/readiness-tab';
import { DeploymentTab } from '@/components/project/tabs/deployment-tab';
import { ObservabilityTab } from '@/components/project/tabs/observability-tab';
import { AiTab } from '@/components/project/tabs/ai-tab';
import { CicdTab } from '@/components/project/tabs/cicd-tab';
import { DisconnectModal } from '@/components/project/modals/disconnect-modal';
import { RollbackModal } from '@/components/project/modals/rollback-modal';
import { AlertCircle, CheckCircle2, RefreshCw, FolderGit2, ArrowLeft } from 'lucide-react';

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

export default function ProjectDetailsPage({ params }: ProjectPageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;

  // Active View Tab
  const [activeTab, setActiveTab] = useState<ProjectTabType>('overview');

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

  // Deployment Engine State
  const [deployments, setDeployments] = useState<DeploymentDto[]>([]);
  const [deploymentPlan, setDeploymentPlan] = useState<DeploymentPlan | null>(null);
  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  const [isCancellingId, setIsCancellingId] = useState<string | null>(null);
  const [deploymentSuccessMessage, setDeploymentSuccessMessage] = useState<string | null>(null);
  const [deploymentError, setDeploymentError] = useState<string | null>(null);

  // Observability & Telemetry State
  const [telemetry, setTelemetry] = useState<DeploymentTelemetrySummary | null>(null);
  const [isCollectingMetrics, setIsCollectingMetrics] = useState<boolean>(false);

  // AI Intelligence State
  const [aiUnderstanding, setAiUnderstanding] = useState<AiRepositoryUnderstanding | null>(null);
  const [aiProposal, setAiProposal] = useState<AiDeploymentProposal | null>(null);
  const [aiDiagnosis, setAiDiagnosis] = useState<AiFailureDiagnosis | null>(null);
  const [aiRepairSuggestions, setAiRepairSuggestions] = useState<AiRepairSuggestion[]>([]);
  const [aiAgentResponse, setAiAgentResponse] = useState<AiAgentResponse | null>(null);
  const [isAgentRunning, setIsAgentRunning] = useState<boolean>(false);
  const [isApprovingRepairId, setIsApprovingRepairId] = useState<string | null>(null);
  const [isRejectingRepairId, setIsRejectingRepairId] = useState<string | null>(null);

  // CI/CD & Environments State
  const [environments, setEnvironments] = useState<EnvironmentDto[]>([]);
  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(null);
  const [envVariables, setEnvVariables] = useState<EnvironmentVariableDto[]>([]);
  const [isSavingVar, setIsSavingVar] = useState<boolean>(false);
  const [isDeletingVarId, setIsDeletingVarId] = useState<string | null>(null);
  const [cicdSettings, setCicdSettings] = useState<CicdSettingsDto | null>(null);
  const [webhookEvents, setWebhookEvents] = useState<GithubWebhookEventDto[]>([]);
  const [rollbackTargetDeployment, setRollbackTargetDeployment] = useState<DeploymentDto | null>(null);
  const [showRollbackModal, setShowRollbackModal] = useState<boolean>(false);
  const [isExecutingRollback, setIsExecutingRollback] = useState<boolean>(false);

  // Disconnect Confirmation Modal State
  const [showDisconnectModal, setShowDisconnectModal] = useState<boolean>(false);
  const [isDisconnecting, setIsDisconnecting] = useState<boolean>(false);

  // 1. Verify User Session on Mount
  useEffect(() => {
    let isMounted = true;
    async function loadUser() {
      try {
        const data = await getCurrentUser();
        if (isMounted) setUser(data.user);
      } catch {
        if (isMounted) router.replace('/');
      } finally {
        if (isMounted) setIsAuthLoading(false);
      }
    }
    loadUser();
    return () => { isMounted = false; };
  }, [router]);

  // 2. Load Project & Subsystem Data
  const loadProject = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    setErrorMessage(null);
    setIsNotFound(false);

    try {
      const data = await getProject(projectId);
      setProject(data.project);

      // Try loading intelligence analysis
      try {
        const analysisData = await getProjectAnalysis(projectId);
        setAnalysis(analysisData.analysis);
      } catch (err: any) {
        if (err?.status !== 404) console.warn('Could not load analysis:', err);
      }

      // Try loading deployment plan
      try {
        const planData = await getDeploymentPlan(projectId);
        setDeploymentPlan(planData.plan);
      } catch (err: any) {
        if (err?.status !== 404) console.warn('Could not load deployment plan:', err);
      }

      // Try loading deployments list
      try {
        const depRes = await getDeployments(projectId);
        setDeployments(depRes.deployments);

        if (depRes.deployments.length > 0) {
          const latest = depRes.deployments[0];
          try {
            const tel = await getDeploymentTelemetry(projectId, latest.id);
            setTelemetry(tel.telemetry);
          } catch {}
        }
      } catch (err: any) {
        if (err?.status !== 404) console.warn('Could not load deployments:', err);
      }

      // Try loading environments
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
        if (err?.status !== 404) console.warn('Could not load environments:', err);
      }

      // Try loading CI/CD settings
      try {
        const cicdRes = await getCicdSettings(projectId);
        setCicdSettings(cicdRes.settings);
      } catch (err: any) {
        if (err?.status !== 404) console.warn('Could not load CI/CD settings:', err);
      }

      // Try loading Webhook Events
      try {
        const webhookRes = await getWebhookEvents(projectId, 20);
        setWebhookEvents(webhookRes.events);
      } catch (err: any) {
        if (err?.status !== 404) console.warn('Could not load webhook events:', err);
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
        setErrorMessage('Failed to load project details.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [projectId, router]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  // Load environment variables when selectedEnvId changes
  useEffect(() => {
    if (!projectId || !selectedEnvId) return;
    let isMounted = true;
    getEnvironmentVariables(projectId, selectedEnvId)
      .then((res) => {
        if (isMounted) setEnvVariables(res.variables);
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, [projectId, selectedEnvId]);

  // Handle Full Project Analysis Trigger
  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setErrorMessage(null);
    try {
      await analyzeProject(projectId);
      await analyzeProjectStructure(projectId);
      await analyzeProjectReadiness(projectId);
      const planRes = await getDeploymentPlan(projectId);
      setDeploymentPlan(planRes.plan);
      const analysisData = await getProjectAnalysis(projectId);
      setAnalysis(analysisData.analysis);
      setDeploymentSuccessMessage('Repository intelligence analysis complete.');
      setTimeout(() => setDeploymentSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle Triggering Deployment
  const handleDeploy = async () => {
    setIsDeploying(true);
    setDeploymentError(null);
    setDeploymentSuccessMessage(null);

    try {
      const response = await createDeployment(projectId, selectedEnvId || undefined);
      setDeployments((prev) => [response.deployment, ...prev]);
      setDeploymentSuccessMessage('Deployment initiated! Container build & run in progress.');
      setActiveTab('deployment');

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

  // Handle Cancel Deployment
  const handleCancelDeployment = async (deploymentId: string) => {
    setIsCancellingId(deploymentId);
    try {
      const res = await cancelDeployment(projectId, deploymentId);
      setDeployments((prev) => prev.map((d) => (d.id === deploymentId ? res.deployment : d)));
      setDeploymentSuccessMessage('Deployment cancelled.');
      setTimeout(() => setDeploymentSuccessMessage(null), 3000);
    } catch (err: any) {
      setDeploymentError(err.message || 'Failed to cancel deployment.');
    } finally {
      setIsCancellingId(null);
    }
  };

  // Handle Disconnect Project
  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await deleteProject(projectId);
      router.replace('/dashboard');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to disconnect project.');
      setShowDisconnectModal(false);
    } finally {
      setIsDisconnecting(false);
    }
  };

  // Handle Collect Metrics
  const handleCollectMetrics = async () => {
    const latest = deployments[0];
    if (!latest) return;
    setIsCollectingMetrics(true);
    try {
      await collectDeploymentMetrics(projectId, latest.id);
      const tel = await getDeploymentTelemetry(projectId, latest.id);
      setTelemetry(tel.telemetry);
    } catch (err: any) {
      console.warn('Could not collect metrics:', err);
    } finally {
      setIsCollectingMetrics(false);
    }
  };

  // Handle Save Environment Variable
  const handleSaveVariable = async (key: string, value: string, isSecret: boolean) => {
    if (!selectedEnvId) return;
    setIsSavingVar(true);
    try {
      const res = await setEnvironmentVariable(projectId, selectedEnvId, { key, value, isSecret });
      setEnvVariables((prev) => {
        const existingIdx = prev.findIndex((v) => v.id === res.variable.id);
        if (existingIdx !== -1) {
          const copy = [...prev];
          copy[existingIdx] = res.variable;
          return copy;
        }
        return [...prev, res.variable];
      });
      setDeploymentSuccessMessage(`Variable '${res.variable.key}' encrypted and saved.`);
      setTimeout(() => setDeploymentSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save variable.');
    } finally {
      setIsSavingVar(false);
    }
  };

  // Handle Delete Environment Variable
  const handleDeleteVariable = async (varId: string, varKey: string) => {
    if (!selectedEnvId) return;
    setIsDeletingVarId(varId);
    try {
      await deleteEnvironmentVariable(projectId, selectedEnvId, varId);
      setEnvVariables((prev) => prev.filter((v) => v.id !== varId));
      setDeploymentSuccessMessage(`Variable '${varKey}' deleted.`);
      setTimeout(() => setDeploymentSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete variable.');
    } finally {
      setIsDeletingVarId(null);
    }
  };

  // Handle Save Webhook Secret
  const handleSaveWebhookSecret = async (secret: string) => {
    try {
      const res = await updateCicdSettings(projectId, { webhookSecret: secret });
      setCicdSettings(res.settings);
      setDeploymentSuccessMessage('GitHub Webhook HMAC secret updated.');
      setTimeout(() => setDeploymentSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update Webhook secret.');
    }
  };

  // Handle Execute Rollback
  const handleExecuteRollback = async () => {
    if (!rollbackTargetDeployment) return;
    const latestDep = deployments[0];
    if (!latestDep) return;

    setIsExecutingRollback(true);
    try {
      const res = await rollbackDeployment(projectId, latestDep.id, {
        targetDeploymentId: rollbackTargetDeployment.id,
      });
      setDeployments((prev) => [res.rollbackDeployment, ...prev]);
      setShowRollbackModal(false);
      setDeploymentSuccessMessage(
        `Rollback initiated! Restoring configuration of Deployment #${rollbackTargetDeployment.deploymentNumber}.`,
      );
      setTimeout(async () => {
        try {
          const updated = await getDeployments(projectId);
          setDeployments(updated.deployments);
        } catch {}
      }, 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Rollback failed.');
    } finally {
      setIsExecutingRollback(false);
    }
  };

  // Handle AI Actions
  const handleApproveRepair = async (id: string) => {
    setIsApprovingRepairId(id);
    try {
      await approveAiRepairSuggestion(projectId, id);
      setAiRepairSuggestions((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'APPROVED' } : r)),
      );
    } catch {} finally {
      setIsApprovingRepairId(null);
    }
  };

  const handleRejectRepair = async (id: string) => {
    setIsRejectingRepairId(id);
    try {
      await rejectAiRepairSuggestion(projectId, id);
      setAiRepairSuggestions((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'REJECTED' } : r)),
      );
    } catch {} finally {
      setIsRejectingRepairId(null);
    }
  };

  const handleRunAgent = async (prompt: string) => {
    setIsAgentRunning(true);
    try {
      const res = await runAiAgent(projectId, { prompt });
      setAiAgentResponse(res);
    } catch (err: any) {
      setErrorMessage(err.message || 'AI agent execution failed.');
    } finally {
      setIsAgentRunning(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      router.replace('/');
    } catch {
      router.replace('/');
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-9 h-9 border-3 border-sky-500/20 border-t-sky-500 rounded-full animate-spin" />
          <p className="text-xs font-medium">Verifying CloudPilot session...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const selectedEnv = environments.find((e) => e.id === selectedEnvId);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between relative">
      {/* Top Header */}
      <DashboardHeader
        user={user}
        onLogout={handleLogout}
        loggingOut={isLoggingOut}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Error Notification Banner */}
        {(errorMessage || deploymentError) && (
          <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 flex items-start justify-between gap-3 text-xs">
            <div className="flex items-start space-x-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
              <div>
                <span className="font-bold block">Action Notice</span>
                <span className="mt-0.5 block leading-relaxed">{errorMessage || deploymentError}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setErrorMessage(null); setDeploymentError(null); }}
              className="text-muted-foreground hover:text-foreground font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Success Toast Banner */}
        {deploymentSuccessMessage && (
          <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 flex items-center space-x-2.5 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <span className="font-medium">{deploymentSuccessMessage}</span>
          </div>
        )}

        {/* 404 State */}
        {isNotFound ? (
          <div className="flex flex-col items-center justify-center p-16 text-center rounded-2xl border border-dashed border-surface-border bg-card">
            <div className="p-3.5 rounded-2xl bg-amber-500/10 text-amber-500 mb-4 border border-amber-500/20">
              <FolderGit2 className="w-8 h-8" />
            </div>
            <h2 className="text-base font-bold text-foreground mb-1">Project Not Found</h2>
            <p className="text-xs text-muted-foreground max-w-md mb-6 leading-relaxed">
              The project you requested does not exist or you do not have permission to view it.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-surface hover:bg-surface-hover border border-surface-border text-foreground text-xs font-semibold transition-all focus-ring"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Dashboard</span>
            </Link>
          </div>
        ) : isLoading || !project ? (
          /* Loading Skeleton */
          <div className="space-y-6 animate-pulse">
            <div className="h-28 rounded-xl border border-surface-border bg-card p-6" />
            <div className="h-20 rounded-xl border border-surface-border bg-card p-4" />
            <div className="h-64 rounded-xl border border-surface-border bg-card p-6" />
          </div>
        ) : (
          /* Main Project UI */
          <div className="space-y-6">
            {/* 1. Project Header */}
            <ProjectHeader
              project={project}
              isAnalyzing={isAnalyzing}
              isDeploying={isDeploying}
              onAnalyze={handleAnalyze}
              onDeploy={handleDeploy}
              onDisconnect={() => setShowDisconnectModal(true)}
              lastAnalyzedAt={analysis?.updatedAt}
              selectedEnvironmentName={selectedEnv?.name}
            />

            {/* 2. Project Health Summary Strip */}
            <ProjectHealthSummary
              analysis={analysis}
              latestDeployment={deployments[0] || null}
              deploymentPlan={deploymentPlan}
              onNavigateTab={(tab) => setActiveTab(tab as ProjectTabType)}
            />

            {/* 3. Section Navigation Tabs */}
            <ProjectNav
              activeTab={activeTab}
              onTabChange={setActiveTab}
              badgeCounts={{
                applications: analysis?.structure?.applications?.length,
                readinessScore: analysis?.readiness?.score,
                deployments: deployments.length,
                aiRepairs: aiRepairSuggestions.filter((r) => r.status === 'PROPOSED').length,
              }}
            />

            {/* 4. Active Tab Content */}
            <div className="pt-2">
              {activeTab === 'overview' && (
                <OverviewTab
                  project={project}
                  analysis={analysis}
                  latestDeployment={deployments[0] || null}
                  deploymentPlan={deploymentPlan}
                  onNavigateTab={setActiveTab}
                />
              )}

              {activeTab === 'applications' && (
                <ApplicationsTab
                  structure={analysis?.structure || null}
                  onReanalyzeStructure={handleAnalyze}
                  isAnalyzing={isAnalyzing}
                />
              )}

              {activeTab === 'repository' && (
                <RepositoryTab
                  analysis={analysis}
                  onReanalyze={handleAnalyze}
                  isAnalyzing={isAnalyzing}
                />
              )}

              {activeTab === 'readiness' && (
                <ReadinessTab
                  readiness={analysis?.readiness || null}
                  deploymentPlan={deploymentPlan}
                  onReanalyzeReadiness={handleAnalyze}
                  isAnalyzing={isAnalyzing}
                />
              )}

              {activeTab === 'deployment' && (
                <DeploymentTab
                  deployments={deployments}
                  deploymentPlan={deploymentPlan}
                  environments={environments}
                  selectedEnvId={selectedEnvId}
                  onSelectEnv={setSelectedEnvId}
                  onDeploy={handleDeploy}
                  onCancelDeployment={handleCancelDeployment}
                  isDeploying={isDeploying}
                  isCancellingId={isCancellingId}
                  onOpenRollbackModal={(dep) => {
                    setRollbackTargetDeployment(dep);
                    setShowRollbackModal(true);
                  }}
                />
              )}

              {activeTab === 'observability' && (
                <ObservabilityTab
                  telemetry={telemetry}
                  latestDeployment={deployments[0] || null}
                  onCollectMetrics={handleCollectMetrics}
                  isCollecting={isCollectingMetrics}
                />
              )}

              {activeTab === 'ai' && (
                <AiTab
                  understanding={aiUnderstanding}
                  proposal={aiProposal}
                  diagnosis={aiDiagnosis}
                  repairSuggestions={aiRepairSuggestions}
                  agentResponse={aiAgentResponse}
                  onApproveRepair={handleApproveRepair}
                  onRejectRepair={handleRejectRepair}
                  onRunAgent={handleRunAgent}
                  isAgentRunning={isAgentRunning}
                  isApprovingId={isApprovingRepairId}
                  isRejectingId={isRejectingRepairId}
                />
              )}

              {activeTab === 'cicd' && (
                <CicdTab
                  environments={environments}
                  selectedEnvId={selectedEnvId}
                  onSelectEnv={setSelectedEnvId}
                  envVariables={envVariables}
                  onSaveVariable={handleSaveVariable}
                  onDeleteVariable={handleDeleteVariable}
                  cicdSettings={cicdSettings}
                  onSaveWebhookSecret={handleSaveWebhookSecret}
                  webhookEvents={webhookEvents}
                  deployments={deployments}
                  onOpenRollbackModal={(dep) => {
                    setRollbackTargetDeployment(dep);
                    setShowRollbackModal(true);
                  }}
                  isSavingVariable={isSavingVar}
                  isDeletingVarId={isDeletingVarId}
                />
              )}
            </div>
          </div>
        )}
      </main>

      {/* Disconnect Modal */}
      {project && (
        <DisconnectModal
          isOpen={showDisconnectModal}
          onClose={() => setShowDisconnectModal(false)}
          projectName={project.repositoryName}
          onConfirm={handleDisconnect}
          isDisconnecting={isDisconnecting}
        />
      )}

      {/* Rollback Modal */}
      <RollbackModal
        isOpen={showRollbackModal}
        onClose={() => setShowRollbackModal(false)}
        targetDeployment={rollbackTargetDeployment}
        onConfirm={handleExecuteRollback}
        isExecuting={isExecutingRollback}
      />

      {/* Footer */}
      <footer className="border-t border-surface-border py-4 px-4 sm:px-8 text-center text-xs text-muted-foreground bg-card/40 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>&copy; {new Date().getFullYear()} CloudPilot Platform • Autonomous Cloud Orchestration</span>
          <span className="font-mono text-[11px] text-muted-foreground/60">Console v2.1</span>
        </div>
      </footer>
    </div>
  );
}
