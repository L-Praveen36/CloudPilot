'use client';

import React from 'react';
import { DetailDrawer } from '@/components/ui/detail-drawer';
import { CopyButton } from '@/components/ui/copy-button';
import { DeploymentTelemetrySummary, ContainerMetricsSnapshot } from '@cloudpilot/shared';
import { Activity, Cpu, HardDrive, Network, Clock, Gauge, Layers } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';

interface TelemetryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  telemetry: DeploymentTelemetrySummary | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const TelemetryDrawer: React.FC<TelemetryDrawerProps> = ({
  isOpen,
  onClose,
  telemetry,
  onRefresh,
  isRefreshing = false,
}) => {
  if (!telemetry) return null;

  const m: ContainerMetricsSnapshot | null = telemetry.liveSnapshot;

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

  const formatCopyTelemetry = () => {
    return [
      `CloudPilot Deployment Telemetry (${telemetry.deploymentId})`,
      '==============================================',
      `Health Status: ${telemetry.healthStatus}`,
      `Uptime: ${formatUptime(telemetry.uptimeSeconds)}`,
      `CPU Usage: ${m?.cpuPercent !== undefined ? `${m.cpuPercent.toFixed(2)}%` : `${telemetry.avgCpuPercent.toFixed(2)}%`}`,
      `Memory Usage: ${formatBytes(m?.memoryUsageBytes)} / ${formatBytes(m?.memoryLimitBytes)} (${m?.memoryPercent !== undefined ? `${m.memoryPercent.toFixed(1)}%` : '0.0%'})`,
      `Total Network Input: ${formatBytes(telemetry.totalNetworkInputBytes)}`,
      `Total Network Output: ${formatBytes(telemetry.totalNetworkOutputBytes)}`,
      `Active PIDs: ${m?.pids || 1}`,
      `Active Alerts: ${telemetry.activeAlertsCount || 0}`,
    ].join('\n');
  };

  return (
    <DetailDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Container Telemetry & Health"
      subtitle={`Live runtime resource telemetry • Deployment: ${telemetry.deploymentId.substring(0, 8)}`}
      icon={<Activity className="w-5 h-5 text-sky-500" />}
      width="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <CopyButton
            textToCopy={formatCopyTelemetry}
            label="Copy Telemetry"
            variant="outline"
          />
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="px-3.5 py-1.5 rounded-lg border border-surface-border bg-surface hover:bg-surface-hover text-foreground text-xs font-semibold transition-colors focus-ring disabled:opacity-50"
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh Metrics'}
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        {/* Status Card */}
        <div className="p-4 rounded-xl border border-surface-border bg-surface/50 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-lg bg-accent text-accent-foreground border border-surface-border">
              <Gauge className="w-5 h-5 text-sky-500" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                Health Status
              </span>
              <div className="flex items-center space-x-2 mt-0.5">
                <StatusBadge status={telemetry.healthStatus} size="sm" />
                <span className="text-xs text-muted-foreground font-mono">
                  {telemetry.status}
                </span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[11px] text-muted-foreground block">Uptime</span>
            <span className="font-mono text-xs font-semibold text-foreground">
              {formatUptime(telemetry.uptimeSeconds)}
            </span>
          </div>
        </div>

        {/* Resource Gauges */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl border border-surface-border bg-surface/30">
            <div className="flex items-center space-x-2 text-muted-foreground mb-1">
              <Cpu className="w-4 h-4 text-sky-500" />
              <span className="text-[11px] font-medium uppercase tracking-wider">CPU Usage</span>
            </div>
            <span className="text-xl font-bold font-mono text-foreground">
              {m?.cpuPercent !== undefined ? `${m.cpuPercent.toFixed(2)}%` : `${telemetry.avgCpuPercent.toFixed(2)}%`}
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-surface-border bg-surface/30">
            <div className="flex items-center space-x-2 text-muted-foreground mb-1">
              <HardDrive className="w-4 h-4 text-indigo-500" />
              <span className="text-[11px] font-medium uppercase tracking-wider">Memory</span>
            </div>
            <span className="text-xl font-bold font-mono text-foreground">
              {formatBytes(m?.memoryUsageBytes)}
            </span>
            <span className="text-[11px] text-muted-foreground block mt-0.5 font-mono">
              Limit: {formatBytes(m?.memoryLimitBytes || 536870912)} ({m?.memoryPercent?.toFixed(1) || '0.0'}%)
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-surface-border bg-surface/30">
            <div className="flex items-center space-x-2 text-muted-foreground mb-1">
              <Network className="w-4 h-4 text-emerald-500" />
              <span className="text-[11px] font-medium uppercase tracking-wider">Total Network I/O</span>
            </div>
            <span className="text-xs font-mono text-foreground block">
              ↓ {formatBytes(telemetry.totalNetworkInputBytes)}
            </span>
            <span className="text-xs font-mono text-foreground block">
              ↑ {formatBytes(telemetry.totalNetworkOutputBytes)}
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-surface-border bg-surface/30">
            <div className="flex items-center space-x-2 text-muted-foreground mb-1">
              <Layers className="w-4 h-4 text-amber-500" />
              <span className="text-[11px] font-medium uppercase tracking-wider">Process & PIDs</span>
            </div>
            <span className="text-xl font-bold font-mono text-foreground">
              {m?.pids || 1}
            </span>
            <span className="text-[11px] text-muted-foreground block mt-0.5">
              Active process threads
            </span>
          </div>
        </div>

        {/* Live Event Stream Preview */}
        {telemetry.recentEvents && telemetry.recentEvents.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
              Recent Runtime Events
            </h4>
            <div className="rounded-xl border border-surface-border bg-surface/30 divide-y divide-surface-border max-h-48 overflow-y-auto">
              {telemetry.recentEvents.map((evt, i) => (
                <div key={evt.id || i} className="p-2.5 flex items-center justify-between text-[11px]">
                  <span className="text-foreground font-medium">{evt.message}</span>
                  <span className="text-muted-foreground font-mono text-[10px]">
                    {new Date(evt.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DetailDrawer>
  );
};
