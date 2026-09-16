'use client';

import React, { useState, useMemo } from 'react';
import {
  DeploymentDto,
  DeploymentLogEntry,
  DeploymentPlan,
  EnvironmentDto,
} from '@cloudpilot/shared';
import { StatusBadge } from '@/components/ui/status-badge';
import { CopyButton } from '@/components/ui/copy-button';
import {
  Rocket,
  Search,
  CheckCircle2,
  Clock,
  Square,
  RefreshCw,
  GitCommit,
  Terminal,
  Layers,
  Server,
  Filter,
  Check,
  RotateCcw,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

interface DeploymentTabProps {
  deployments: DeploymentDto[];
  deploymentPlan: DeploymentPlan | null;
  environments: EnvironmentDto[];
  selectedEnvId: string | null;
  onSelectEnv: (envId: string) => void;
  onDeploy: () => Promise<void>;
  onCancelDeployment: (deploymentId: string) => Promise<void>;
  isDeploying: boolean;
  isCancellingId: string | null;
  onOpenRollbackModal?: (dep: DeploymentDto) => void;
}

export const DeploymentTab: React.FC<DeploymentTabProps> = ({
  deployments,
  deploymentPlan,
  environments,
  selectedEnvId,
  onSelectEnv,
  onDeploy,
  onCancelDeployment,
  isDeploying,
  isCancellingId,
  onOpenRollbackModal,
}) => {
  const [selectedDeploymentId, setSelectedDeploymentId] = useState<string | null>(null);
  const [logSearch, setLogSearch] = useState('');
  const [logLevelFilter, setLogLevelFilter] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR'>('ALL');

  const activeDeployment = deployments.find((d) =>
    ['PENDING', 'VALIDATING', 'BUILDING', 'STARTING', 'HEALTH_CHECKING'].includes(d.status),
  );

  const currentDeployment = useMemo(() => {
    if (selectedDeploymentId) {
      return deployments.find((d) => d.id === selectedDeploymentId) || deployments[0] || null;
    }
    return activeDeployment || deployments[0] || null;
  }, [deployments, selectedDeploymentId, activeDeployment]);

  const rawLogs: DeploymentLogEntry[] = currentDeployment?.logs || [];

  const filteredLogs = useMemo(() => {
    return rawLogs.filter((entry) => {
      const matchesSearch = entry.message.toLowerCase().includes(logSearch.toLowerCase().trim());
      const matchesLevel = logLevelFilter === 'ALL' || entry.level === logLevelFilter;
      return matchesSearch && matchesLevel;
    });
  }, [rawLogs, logSearch, logLevelFilter]);

  const formatCopyLogs = () => {
    if (filteredLogs.length === 0) return 'No logs available.';
    return filteredLogs
      .map((l) => `[${l.timestamp ? new Date(l.timestamp).toLocaleTimeString() : 'N/A'}] [${l.level}] ${l.stage ? `[${l.stage}] ` : ''}${l.message}`)
      .join('\n');
  };

  const appPort = currentDeployment?.exposedPort ?? deploymentPlan?.exposedPort ?? 5000;
  const hostPort = currentDeployment?.hostPort ?? null;

  // Timeline Stages
  const stages = [
    { key: 'BUILDING', label: 'Docker Build', doneStatuses: ['BUILDING', 'STARTING', 'HEALTH_CHECKING', 'RUNNING'] },
    { key: 'IMAGE', label: 'Image Tagged', doneStatuses: ['STARTING', 'HEALTH_CHECKING', 'RUNNING'] },
    { key: 'STARTING', label: 'Container Started', doneStatuses: ['STARTING', 'HEALTH_CHECKING', 'RUNNING'] },
    { key: 'HEALTH_CHECKING', label: 'Health Probe', doneStatuses: ['HEALTH_CHECKING', 'RUNNING'] },
    { key: 'RUNNING', label: 'Healthy & Running', doneStatuses: ['RUNNING'] },
  ];

  return (
    <div className="space-y-6">
      {/* Console Header & Target Environment Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-surface-border">
        <div>
          <h2 className="text-base font-semibold text-foreground tracking-tight">
            Deployment Console
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Isolated container runtime execution, sequential versioning, and live build/runtime stream.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Target Environment Dropdown */}
          {environments.length > 0 && (
            <div className="flex items-center space-x-1.5 text-xs">
              <span className="text-muted-foreground">Target:</span>
              <select
                value={selectedEnvId || ''}
                onChange={(e) => onSelectEnv(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-surface-border bg-surface text-foreground font-medium text-xs focus-ring"
              >
                {environments.map((env) => (
                  <option key={env.id} value={env.id}>
                    {env.name.toUpperCase()} ({env.type})
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeDeployment ? (
            <button
              type="button"
              onClick={() => onCancelDeployment(activeDeployment.id)}
              disabled={isCancellingId === activeDeployment.id}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold transition-colors focus-ring"
            >
              <Square className="w-3.5 h-3.5" />
              <span>{isCancellingId === activeDeployment.id ? 'Cancelling...' : 'Cancel Deployment'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onDeploy}
              disabled={isDeploying}
              className="inline-flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-xs transition-colors focus-ring disabled:opacity-50"
            >
              <Rocket className={`w-3.5 h-3.5 ${isDeploying ? 'animate-bounce' : ''}`} />
              <span>{isDeploying ? 'Triggering...' : 'Deploy Now'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Active / Current Deployment Status Banner */}
      {currentDeployment ? (
        <div className="rounded-xl border border-surface-border bg-card p-5 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-accent text-accent-foreground border border-surface-border">
                <Server className="w-5 h-5 text-sky-500" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-bold text-foreground">
                    Deployment #{currentDeployment.deploymentNumber} ({currentDeployment.configurationVersion || 'v1'})
                  </span>
                  <StatusBadge status={currentDeployment.status} size="sm" pulse={activeDeployment !== undefined} />
                </div>
                <div className="flex items-center space-x-3 text-xs text-muted-foreground mt-1">
                  <span>Strategy: <strong className="text-foreground">{currentDeployment.strategy}</strong></span>
                  <span>•</span>
                  <span className="font-mono flex items-center gap-1">
                    <GitCommit className="w-3 h-3 text-sky-500" />
                    {currentDeployment.commitSha?.substring(0, 7) || 'latest'}
                  </span>
                </div>
              </div>
            </div>

            {/* Distinct Ports & Access URL */}
            <div className="flex flex-wrap items-center gap-3 text-xs sm:text-right">
              <div className="p-2 rounded-lg bg-surface border border-surface-border">
                <span className="text-[10px] text-muted-foreground block uppercase font-mono">App Port</span>
                <span className="font-mono font-bold text-foreground">{appPort}</span>
              </div>

              {hostPort && (
                <div className="p-2 rounded-lg bg-surface border border-surface-border">
                  <span className="text-[10px] text-muted-foreground block uppercase font-mono">Host Port</span>
                  <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{hostPort}</span>
                </div>
              )}

              {currentDeployment.url && currentDeployment.status === 'RUNNING' && (
                <a
                  href={currentDeployment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-semibold hover:bg-emerald-500/20 transition-colors focus-ring"
                >
                  <span>Open App</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>

          {/* Deployment Lifecycle Timeline */}
          <div className="pt-3 border-t border-surface-border">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-3">
              Deployment Stage Progression
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              {stages.map((stage, idx) => {
                const isPassed = stage.doneStatuses.includes(currentDeployment.status);
                const isCurrent = currentDeployment.status === stage.key;
                return (
                  <div
                    key={stage.key}
                    className={`p-2.5 rounded-lg border text-center transition-all ${
                      isPassed
                        ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300'
                        : isCurrent
                        ? 'border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-300 animate-pulse'
                        : 'border-surface-border bg-surface/30 text-muted-foreground'
                    }`}
                  >
                    <div className="flex items-center justify-center space-x-1.5 mb-0.5">
                      {isPassed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <span className="font-mono text-[10px]">{idx + 1}</span>
                      )}
                      <span className="font-semibold text-[11px]">{stage.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-surface-border p-8 text-center text-xs text-muted-foreground">
          No deployments have been executed for this project yet.
        </div>
      )}

      {/* Deployment Logs Console */}
      <div className="rounded-xl border border-surface-border bg-card overflow-hidden shadow-xs">
        {/* Logs Toolbar */}
        <div className="p-3.5 border-b border-surface-border bg-surface/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-sky-500" />
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Deployment Logs ({rawLogs.length})
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder="Search logs..."
                className="pl-8 pr-3 py-1 rounded-lg border border-surface-border bg-surface text-foreground font-mono text-xs placeholder:text-muted-foreground focus-ring w-36 sm:w-48"
              />
            </div>

            {/* Severity Filter */}
            <div className="flex items-center space-x-1 bg-surface border border-surface-border rounded-lg p-0.5">
              {(['ALL', 'INFO', 'WARN', 'ERROR'] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setLogLevelFilter(lvl)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium transition-colors ${
                    logLevelFilter === lvl
                      ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400 font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>

            <CopyButton
              textToCopy={formatCopyLogs}
              label="Copy Logs"
              variant="outline"
              size="sm"
            />
          </div>
        </div>

        {/* Logs Content Area */}
        <div className="p-4 bg-code font-mono text-[11px] leading-relaxed max-h-96 overflow-y-auto divide-y divide-surface-border/20">
          {filteredLogs.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              {rawLogs.length === 0 ? 'No deployment logs generated yet.' : 'No logs matching query.'}
            </div>
          ) : (
            filteredLogs.map((entry, i) => (
              <div key={i} className="py-1 flex items-start space-x-2.5">
                <span className="text-muted-foreground select-none w-6 text-right flex-shrink-0">
                  {i + 1}
                </span>
                <span className="text-muted-foreground flex-shrink-0">
                  {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '--:--:--'}
                </span>
                <span
                  className={`font-semibold uppercase flex-shrink-0 text-[10px] px-1 rounded ${
                    entry.level === 'ERROR'
                      ? 'bg-rose-500/20 text-rose-400'
                      : entry.level === 'WARN'
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-sky-500/20 text-sky-400'
                  }`}
                >
                  {entry.level}
                </span>
                {entry.stage && (
                  <span className="text-muted-foreground font-sans text-[10px] uppercase">
                    [{entry.stage}]
                  </span>
                )}
                <span className="text-foreground break-all whitespace-pre-wrap flex-1">
                  {entry.message}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Deployment History Table */}
      {deployments.length > 1 && (
        <div className="rounded-xl border border-surface-border bg-card p-5 space-y-3">
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Deployment History ({deployments.length})
          </h3>

          <div className="rounded-lg border border-surface-border bg-surface/30 divide-y divide-surface-border overflow-hidden text-xs">
            {deployments.map((dep) => (
              <div
                key={dep.id}
                onClick={() => setSelectedDeploymentId(dep.id)}
                className={`px-4 py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-surface/70 transition-colors ${
                  currentDeployment?.id === dep.id ? 'bg-accent/40 border-l-2 border-l-sky-500' : ''
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className="font-bold text-foreground font-mono">
                    #{dep.deploymentNumber}
                  </span>
                  <StatusBadge status={dep.status} size="sm" />
                  <span className="font-mono text-muted-foreground text-[11px]">
                    {dep.commitSha?.substring(0, 7) || 'latest'}
                  </span>
                </div>

                <div className="flex items-center space-x-3 text-muted-foreground text-[11px]">
                  <span>{new Date(dep.createdAt).toLocaleString()}</span>
                  {onOpenRollbackModal && dep.status === 'RUNNING' && currentDeployment?.id !== dep.id && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenRollbackModal(dep);
                      }}
                      className="text-amber-600 dark:text-amber-400 hover:underline font-semibold"
                    >
                      Rollback to this
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
