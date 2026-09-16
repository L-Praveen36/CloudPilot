'use client';

import React, { useState } from 'react';
import { DeploymentReadinessDto, DeploymentPlan } from '@cloudpilot/shared';
import { ReadinessModal } from '../modals/readiness-modal';
import { StatusBadge } from '@/components/ui/status-badge';
import { CopyButton } from '@/components/ui/copy-button';
import {
  ShieldCheck,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Layers,
  HelpCircle,
} from 'lucide-react';

interface ReadinessTabProps {
  readiness: DeploymentReadinessDto | null;
  deploymentPlan: DeploymentPlan | null;
  onReanalyzeReadiness?: () => void;
  isAnalyzing?: boolean;
}

export const ReadinessTab: React.FC<ReadinessTabProps> = ({
  readiness,
  deploymentPlan,
  onReanalyzeReadiness,
  isAnalyzing = false,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [expandedWarningIdx, setExpandedWarningIdx] = useState<number | null>(null);

  if (!readiness) {
    return (
      <div className="p-12 text-center text-xs text-muted-foreground border border-dashed border-surface-border rounded-xl">
        Deployment readiness analysis is pending. Trigger analysis above.
      </div>
    );
  }

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
    <div className="space-y-6">
      {/* Tab Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-surface-border">
        <div>
          <h2 className="text-base font-semibold text-foreground tracking-tight">
            Deployment Readiness Assessment
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Phase 3.4 · Feasibility analysis, pre-deployment blocker detection, and strategy evaluation.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="px-3 py-1.5 rounded-lg border border-surface-border bg-surface hover:bg-surface-hover text-foreground text-xs font-medium transition-colors inline-flex items-center gap-1.5 focus-ring"
          >
            <span>Full Report</span>
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <CopyButton
            textToCopy={formatCopyReport}
            label="Copy Report"
            variant="outline"
          />
        </div>
      </div>

      {/* Hero Score Banner */}
      <div className="rounded-xl border border-surface-border bg-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center space-x-5">
          <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl font-bold font-mono text-sky-600 dark:text-sky-400">
              {readiness.score}
            </span>
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <span className="text-base font-bold text-foreground">
                Readiness Score {readiness.score}/100
              </span>
              <StatusBadge status={readiness.status} size="sm" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Recommended Strategy: <strong className="text-foreground font-semibold">{readiness.strategy}</strong>
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground max-w-md md:text-right leading-relaxed">
          {readiness.summary}
        </p>
      </div>

      {/* Category Breakdown Matrix */}
      {breakdown && (
        <div className="rounded-xl border border-surface-border bg-card p-5 space-y-3">
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Feasibility Score by Category
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-surface border border-surface-border">
              <span className="text-[11px] text-muted-foreground block">App Identity</span>
              <span className="font-bold font-mono text-foreground text-sm mt-0.5 block">{breakdown.applicationIdentity} / 15</span>
            </div>
            <div className="p-3 rounded-lg bg-surface border border-surface-border">
              <span className="text-[11px] text-muted-foreground block">Build Readiness</span>
              <span className="font-bold font-mono text-foreground text-sm mt-0.5 block">{breakdown.buildReadiness} / 20</span>
            </div>
            <div className="p-3 rounded-lg bg-surface border border-surface-border">
              <span className="text-[11px] text-muted-foreground block">Runtime Readiness</span>
              <span className="font-bold font-mono text-foreground text-sm mt-0.5 block">{breakdown.runtimeReadiness} / 20</span>
            </div>
            <div className="p-3 rounded-lg bg-surface border border-surface-border">
              <span className="text-[11px] text-muted-foreground block">Port Resolution</span>
              <span className="font-bold font-mono text-foreground text-sm mt-0.5 block">{breakdown.portReadiness} / 15</span>
            </div>
            <div className="p-3 rounded-lg bg-surface border border-surface-border">
              <span className="text-[11px] text-muted-foreground block">Env Configuration</span>
              <span className="font-bold font-mono text-foreground text-sm mt-0.5 block">{breakdown.environmentConfiguration} / 10</span>
            </div>
            <div className="p-3 rounded-lg bg-surface border border-surface-border">
              <span className="text-[11px] text-muted-foreground block">Strategy Support</span>
              <span className="font-bold font-mono text-foreground text-sm mt-0.5 block">{breakdown.deploymentStrategy} / 10</span>
            </div>
          </div>
        </div>
      )}

      {/* Warnings & Recommendations Section */}
      <div className="space-y-4">
        {readiness.warnings.length > 0 && (
          <div className="rounded-xl border border-surface-border bg-card p-5 space-y-3">
            <h3 className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              <span>Non-Blocking Warnings ({readiness.warnings.length})</span>
            </h3>

            <div className="space-y-2">
              {readiness.warnings.map((w, i) => {
                const isExpanded = expandedWarningIdx === i;
                return (
                  <div
                    key={i}
                    className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3.5 space-y-2 text-xs transition-all"
                  >
                    <div
                      onClick={() => setExpandedWarningIdx(isExpanded ? null : i)}
                      className="flex items-start justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-start space-x-2">
                        <span className="font-mono font-semibold text-amber-700 dark:text-amber-300">
                          [{w.code}]
                        </span>
                        <span className="text-foreground font-medium">
                          {w.message}
                        </span>
                      </div>
                      <button type="button" className="text-muted-foreground hover:text-foreground">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="pt-2 border-t border-amber-500/20 space-y-1.5 text-muted-foreground leading-relaxed">
                        <p>
                          <strong className="text-foreground">Why this matters:</strong> Documenting conventions ensures reproducible container deployment without relying on default framework port assumptions.
                        </p>
                        {w.evidence && w.evidence.length > 0 && (
                          <div className="flex items-center space-x-2 pt-1 font-mono text-[11px]">
                            <span>Evidence:</span>
                            <span className="text-foreground">{w.evidence.join(', ')}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Environment Variable Requirements Table */}
        {readiness.requirements && readiness.requirements.length > 0 && (
          <div className="rounded-xl border border-surface-border bg-card p-5 space-y-3">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Detected Environment Variable Requirements ({readiness.requirements.length})
            </h3>

            <div className="rounded-lg border border-surface-border bg-surface/30 divide-y divide-surface-border overflow-hidden text-xs">
              {readiness.requirements.map((req) => (
                <div key={req.name} className="px-3.5 py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center space-x-2.5">
                    <span className="font-mono font-semibold text-foreground">
                      {req.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Source: {req.source}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    {req.required ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                        Required
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-surface text-muted-foreground border border-surface-border">
                        Optional / Defaulted
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Readiness Report Modal */}
      <ReadinessModal
        readiness={readiness}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </div>
  );
};
