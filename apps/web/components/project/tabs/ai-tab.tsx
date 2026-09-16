'use client';

import React, { useState } from 'react';
import {
  AiRepositoryUnderstanding,
  AiDeploymentProposal,
  AiFailureDiagnosis,
  AiRepairSuggestion,
  AiAgentResponse,
} from '@cloudpilot/shared';
import { CopyButton } from '@/components/ui/copy-button';
import {
  Sparkles,
  Check,
  X,
  Send,
  Loader2,
  Code2,
  AlertTriangle,
  Lightbulb,
  ShieldAlert,
  Bot,
} from 'lucide-react';

interface AiTabProps {
  understanding: AiRepositoryUnderstanding | null;
  proposal: AiDeploymentProposal | null;
  diagnosis: AiFailureDiagnosis | null;
  repairSuggestions: AiRepairSuggestion[];
  agentResponse: AiAgentResponse | null;
  onApproveRepair: (id: string) => Promise<void>;
  onRejectRepair: (id: string) => Promise<void>;
  onRunAgent: (prompt: string) => Promise<void>;
  isAgentRunning: boolean;
  isApprovingId: string | null;
  isRejectingId: string | null;
}

export const AiTab: React.FC<AiTabProps> = ({
  understanding,
  proposal,
  diagnosis,
  repairSuggestions = [],
  agentResponse,
  onApproveRepair,
  onRejectRepair,
  onRunAgent,
  isAgentRunning = false,
  isApprovingId,
  isRejectingId,
}) => {
  const [prompt, setPrompt] = useState('');

  const handleAgentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isAgentRunning) return;
    await onRunAgent(prompt.trim());
    setPrompt('');
  };

  const formatCopyAiReport = () => {
    return [
      'CloudPilot AI Deployment Intelligence',
      '=====================================',
      understanding ? `Architecture Understanding:\n${understanding.summary}\nFramework: ${understanding.technology.framework}\nLanguage: ${understanding.technology.primaryLanguage}\n` : '',
      proposal ? `Deployment Proposal:\nStrategy: ${proposal.strategy}\nPort: ${proposal.exposedPort}\nHealth Check: ${proposal.healthCheckPath}\n` : '',
      diagnosis ? `Failure Diagnosis:\nProblem: ${diagnosis.problem}\nLikely Cause: ${diagnosis.likelyCause}\nRecommendation: ${diagnosis.recommendation}\n` : '',
      repairSuggestions.length > 0
        ? `Suggested Repairs (${repairSuggestions.length}):\n${repairSuggestions.map((r) => `- [${r.status}] ${r.title}: ${r.reasoning}`).join('\n')}`
        : '',
    ].join('\n');
  };

  return (
    <div className="space-y-6">
      {/* Tab Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-surface-border">
        <div>
          <h2 className="text-base font-semibold text-foreground tracking-tight">
            AI Engineering Intelligence
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Phase 6 · Autonomous architecture reasoning, deployment proposal generation, and failure diagnostics.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <CopyButton
            textToCopy={formatCopyAiReport}
            label="Copy AI Insights"
            variant="outline"
          />
        </div>
      </div>

      {/* 1. Architecture Understanding & Proposal Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Architecture Understanding */}
        <div className="rounded-xl border border-surface-border bg-card p-5 space-y-3">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Architecture Understanding
              </h3>
              {understanding?.confidence && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  Confidence: {understanding.confidence}
                </span>
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            {understanding?.summary || 'CloudPilot AI analyzed repository structure and inferred an optimal container architecture.'}
          </p>

          {understanding?.evidenceSummary && understanding.evidenceSummary.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Evidence Summary:
              </span>
              {understanding.evidenceSummary.map((item, idx) => (
                <div key={idx} className="flex items-start space-x-2 text-[11px] text-muted-foreground">
                  <span className="text-purple-500">•</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Deployment Proposal */}
        <div className="rounded-xl border border-surface-border bg-card p-5 space-y-3">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
              <Lightbulb className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Deployment Strategy Proposal
              </h3>
              {proposal?.strategy && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  Strategy: {proposal.strategy}
                </span>
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            {proposal?.dockerfileExplanation || 'Multi-stage container strategy generated for high runtime isolation and minimal artifact footprint.'}
          </p>

          {proposal && (
            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              <div className="p-2 rounded-lg bg-surface/60 border border-surface-border">
                <span className="text-[10px] text-muted-foreground uppercase block">Exposed Port</span>
                <span className="font-mono text-foreground text-[11px] font-semibold">{proposal.exposedPort}</span>
              </div>
              <div className="p-2 rounded-lg bg-surface/60 border border-surface-border">
                <span className="text-[10px] text-muted-foreground uppercase block">Health Probe</span>
                <span className="font-mono text-foreground text-[11px] font-semibold">{proposal.healthCheckPath} ({proposal.healthCheckStrategy})</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Failure Diagnosis (if present) */}
      {diagnosis && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-5 space-y-3">
          <div className="flex items-center space-x-2 text-rose-600 dark:text-rose-400">
            <ShieldAlert className="w-4 h-4" />
            <h3 className="text-xs font-semibold uppercase tracking-wider">
              AI Failure Diagnosis & Incident Triage ({diagnosis.category})
            </h3>
          </div>

          <div className="space-y-2 text-xs">
            <p className="text-foreground font-medium">{diagnosis.problem}</p>
            <div className="p-3 rounded-lg bg-surface border border-rose-500/20 space-y-1">
              <span className="text-[11px] text-muted-foreground block uppercase font-mono">Likely Cause</span>
              <span className="font-mono text-rose-700 dark:text-rose-300 font-semibold block">{diagnosis.likelyCause}</span>
              <span className="text-[11px] text-muted-foreground block uppercase font-mono pt-1">Recommendation</span>
              <span className="text-foreground block">{diagnosis.recommendation}</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Suggested Code Repairs */}
      {repairSuggestions.length > 0 && (
        <div className="rounded-xl border border-surface-border bg-card p-5 space-y-3">
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Automated Code & Config Repair Suggestions ({repairSuggestions.length})
          </h3>

          <div className="space-y-3">
            {repairSuggestions.map((rep) => (
              <div
                key={rep.id}
                className="p-4 rounded-xl border border-surface-border bg-surface/40 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-foreground font-mono">
                      {rep.title}
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {rep.reasoning}
                    </p>
                  </div>

                  <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-surface border border-surface-border text-muted-foreground">
                    {rep.status}
                  </span>
                </div>

                {rep.proposedChange?.diffPreview && (
                  <div className="p-3 rounded-lg bg-code font-mono text-[11px] border border-surface-border overflow-x-auto">
                    <pre className="text-muted-foreground">{rep.proposedChange.diffPreview}</pre>
                  </div>
                )}

                {rep.status === 'PROPOSED' && (
                  <div className="flex items-center space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onApproveRepair(rep.id)}
                      disabled={isApprovingId === rep.id}
                      className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors focus-ring disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isApprovingId === rep.id ? 'Applying...' : 'Approve & Apply'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRejectRepair(rep.id)}
                      disabled={isRejectingId === rep.id}
                      className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg border border-surface-border bg-surface hover:bg-surface-hover text-muted-foreground hover:text-foreground text-xs font-medium transition-colors focus-ring disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>{isRejectingId === rep.id ? 'Rejecting...' : 'Reject'}</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Interactive Engineering Agent Console */}
      <div className="rounded-xl border border-surface-border bg-card p-5 space-y-4">
        <div className="flex items-center space-x-2">
          <Bot className="w-4 h-4 text-sky-500" />
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Autonomous Deployment Assistant
          </h3>
        </div>

        {agentResponse && (
          <div className="p-4 rounded-xl border border-surface-border bg-surface/50 space-y-2 text-xs">
            <span className="font-semibold text-foreground block">
              Response from CloudPilot Agent:
            </span>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {agentResponse.answer}
            </p>
          </div>
        )}

        <form onSubmit={handleAgentSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask CloudPilot agent to inspect configuration, recommend fixes, or optimize Docker build..."
            className="flex-1 px-3.5 py-2 rounded-xl border border-surface-border bg-surface text-foreground text-xs placeholder:text-muted-foreground focus-ring"
          />
          <button
            type="submit"
            disabled={isAgentRunning || !prompt.trim()}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-xs transition-colors focus-ring disabled:opacity-50"
          >
            {isAgentRunning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>{isAgentRunning ? 'Thinking...' : 'Send'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
