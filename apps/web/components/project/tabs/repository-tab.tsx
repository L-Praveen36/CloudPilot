'use client';

import React, { useState } from 'react';
import { RepositoryAnalysisDto } from '@cloudpilot/shared';
import { FilesDrawer } from '../modals/files-drawer';
import { CopyButton } from '@/components/ui/copy-button';
import {
  FolderGit2,
  FileCode2,
  Package,
  Layers,
  Settings,
  FileCheck,
  CheckCircle2,
  XCircle,
  ExternalLink,
} from 'lucide-react';

interface RepositoryTabProps {
  analysis: RepositoryAnalysisDto | null;
  onReanalyze?: () => void;
  isAnalyzing?: boolean;
}

export const RepositoryTab: React.FC<RepositoryTabProps> = ({
  analysis,
  onReanalyze,
  isAnalyzing = false,
}) => {
  const [showFilesDrawer, setShowFilesDrawer] = useState(false);

  const detectedFiles = analysis?.detectedFiles || [];

  const formatCopyRepoAnalysis = () => {
    return [
      'CloudPilot Repository Intelligence',
      '==================================',
      `Project Type: ${analysis?.projectType || 'Web Application'}`,
      `Primary Language: ${analysis?.primaryLanguage || 'JavaScript'}`,
      `Package Manager: ${analysis?.packageManager || 'npm'}`,
      `Framework: ${analysis?.framework || 'None / Standard'}`,
      `Monorepo: ${analysis?.isMonorepo ? 'Yes' : 'No'}`,
      `Dockerfile: ${analysis?.hasDockerfile ? 'Present' : 'None (Auto-generated)'}`,
      `Docker Compose: ${analysis?.hasDockerCompose ? 'Present' : 'None'}`,
      `Env Example: ${analysis?.hasEnvExample ? 'Present' : 'None'}`,
      `Detected Files: ${detectedFiles.length} files`,
    ].join('\n');
  };

  return (
    <div className="space-y-6">
      {/* Tab Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-surface-border">
        <div>
          <h2 className="text-base font-semibold text-foreground tracking-tight">
            Repository Intelligence
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Static code analysis, runtime manifest detection, and project structure classification.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <CopyButton
            textToCopy={formatCopyRepoAnalysis}
            label="Copy Analysis"
            variant="outline"
          />
        </div>
      </div>

      {/* Technology Stack Matrix */}
      <div className="rounded-xl border border-surface-border bg-card p-5 space-y-4">
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
          Technology Stack & Frameworks
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-surface border border-surface-border">
            <span className="text-[11px] text-muted-foreground block">Project Type</span>
            <span className="font-semibold text-foreground mt-0.5 block">{analysis?.projectType || 'Web Application'}</span>
          </div>

          <div className="p-3 rounded-lg bg-surface border border-surface-border">
            <span className="text-[11px] text-muted-foreground block">Primary Language</span>
            <span className="font-semibold text-foreground mt-0.5 block">{analysis?.primaryLanguage || 'JavaScript'}</span>
          </div>

          <div className="p-3 rounded-lg bg-surface border border-surface-border">
            <span className="text-[11px] text-muted-foreground block">Package Manager</span>
            <span className="font-semibold text-foreground mt-0.5 block">{analysis?.packageManager || 'npm'}</span>
          </div>

          <div className="p-3 rounded-lg bg-surface border border-surface-border">
            <span className="text-[11px] text-muted-foreground block">Framework</span>
            <span className="font-semibold text-foreground mt-0.5 block">{analysis?.framework || 'None / Standard'}</span>
          </div>
        </div>
      </div>

      {/* Configuration & Manifests Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-surface-border bg-card p-5 space-y-3">
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Container & Environment Manifests
          </h3>

          <div className="space-y-2 text-xs">
            <div className="p-3 rounded-lg bg-surface border border-surface-border flex items-center justify-between">
              <div>
                <span className="font-semibold text-foreground block">Dockerfile</span>
                <span className="text-[11px] text-muted-foreground">
                  {analysis?.hasDockerfile ? 'Custom Dockerfile in repository root' : 'Auto-generated multi-stage Dockerfile'}
                </span>
              </div>
              {analysis?.hasDockerfile ? (
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Present
                </span>
              ) : (
                <span className="text-[11px] text-sky-600 dark:text-sky-400 font-medium bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20">
                  CloudPilot Managed
                </span>
              )}
            </div>

            <div className="p-3 rounded-lg bg-surface border border-surface-border flex items-center justify-between">
              <div>
                <span className="font-semibold text-foreground block">Environment Template</span>
                <span className="text-[11px] text-muted-foreground">
                  {analysis?.hasEnvExample ? '.env.example configuration template' : 'No .env.example found'}
                </span>
              </div>
              {analysis?.hasEnvExample ? (
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Documented
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground bg-surface px-2 py-0.5 rounded-full border border-surface-border">
                  None
                </span>
              )}
            </div>

            <div className="p-3 rounded-lg bg-surface border border-surface-border flex items-center justify-between">
              <div>
                <span className="font-semibold text-foreground block">Monorepo Architecture</span>
                <span className="text-[11px] text-muted-foreground">
                  {analysis?.isMonorepo ? 'Multi-application workspace detected' : 'Standard single project root'}
                </span>
              </div>
              <span className="text-[11px] font-mono font-medium text-foreground">
                {analysis?.isMonorepo ? 'YES' : 'NO'}
              </span>
            </div>
          </div>
        </div>

        {/* Detected Files Preview */}
        <div className="rounded-xl border border-surface-border bg-card p-5 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Detected Files Preview ({detectedFiles.length})
              </h3>
              <button
                type="button"
                onClick={() => setShowFilesDrawer(true)}
                className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1 focus-ring rounded"
              >
                <span>View all files</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-1.5 text-xs">
              {detectedFiles.slice(0, 5).map((f) => (
                <div
                  key={f}
                  className="px-2.5 py-1.5 rounded-lg bg-surface/60 border border-surface-border font-mono text-[11px] text-muted-foreground flex items-center justify-between"
                >
                  <span className="truncate">{f}</span>
                  <span className="text-[10px] text-muted-foreground uppercase font-sans">
                    Mapped
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-surface-border flex items-center justify-between text-xs">
            <span className="text-muted-foreground text-[11px]">
              {detectedFiles.length > 5 ? `+ ${detectedFiles.length - 5} more files mapped` : `${detectedFiles.length} files total`}
            </span>
            <button
              type="button"
              onClick={() => setShowFilesDrawer(true)}
              className="px-3 py-1 rounded-lg border border-surface-border bg-surface hover:bg-surface-hover text-foreground text-xs font-medium transition-colors focus-ring"
            >
              Search & Filter Files
            </button>
          </div>
        </div>
      </div>

      {/* Files Drawer */}
      <FilesDrawer
        isOpen={showFilesDrawer}
        onClose={() => setShowFilesDrawer(false)}
        detectedFiles={detectedFiles}
      />
    </div>
  );
};
