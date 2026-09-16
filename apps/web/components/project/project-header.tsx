'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ExternalLink,
  GitBranch,
  Globe,
  Lock,
  RefreshCw,
  Rocket,
  Trash2,
  CheckCircle2,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';
import { ProjectDto } from '@cloudpilot/shared';
import { CopyButton } from '@/components/ui/copy-button';
import { StatusBadge } from '@/components/ui/status-badge';

interface ProjectHeaderProps {
  project: ProjectDto;
  isAnalyzing: boolean;
  isDeploying: boolean;
  onAnalyze: () => void;
  onDeploy: () => void;
  onDisconnect: () => void;
  lastAnalyzedAt?: string;
  selectedEnvironmentName?: string;
}

export const ProjectHeader: React.FC<ProjectHeaderProps> = ({
  project,
  isAnalyzing,
  isDeploying,
  onAnalyze,
  onDeploy,
  onDisconnect,
  lastAnalyzedAt,
  selectedEnvironmentName,
}) => {
  return (
    <div className="border-b border-surface-border bg-card/60 backdrop-blur-md pb-6 pt-2">
      {/* Top Breadcrumb & Project Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors focus-ring rounded p-1 -m-1 w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Projects</span>
        </Link>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <a
            href={project.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-surface-border bg-surface hover:bg-surface-hover text-foreground text-xs font-medium transition-colors focus-ring"
          >
            <span>View on GitHub</span>
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
          </a>

          <button
            type="button"
            onClick={onAnalyze}
            disabled={isAnalyzing}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 text-xs font-semibold transition-all focus-ring disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
            <span>{isAnalyzing ? 'Analyzing...' : 'Analyze'}</span>
          </button>

          <button
            type="button"
            onClick={onDeploy}
            disabled={isDeploying}
            className="inline-flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-sm hover:shadow transition-all focus-ring disabled:opacity-50"
          >
            <Rocket className={`w-3.5 h-3.5 ${isDeploying ? 'animate-bounce' : ''}`} />
            <span>{isDeploying ? 'Deploying...' : `Deploy ${selectedEnvironmentName ? `(${selectedEnvironmentName})` : ''}`}</span>
          </button>

          <button
            type="button"
            onClick={onDisconnect}
            aria-label="Disconnect Project"
            title="Disconnect project from CloudPilot"
            className="p-1.5 rounded-lg border border-surface-border bg-surface hover:bg-rose-500/10 hover:border-rose-500/30 text-muted-foreground hover:text-rose-500 transition-colors focus-ring"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Title Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="text-sm font-medium text-muted-foreground">
              {project.repositoryOwner}
            </span>
            <span className="text-muted-foreground/40">/</span>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
              {project.repositoryName}
            </h1>

            {project.private ? (
              <span className="inline-flex items-center space-x-1 text-[11px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-medium">
                <Lock className="w-3 h-3" />
                <span>Private</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 text-[11px] px-2 py-0.5 rounded-md bg-surface text-muted-foreground border border-surface-border font-medium">
                <Globe className="w-3 h-3" />
                <span>Public</span>
              </span>
            )}

            <StatusBadge status="CONNECTED" label="Connected" size="sm" />
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mt-2">
            <div className="inline-flex items-center space-x-1 font-mono">
              <GitBranch className="w-3.5 h-3.5 text-sky-500" />
              <span>{project.defaultBranch || 'main'}</span>
            </div>

            {lastAnalyzedAt && (
              <span className="hidden sm:inline text-muted-foreground/60">
                • Analyzed {new Date(lastAnalyzedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}

            <div className="inline-flex items-center space-x-1">
              <span className="text-muted-foreground/60">ID:</span>
              <span className="font-mono text-[11px] text-muted-foreground truncate max-w-[120px] sm:max-w-none">
                {project.id}
              </span>
              <CopyButton textToCopy={project.id} label="" successLabel="" iconOnly size="sm" variant="ghost" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
