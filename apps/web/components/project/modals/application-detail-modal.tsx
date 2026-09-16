'use client';

import React from 'react';
import {
  DetectedApplication,
} from '@cloudpilot/shared';
import { DetailModal } from '@/components/ui/detail-modal';
import { CopyButton } from '@/components/ui/copy-button';
import { Boxes, Terminal, GitBranch, Cpu, Code2, Play } from 'lucide-react';

interface ApplicationDetailModalProps {
  app: DetectedApplication | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ApplicationDetailModal: React.FC<ApplicationDetailModalProps> = ({
  app,
  isOpen,
  onClose,
}) => {
  if (!app) return null;

  const formatSummary = () => {
    return [
      `Application: ${app.name}`,
      `Role: ${app.role}`,
      `Framework: ${app.framework || 'None / Standard'}`,
      `Language: ${app.language || 'JavaScript'}`,
      `Package Manager: ${app.packageManager || 'npm'}`,
      `Path: ${app.path}`,
      `Port: ${app.port?.port || 'None'}`,
      `Entry Point: ${app.entryPoint?.path || 'Auto-detected'}`,
      `Build Command: ${app.buildCommand?.command || 'None'}`,
      `Start Command: ${app.startCommand?.command || 'None'}`,
      `Output Directory: ${app.outputDirectory?.path || 'None'}`,
    ].join('\n');
  };

  return (
    <DetailModal
      isOpen={isOpen}
      onClose={onClose}
      title={app.name.toUpperCase()}
      subtitle={`Application Structure & Runtime Metadata • ${app.role}`}
      icon={<Boxes className="w-5 h-5 text-sky-500" />}
      maxWidth="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <CopyButton
            textToCopy={formatSummary}
            label="Copy Application Details"
            variant="outline"
          />
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-surface hover:bg-surface-hover border border-surface-border text-foreground transition-colors focus-ring"
          >
            Close
          </button>
        </div>
      }
    >
      <div className="space-y-5 text-xs">
        {/* Key Attributes Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="p-3 rounded-xl border border-surface-border bg-surface/50">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
              Application Role
            </span>
            <span className="text-sm font-semibold text-foreground mt-0.5 block">
              {app.role}
            </span>
            <span className="text-[11px] text-muted-foreground mt-1 block">
              Confidence: {app.confidence}
            </span>
          </div>

          <div className="p-3 rounded-xl border border-surface-border bg-surface/50">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
              Framework & Stack
            </span>
            <span className="text-sm font-semibold text-foreground mt-0.5 block">
              {app.framework || 'None / Standard'}
            </span>
            <span className="text-[11px] text-muted-foreground mt-1 block">
              {app.language || 'JavaScript'} • {app.packageManager || 'npm'}
            </span>
          </div>

          <div className="p-3 rounded-xl border border-surface-border bg-surface/50">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
              Root Path
            </span>
            <span className="text-sm font-mono font-semibold text-foreground mt-0.5 block">
              {app.path}
            </span>
          </div>

          <div className="p-3 rounded-xl border border-surface-border bg-surface/50">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
              Application Port
            </span>
            <span className="text-sm font-mono font-semibold text-foreground mt-0.5 block">
              {app.port?.port ? `${app.port.port}` : 'None detected'}
            </span>
            {app.port?.source && (
              <span className="text-[11px] text-muted-foreground mt-1 block">
                Source: {app.port.source}
              </span>
            )}
          </div>
        </div>

        {/* Commands & Entry Point Details */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Execution & Commands
          </h4>

          <div className="space-y-2">
            <div className="p-3 rounded-xl border border-surface-border bg-surface/30 flex items-start justify-between gap-3">
              <div>
                <span className="text-[11px] text-muted-foreground block">Entry Point</span>
                <span className="font-mono text-xs text-foreground mt-0.5 block">
                  {app.entryPoint?.path || 'Auto-detected'}
                </span>
              </div>
              {app.entryPoint?.evidence && (
                <span className="text-[10px] text-muted-foreground bg-surface border border-surface-border px-2 py-0.5 rounded-md">
                  {app.entryPoint.evidence}
                </span>
              )}
            </div>

            <div className="p-3 rounded-xl border border-surface-border bg-surface/30 flex items-start justify-between gap-3">
              <div>
                <span className="text-[11px] text-muted-foreground block">Build Command</span>
                <span className="font-mono text-xs text-foreground mt-0.5 block">
                  {app.buildCommand?.command || 'None (Direct execution)'}
                </span>
              </div>
              {app.buildCommand?.source && (
                <span className="text-[10px] text-muted-foreground bg-surface border border-surface-border px-2 py-0.5 rounded-md">
                  {app.buildCommand.source}
                </span>
              )}
            </div>

            <div className="p-3 rounded-xl border border-surface-border bg-surface/30 flex items-start justify-between gap-3">
              <div>
                <span className="text-[11px] text-muted-foreground block">Start Command</span>
                <span className="font-mono text-xs text-foreground mt-0.5 block">
                  {app.startCommand?.command || 'None'}
                </span>
              </div>
              {app.startCommand?.source && (
                <span className="text-[10px] text-muted-foreground bg-surface border border-surface-border px-2 py-0.5 rounded-md">
                  {app.startCommand.source}
                </span>
              )}
            </div>

            {app.outputDirectory?.path && (
              <div className="p-3 rounded-xl border border-surface-border bg-surface/30 flex items-start justify-between gap-3">
                <div>
                  <span className="text-[11px] text-muted-foreground block">Build Output Directory</span>
                  <span className="font-mono text-xs text-foreground mt-0.5 block">
                    {app.outputDirectory.path}
                  </span>
                </div>
                {app.outputDirectory.source && (
                  <span className="text-[10px] text-muted-foreground bg-surface border border-surface-border px-2 py-0.5 rounded-md">
                    {app.outputDirectory.source}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Evidence Tags */}
        {app.evidence && app.evidence.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
              Detected Evidence
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {app.evidence.map((ev: string, i: number) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded-md text-[11px] bg-surface border border-surface-border text-muted-foreground font-mono"
                >
                  {ev}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </DetailModal>
  );
};
