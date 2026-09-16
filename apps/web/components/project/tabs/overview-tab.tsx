'use client';

import React from 'react';
import {
  RepositoryAnalysisDto,
  DeploymentDto,
  DeploymentPlan,
  ProjectDto,
} from '@cloudpilot/shared';
import { StatusBadge } from '@/components/ui/status-badge';
import { CopyButton } from '@/components/ui/copy-button';
import {
  FolderGit2,
  Layers,
  Boxes,
  Rocket,
  ShieldCheck,
  Server,
  ArrowRight,
  ExternalLink,
  Code2,
  Terminal,
} from 'lucide-react';
import { ProjectTabType } from '../project-nav';

interface OverviewTabProps {
  project: ProjectDto;
  analysis: RepositoryAnalysisDto | null;
  latestDeployment: DeploymentDto | null;
  deploymentPlan: DeploymentPlan | null;
  onNavigateTab: (tab: ProjectTabType) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  project,
  analysis,
  latestDeployment,
  deploymentPlan,
  onNavigateTab,
}) => {
  const readiness = analysis?.readiness;
  const apps = analysis?.structure?.applications || [];
  const appPort = latestDeployment?.exposedPort ?? deploymentPlan?.exposedPort ?? 5000;
  const hostPort = latestDeployment?.hostPort ?? null;

  const formatCopyOverview = () => {
    const appsSummary = apps.length > 0
      ? apps.map((a) => `- ${a.name} — ${a.role} — ${a.framework || 'Standard'} — Port ${a.port?.port || 'N/A'}`).join('\n')
      : '- Single Monolithic Application';

    return [
      `CloudPilot Project Summary: ${project.repositoryName}`,
      '====================================================',
      `Repository: ${project.repositoryOwner}/${project.repositoryName} (${project.defaultBranch || 'main'})`,
      `Project Type: ${analysis?.projectType || 'Web Application'}`,
      `Primary Language: ${analysis?.primaryLanguage || 'JavaScript'}`,
      `Package Manager: ${analysis?.packageManager || 'npm'}`,
      `Framework: ${analysis?.framework || 'None / Standard'}`,
      `Monorepo: ${analysis?.isMonorepo ? 'Yes' : 'No'}`,
      '',
      `Architecture: ${analysis?.structure?.primaryRole || 'FULLSTACK'} (${apps.length} detected application${apps.length === 1 ? '' : 's'})`,
      appsSummary,
      '',
      `Deployment Readiness: ${readiness?.status || 'READY'} (${readiness?.score || 100}/100)`,
      `Deployment Strategy: ${deploymentPlan?.strategy || readiness?.strategy || 'MULTI_APPLICATION'}`,
      latestDeployment ? `Current Deployment Status: ${latestDeployment.status} (App Port: ${appPort}${hostPort ? `, Host Port: ${hostPort}` : ''})` : 'No active deployment',
    ].join('\n');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Quick Copy Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-surface-border">
        <div>
          <h2 className="text-base font-semibold text-foreground tracking-tight">
            Project Overview
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Holistic snapshot of repository intelligence, architecture, readiness, and active deployment.
          </p>
        </div>
        <CopyButton
          textToCopy={formatCopyOverview}
          label="Copy Project Summary"
          variant="outline"
        />
      </div>

      {/* 4 Pillars Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Repository & Tech Stack */}
        <div className="rounded-xl border border-surface-border bg-card p-5 space-y-4 hover:border-slate-400 dark:hover:border-slate-600 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                <FolderGit2 className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                Repository & Tech Stack
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('repository')}
              className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1 focus-ring rounded"
            >
              <span>View stack</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-2.5 rounded-lg bg-surface border border-surface-border">
              <span className="text-[11px] text-muted-foreground block">Language</span>
              <span className="font-semibold text-foreground">{analysis?.primaryLanguage || 'JavaScript'}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-surface border border-surface-border">
              <span className="text-[11px] text-muted-foreground block">Package Manager</span>
              <span className="font-semibold text-foreground">{analysis?.packageManager || 'npm'}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-surface border border-surface-border">
              <span className="text-[11px] text-muted-foreground block">Framework</span>
              <span className="font-semibold text-foreground">{analysis?.framework || 'None / Standard'}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-surface border border-surface-border">
              <span className="text-[11px] text-muted-foreground block">Monorepo Layout</span>
              <span className="font-semibold text-foreground">{analysis?.isMonorepo ? 'Yes' : 'No'}</span>
            </div>
          </div>
        </div>

        {/* 2. Application Architecture */}
        <div className="rounded-xl border border-surface-border bg-card p-5 space-y-4 hover:border-slate-400 dark:hover:border-slate-600 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                <Boxes className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                Architecture & Services
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('applications')}
              className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1 focus-ring rounded"
            >
              <span>View diagram</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2 text-xs">
            {apps.length === 0 ? (
              <p className="text-muted-foreground italic">Single application structure detected.</p>
            ) : (
              apps.map((app) => (
                <div
                  key={app.name}
                  className="p-2.5 rounded-lg bg-surface border border-surface-border flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-foreground uppercase text-[11px] font-mono">
                      {app.name}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface-hover text-muted-foreground">
                      {app.role}
                    </span>
                  </div>
                  <span className="font-mono text-muted-foreground text-[11px]">
                    {app.framework || 'Node'} • Port: {app.port?.port || 'N/A'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 3. Deployment Readiness */}
        <div className="rounded-xl border border-surface-border bg-card p-5 space-y-4 hover:border-slate-400 dark:hover:border-slate-600 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                Deployment Readiness
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('readiness')}
              className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1 focus-ring rounded"
            >
              <span>Readiness report</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="p-3 rounded-lg bg-surface border border-surface-border flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-base font-bold font-mono text-sky-600 dark:text-sky-400">
                  {readiness?.score ?? 100}/100
                </span>
                <StatusBadge status={readiness?.status || 'READY'} size="sm" />
              </div>
              <span className="text-[11px] text-muted-foreground mt-0.5 block">
                Strategy: {deploymentPlan?.strategy || readiness?.strategy || 'MULTI_APPLICATION'}
              </span>
            </div>

            <div className="text-right text-[11px] text-muted-foreground">
              <span>{readiness?.warnings?.length || 0} warnings</span>
              <span className="block">{readiness?.blockers?.length || 0} blockers</span>
            </div>
          </div>
        </div>

        {/* 4. Active Deployment Console */}
        <div className="rounded-xl border border-surface-border bg-card p-5 space-y-4 hover:border-slate-400 dark:hover:border-slate-600 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                <Rocket className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                Deployment Console
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('deployment')}
              className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1 focus-ring rounded"
            >
              <span>View console & logs</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="p-3 rounded-lg bg-surface border border-surface-border space-y-2 text-xs">
            {latestDeployment ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-foreground">
                      Deployment #{latestDeployment.deploymentNumber}
                    </span>
                    <StatusBadge status={latestDeployment.status} size="sm" />
                  </div>
                  <span className="font-mono text-muted-foreground text-[11px]">
                    {latestDeployment.commitSha?.substring(0, 7) || 'latest'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-surface-border">
                  <span>App Port: <strong className="text-foreground font-mono">{appPort}</strong></span>
                  {hostPort && (
                    <span>Host Port: <strong className="text-foreground font-mono">{hostPort}</strong></span>
                  )}
                  <span>Health: <strong className="text-emerald-500 font-semibold">{latestDeployment.healthStatus}</strong></span>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground italic py-1">No deployments initiated yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
