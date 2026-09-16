'use client';

import React, { useState } from 'react';
import {
  DeploymentTelemetrySummary,
  DeploymentDto,
} from '@cloudpilot/shared';
import { TelemetryDrawer } from '../modals/telemetry-drawer';
import { CopyButton } from '@/components/ui/copy-button';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Activity,
  Cpu,
  HardDrive,
  Network,
  Layers,
  Clock,
  Gauge,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

interface ObservabilityTabProps {
  telemetry: DeploymentTelemetrySummary | null;
  latestDeployment: DeploymentDto | null;
  onCollectMetrics?: () => Promise<void>;
  isCollecting?: boolean;
}

export const ObservabilityTab: React.FC<ObservabilityTabProps> = ({
  telemetry,
  latestDeployment,
  onCollectMetrics,
  isCollecting = false,
}) => {
  const [showDrawer, setShowDrawer] = useState(false);

  const m = telemetry?.liveSnapshot;

  const formatBytes = (bytes?: number) => {
    if (bytes === undefined || bytes === null) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatUptime = (seconds?: number) => {
    if (!seconds) return 'Just started';
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `${hrs}h ${mins % 60}m`;
    if (mins > 0) return `${mins}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const formatCopyObservability = () => {
    if (!telemetry) return 'No telemetry data available.';
    return [
      `CloudPilot Observability Summary (${latestDeployment?.id || 'Latest'})`,
      '====================================================',
      `Health Status: ${telemetry.healthStatus || 'HEALTHY'}`,
      `Uptime: ${formatUptime(telemetry.uptimeSeconds)}`,
      `CPU Usage: ${m?.cpuPercent !== undefined ? `${m.cpuPercent.toFixed(2)}%` : `${telemetry.avgCpuPercent?.toFixed(2) || '0.00'}%`}`,
      `Memory: ${formatBytes(m?.memoryUsageBytes)} / ${formatBytes(m?.memoryLimitBytes)} (${m?.memoryPercent !== undefined ? `${m.memoryPercent.toFixed(1)}%` : '0.0%'})`,
      `Total Network Input: ${formatBytes(telemetry.totalNetworkInputBytes)}`,
      `Total Network Output: ${formatBytes(telemetry.totalNetworkOutputBytes)}`,
      `Active PIDs: ${m?.pids || 1}`,
      `Active Alerts: ${telemetry.activeAlertsCount || 0}`,
    ].join('\n');
  };

  return (
    <div className="space-y-6">
      {/* Tab Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-surface-border">
        <div>
          <h2 className="text-base font-semibold text-foreground tracking-tight">
            Observability & Telemetry
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Phase 5 · Real-time container resource telemetry, health probes, and audit metrics.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {onCollectMetrics && (
            <button
              type="button"
              onClick={onCollectMetrics}
              disabled={isCollecting}
              className="px-3 py-1.5 rounded-lg border border-surface-border bg-surface hover:bg-surface-hover text-foreground text-xs font-semibold transition-colors inline-flex items-center gap-1.5 focus-ring disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCollecting ? 'animate-spin' : ''}`} />
              <span>{isCollecting ? 'Sampling...' : 'Sample Metrics'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowDrawer(true)}
            className="px-3 py-1.5 rounded-lg border border-surface-border bg-surface hover:bg-surface-hover text-foreground text-xs font-medium transition-colors inline-flex items-center gap-1.5 focus-ring"
          >
            <span>Telemetry Details</span>
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
          </button>

          <CopyButton
            textToCopy={formatCopyObservability}
            label="Copy Metrics"
            variant="outline"
          />
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Health Probe */}
        <div className="rounded-xl border border-surface-border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-medium uppercase tracking-wider">Health Status</span>
            <Gauge className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-center space-x-2">
            <StatusBadge status={telemetry?.healthStatus || 'HEALTHY'} size="sm" />
          </div>
          <span className="text-[11px] text-muted-foreground block font-mono">
            Container Status: {m?.containerStatus || 'RUNNING'}
          </span>
        </div>

        {/* 2. CPU Usage */}
        <div className="rounded-xl border border-surface-border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-medium uppercase tracking-wider">CPU Utilization</span>
            <Cpu className="w-4 h-4 text-sky-500" />
          </div>
          <span className="text-xl font-bold font-mono text-foreground block">
            {m?.cpuPercent !== undefined ? `${m.cpuPercent.toFixed(2)}%` : `${telemetry?.avgCpuPercent?.toFixed(2) || '0.00'}%`}
          </span>
          <span className="text-[11px] text-muted-foreground block">
            Multi-core workload
          </span>
        </div>

        {/* 3. Memory Usage */}
        <div className="rounded-xl border border-surface-border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-medium uppercase tracking-wider">Memory Allocation</span>
            <HardDrive className="w-4 h-4 text-indigo-500" />
          </div>
          <span className="text-xl font-bold font-mono text-foreground block">
            {formatBytes(m?.memoryUsageBytes)}
          </span>
          <span className="text-[11px] text-muted-foreground block font-mono truncate">
            Limit: {formatBytes(m?.memoryLimitBytes || 536870912)} ({m?.memoryPercent !== undefined ? `${m.memoryPercent.toFixed(1)}%` : '0.0%'})
          </span>
        </div>

        {/* 4. Network & Uptime */}
        <div className="rounded-xl border border-surface-border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-medium uppercase tracking-wider">Container Uptime</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <span className="text-sm font-bold font-mono text-foreground block truncate">
            {formatUptime(telemetry?.uptimeSeconds)}
          </span>
          <span className="text-[11px] text-muted-foreground block font-mono">
            PIDs: {m?.pids || 1} processes
          </span>
        </div>
      </div>

      {/* Telemetry Drawer */}
      <TelemetryDrawer
        isOpen={showDrawer}
        onClose={() => setShowDrawer(false)}
        telemetry={telemetry}
        onRefresh={onCollectMetrics}
        isRefreshing={isCollecting}
      />
    </div>
  );
};
