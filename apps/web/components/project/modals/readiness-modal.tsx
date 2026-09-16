'use client';

import React from 'react';
import { DeploymentReadinessDto, DeploymentStrategy } from '@cloudpilot/shared';
import { DetailModal } from '@/components/ui/detail-modal';
import { CopyButton } from '@/components/ui/copy-button';
import { StatusBadge } from '@/components/ui/status-badge';
import { ShieldCheck, AlertTriangle, XCircle, CheckCircle2, ListChecks } from 'lucide-react';

interface ReadinessModalProps {
  readiness: DeploymentReadinessDto | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ReadinessModal: React.FC<ReadinessModalProps> = ({
  readiness,
  isOpen,
  onClose,
}) => {
  if (!readiness) return null;

  const formatCopyReport = () => {
    return [
      'CloudPilot Deployment Readiness Assessment',
      '==========================================',
      `Readiness Score: ${readiness.score}/100`,
      `Status: ${readiness.status}`,
      `Strategy: ${readiness.strategy}`,
      `Summary: ${readiness.summary}`,
      '',
      `Blockers (${readiness.blockers.length}):`,
      readiness.blockers.length === 0
        ? '- None'
        : readiness.blockers.map((b) => `- [${b.code}] ${b.message}`).join('\n'),
      '',
      `Warnings (${readiness.warnings.length}):`,
      readiness.warnings.length === 0
        ? '- None'
        : readiness.warnings.map((w) => `- [${w.code}] ${w.message}`).join('\n'),
      '',
      `Recommendations (${readiness.recommendations.length}):`,
      readiness.recommendations.length === 0
        ? '- None'
        : readiness.recommendations.map((r) => `- [${r.priority}] ${r.message}`).join('\n'),
      '',
      `Environment Requirements (${readiness.requirements?.length || 0}):`,
      (readiness.requirements || []).length === 0
        ? '- None'
        : (readiness.requirements || []).map((req) => `- ${req.name} (${req.required ? 'Required' : 'Optional'}) - Source: ${req.source}`).join('\n'),
    ].join('\n');
  };

  const breakdown = readiness.scoreBreakdown;

  return (
    <DetailModal
      isOpen={isOpen}
      onClose={onClose}
      title="Deployment Readiness Assessment"
      subtitle="Engineering readiness assessment & feasibility score breakdown"
      icon={<ShieldCheck className="w-5 h-5 text-sky-500" />}
      maxWidth="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <CopyButton
            textToCopy={formatCopyReport}
            label="Copy Readiness Report"
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
        {/* Score & Strategy Hero */}
        <div className="p-4 rounded-xl border border-surface-border bg-surface/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-bold font-mono text-sky-600 dark:text-sky-400">
                {readiness.score}
              </span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-foreground">
                  Score: {readiness.score}/100
                </span>
                <StatusBadge status={readiness.status} size="sm" />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Strategy: <strong className="text-foreground font-semibold">{readiness.strategy}</strong>
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground max-w-sm sm:text-right leading-relaxed">
            {readiness.summary}
          </p>
        </div>

        {/* Category Scores Breakdown */}
        {breakdown && (
          <div>
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2.5">
              Score Breakdown by Category
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div className="p-2.5 rounded-lg border border-surface-border bg-surface/30">
                <span className="text-[11px] text-muted-foreground block">App Identity</span>
                <span className="text-xs font-bold font-mono text-foreground">{breakdown.applicationIdentity} / 15</span>
              </div>
              <div className="p-2.5 rounded-lg border border-surface-border bg-surface/30">
                <span className="text-[11px] text-muted-foreground block">Build Readiness</span>
                <span className="text-xs font-bold font-mono text-foreground">{breakdown.buildReadiness} / 20</span>
              </div>
              <div className="p-2.5 rounded-lg border border-surface-border bg-surface/30">
                <span className="text-[11px] text-muted-foreground block">Runtime Readiness</span>
                <span className="text-xs font-bold font-mono text-foreground">{breakdown.runtimeReadiness} / 20</span>
              </div>
              <div className="p-2.5 rounded-lg border border-surface-border bg-surface/30">
                <span className="text-[11px] text-muted-foreground block">Port Resolution</span>
                <span className="text-xs font-bold font-mono text-foreground">{breakdown.portReadiness} / 15</span>
              </div>
              <div className="p-2.5 rounded-lg border border-surface-border bg-surface/30">
                <span className="text-[11px] text-muted-foreground block">Env Configuration</span>
                <span className="text-xs font-bold font-mono text-foreground">{breakdown.environmentConfiguration} / 10</span>
              </div>
              <div className="p-2.5 rounded-lg border border-surface-border bg-surface/30">
                <span className="text-[11px] text-muted-foreground block">Strategy Support</span>
                <span className="text-xs font-bold font-mono text-foreground">{breakdown.deploymentStrategy} / 10</span>
              </div>
            </div>
          </div>
        )}

        {/* Blockers & Warnings */}
        <div className="space-y-3">
          {readiness.blockers.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-rose-500 uppercase tracking-wider flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5" />
                <span>Deployment Blockers ({readiness.blockers.length})</span>
              </h4>
              <div className="space-y-1.5">
                {readiness.blockers.map((b, i) => (
                  <div key={i} className="p-3 rounded-lg border border-rose-500/20 bg-rose-500/5 text-xs text-rose-700 dark:text-rose-300">
                    <span className="font-mono font-semibold">[{b.code}]</span> {b.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {readiness.warnings.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Non-Blocking Warnings ({readiness.warnings.length})</span>
              </h4>
              <div className="space-y-1.5">
                {readiness.warnings.map((w, i) => (
                  <div key={i} className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-xs text-amber-700 dark:text-amber-300">
                    <span className="font-mono font-semibold">[{w.code}]</span> {w.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {readiness.recommendations.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-500" />
                <span>Engineering Recommendations</span>
              </h4>
              <div className="space-y-1.5">
                {readiness.recommendations.map((r, i) => (
                  <div key={i} className="p-3 rounded-lg border border-surface-border bg-surface/30 text-xs flex items-start justify-between gap-2">
                    <span className="text-foreground">{r.message}</span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-surface border border-surface-border text-muted-foreground flex-shrink-0">
                      {r.priority}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </DetailModal>
  );
};
