'use client';

import React, { useState } from 'react';
import {
  EnvironmentDto,
  EnvironmentVariableDto,
  CicdSettingsDto,
  GithubWebhookEventDto,
  DeploymentDto,
} from '@cloudpilot/shared';
import { AddVariableModal } from '../modals/add-variable-modal';
import { CopyButton } from '@/components/ui/copy-button';
import {
  Settings2,
  Lock,
  Plus,
  Trash2,
  Key,
  ShieldCheck,
  Radio,
  RotateCcw,
  CheckCircle2,
  GitBranch,
} from 'lucide-react';

interface CicdTabProps {
  environments: EnvironmentDto[];
  selectedEnvId: string | null;
  onSelectEnv: (envId: string) => void;
  envVariables: EnvironmentVariableDto[];
  onSaveVariable: (key: string, value: string, isSecret: boolean) => Promise<void>;
  onDeleteVariable: (varId: string, varKey: string) => Promise<void>;
  cicdSettings: CicdSettingsDto | null;
  onSaveWebhookSecret: (secret: string) => Promise<void>;
  webhookEvents: GithubWebhookEventDto[];
  deployments: DeploymentDto[];
  onOpenRollbackModal?: (dep: DeploymentDto) => void;
  isSavingVariable?: boolean;
  isDeletingVarId?: string | null;
}

export const CicdTab: React.FC<CicdTabProps> = ({
  environments,
  selectedEnvId,
  onSelectEnv,
  envVariables = [],
  onSaveVariable,
  onDeleteVariable,
  cicdSettings,
  onSaveWebhookSecret,
  webhookEvents = [],
  deployments = [],
  onOpenRollbackModal,
  isSavingVariable = false,
  isDeletingVarId = null,
}) => {
  const [showAddVarModal, setShowAddVarModal] = useState(false);
  const [webhookSecretInput, setWebhookSecretInput] = useState('');
  const [isSavingSecret, setIsSavingSecret] = useState(false);

  const selectedEnv = environments.find((e) => e.id === selectedEnvId) || environments[0];

  const handleSecretSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookSecretInput.trim()) return;
    setIsSavingSecret(true);
    await onSaveWebhookSecret(webhookSecretInput.trim());
    setWebhookSecretInput('');
    setIsSavingSecret(false);
  };

  const formatCopyVariables = () => {
    return [
      `CloudPilot Configured Variables (${selectedEnv?.name || 'default'})`,
      '====================================================',
      ...envVariables.map((v) => `- ${v.key} [${v.isSecret ? 'Encrypted Secret' : 'Plain Text'}]`),
    ].join('\n');
  };

  return (
    <div className="space-y-6">
      {/* Tab Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-surface-border">
        <div>
          <h2 className="text-base font-semibold text-foreground tracking-tight">
            CI/CD & Environment Management
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Phase 7 · Target environment isolation, AES-256-GCM encrypted secrets, automated webhooks, and zero-downtime rollbacks.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <CopyButton
            textToCopy={formatCopyVariables}
            label="Copy Var Keys"
            variant="outline"
          />
        </div>
      </div>

      {/* Target Environments Pill Selector */}
      <div className="rounded-xl border border-surface-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Target Environments ({environments.length})
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {environments.map((env) => {
            const isSelected = selectedEnv?.id === env.id;
            return (
              <div
                key={env.id}
                onClick={() => onSelectEnv(env.id)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-sky-500 bg-accent text-accent-foreground shadow-xs'
                    : 'border-surface-border bg-surface/50 hover:bg-surface-hover text-foreground'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-xs uppercase font-mono tracking-tight">
                    {env.name}
                  </span>
                  <span className="text-[10px] uppercase px-1.5 py-0.2 rounded bg-surface border border-surface-border text-muted-foreground">
                    {env.type}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1 font-mono">
                    <GitBranch className="w-3 h-3 text-sky-500" />
                    {env.branchPattern || 'main'}
                  </span>
                  <span>{env.variablesCount || 0} variables</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Encrypted Environment Variables Table */}
      <div className="rounded-xl border border-surface-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-sky-500" />
              <span>Encrypted Variables for '{selectedEnv?.name || 'Environment'}'</span>
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Secrets are AES-256-GCM encrypted in database and decrypted only during Docker container runtime execution.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddVarModal(true)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-xs transition-colors focus-ring"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Variable</span>
          </button>
        </div>

        <div className="rounded-lg border border-surface-border bg-surface/30 divide-y divide-surface-border overflow-hidden text-xs">
          {envVariables.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-xs">
              No environment variables configured for {selectedEnv?.name}. Add required secrets above.
            </div>
          ) : (
            envVariables.map((v) => (
              <div key={v.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="font-mono font-bold text-foreground">
                    {v.key}
                  </span>
                  <div className="font-mono text-muted-foreground text-[11px]">
                    {v.isSecret ? '••••••••••••••••' : (v.maskedValue || 'Configured')}
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-surface border border-surface-border text-muted-foreground">
                    {v.isSecret ? 'Encrypted Secret' : 'Plain Text'}
                  </span>

                  <button
                    type="button"
                    onClick={() => onDeleteVariable(v.id, v.key)}
                    disabled={isDeletingVarId === v.id}
                    className="p-1 rounded text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors focus-ring disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* CI/CD Webhook & Automation Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-surface-border bg-card p-5 space-y-3">
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-sky-500" />
            <span>GitHub Webhook Configuration</span>
          </h3>

          <p className="text-[11px] text-muted-foreground">
            Configure SHA-256 HMAC webhook secret for automated deployment on push to default branch.
          </p>

          <form onSubmit={handleSecretSubmit} className="space-y-2 pt-1 text-xs">
            <input
              type="password"
              value={webhookSecretInput}
              onChange={(e) => setWebhookSecretInput(e.target.value)}
              placeholder="Enter new Webhook HMAC Secret..."
              className="w-full px-3 py-2 rounded-xl border border-surface-border bg-surface text-foreground font-mono text-xs focus-ring"
            />
            <button
              type="submit"
              disabled={isSavingSecret || !webhookSecretInput.trim()}
              className="px-3.5 py-1.5 rounded-lg bg-surface hover:bg-surface-hover border border-surface-border text-foreground text-xs font-semibold transition-colors focus-ring disabled:opacity-50"
            >
              {isSavingSecret ? 'Updating...' : 'Update Webhook Secret'}
            </button>
          </form>
        </div>

        {/* Webhook Delivery Audit Log */}
        <div className="rounded-xl border border-surface-border bg-card p-5 space-y-3">
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Recent Webhook Events ({webhookEvents.length})
          </h3>

          <div className="rounded-lg border border-surface-border bg-surface/30 divide-y divide-surface-border max-h-48 overflow-y-auto text-xs">
            {webhookEvents.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-[11px]">
                No webhook events recorded yet.
              </div>
            ) : (
              webhookEvents.map((evt) => (
                <div key={evt.id} className="p-2.5 flex items-center justify-between text-[11px]">
                  <div>
                    <span className="font-semibold text-foreground uppercase font-mono">
                      {evt.event}
                    </span>
                    <span className="text-muted-foreground font-mono ml-2">
                      {evt.ref || 'main'}
                    </span>
                  </div>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-surface border border-surface-border text-muted-foreground">
                    {evt.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Add Variable Modal */}
      <AddVariableModal
        isOpen={showAddVarModal}
        onClose={() => setShowAddVarModal(false)}
        onSave={async (k, v, s) => {
          await onSaveVariable(k, v, s);
          setShowAddVarModal(false);
        }}
        environmentName={selectedEnv?.name || 'Development'}
        isSaving={isSavingVariable}
      />
    </div>
  );
};
