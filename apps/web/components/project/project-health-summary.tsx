'use client';

import React from 'react';
import {
  ShieldCheck,
  Layers,
  Cpu,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Server,
  Network,
  Boxes,
} from 'lucide-react';
import {
  RepositoryAnalysisDto,
  DeploymentDto,
  DeploymentPlan,
  DeploymentReadinessDto,
} from '@cloudpilot/shared';
import { StatusBadge } from '@/components/ui/status-badge';

interface ProjectHealthSummaryProps {
  analysis: RepositoryAnalysisDto | null;
  latestDeployment: DeploymentDto | null;
  deploymentPlan: DeploymentPlan | null;
  onNavigateTab?: (tab: string) => void;
}

export const ProjectHealthSummary: React.FC<ProjectHealthSummaryProps> = ({
  analysis,
  latestDeployment,
  deploymentPlan,
  onNavigateTab,
}) => {
  const readiness = analysis?.readiness;
  const score = readiness?.score ?? 0;
  const status = readiness?.status ?? 'UNKNOWN';
  const appCount = analysis?.structure?.applications?.length ?? 1;
  const strategy = deploymentPlan?.strategy ?? analysis?.readiness?.strategy ?? 'NODE_APPLICATION';

  // Distinct port representations
  const applicationPort = latestDeployment?.exposedPort ?? deploymentPlan?.exposedPort ?? 5000;
  const hostPort = latestDeployment?.hostPort ?? null;
  const isHealthy = latestDeployment?.healthStatus === 'HEALTHY' || latestDeployment?.status === 'RUNNING';

  return (
    <div className="rounded-xl border border-surface-border bg-card/50 backdrop-blur-sm p-4 sm:p-5 shadow-sm">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 divide-y md:divide-y-0 md:divide-x divide-surface-border">
        {/* 1. Deployment Readiness Score */}
        <div
          onClick={() => onNavigateTab && onNavigateTab('readiness')}
          className="flex items-center space-x-3.5 cursor-pointer group pt-2 md:pt-0"
        >
          <div className="relative flex-shrink-0 w-12 h-12 rounded-xl bg-accent flex items-center justify-center border border-surface-border group-hover:border-sky-500/40 transition-colors">
            <span className="text-sm font-bold text-sky-600 dark:text-sky-400 font-mono">
              {readiness ? `${score}` : '--'}
            </span>
          </div>
          <div>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
              Readiness Score
            </span>
            <div className="flex items-center space-x-1.5 mt-0.5">
              <StatusBadge status={status} size="sm" />
            </div>
          </div>
        </div>

        {/* 2. Architecture & Applications */}
        <div
          onClick={() => onNavigateTab && onNavigateTab('applications')}
          className="flex items-center space-x-3.5 md:pl-6 cursor-pointer group pt-2 md:pt-0"
        >
          <div className="p-3 rounded-xl bg-surface border border-surface-border text-muted-foreground group-hover:text-foreground group-hover:border-slate-400 dark:group-hover:border-slate-600 transition-all flex-shrink-0">
            <Boxes className="w-5 h-5 text-sky-500" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
              Architecture
            </span>
            <span className="text-sm font-semibold text-foreground">
              {analysis?.structure?.primaryRole || 'FULLSTACK'}
            </span>
            <span className="text-xs text-muted-foreground block">
              {appCount} {appCount === 1 ? 'Application' : 'Applications'} {analysis?.isMonorepo ? '• Monorepo' : ''}
            </span>
          </div>
        </div>

        {/* 3. Tech Stack */}
        <div
          onClick={() => onNavigateTab && onNavigateTab('repository')}
          className="flex items-center space-x-3.5 md:pl-6 cursor-pointer group pt-2 md:pt-0"
        >
          <div className="p-3 rounded-xl bg-surface border border-surface-border text-muted-foreground group-hover:text-foreground group-hover:border-slate-400 dark:group-hover:border-slate-600 transition-all flex-shrink-0">
            <Layers className="w-5 h-5 text-indigo-500" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
              Technology
            </span>
            <span className="text-sm font-semibold text-foreground">
              {analysis?.primaryLanguage || 'JavaScript'}
            </span>
            <span className="text-xs text-muted-foreground block">
              {analysis?.packageManager || 'npm'} {analysis?.framework ? `• ${analysis.framework}` : ''}
            </span>
          </div>
        </div>

        {/* 4. Active Deployment & Health (Distinct App vs Host Port) */}
        <div
          onClick={() => onNavigateTab && onNavigateTab('deployment')}
          className="flex items-center space-x-3.5 md:pl-6 cursor-pointer group pt-2 md:pt-0"
        >
          <div className="p-3 rounded-xl bg-surface border border-surface-border text-muted-foreground group-hover:text-foreground group-hover:border-slate-400 dark:group-hover:border-slate-600 transition-all flex-shrink-0">
            <Server className={`w-5 h-5 ${isHealthy ? 'text-emerald-500' : 'text-amber-500'}`} />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
              Deployment
            </span>
            {latestDeployment ? (
              <div>
                <div className="flex items-center space-x-1.5">
                  <StatusBadge status={latestDeployment.status} size="sm" pulse={latestDeployment.status === 'RUNNING'} />
                </div>
                <p className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate">
                  Port: {applicationPort} {hostPort ? `(Host: ${hostPort})` : ''}
                </p>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground italic">
                Ready for initial deploy
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
