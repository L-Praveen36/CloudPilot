'use client';

import React from 'react';
import { DetailModal } from '@/components/ui/detail-modal';
import { DeploymentDto } from '@cloudpilot/shared';
import { RotateCcw, AlertTriangle, GitCommit } from 'lucide-react';

interface RollbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetDeployment: DeploymentDto | null;
  onConfirm: () => Promise<void>;
  isExecuting: boolean;
}

export const RollbackModal: React.FC<RollbackModalProps> = ({
  isOpen,
  onClose,
  targetDeployment,
  onConfirm,
  isExecuting,
}) => {
  if (!targetDeployment) return null;

  return (
    <DetailModal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirm Instant Rollback"
      subtitle="Restore previous verified healthy configuration & container version"
      icon={<RotateCcw className="w-5 h-5 text-amber-500" />}
      maxWidth="md"
    >
      <div className="space-y-4 text-xs">
        <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-300 flex items-start space-x-2.5">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            This will trigger a new deployment reproducing the build artifact and environment state of <strong>Deployment #{targetDeployment.deploymentNumber}</strong>.
          </p>
        </div>

        <div className="p-3.5 rounded-xl border border-surface-border bg-surface/50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Target Version:</span>
            <span className="font-semibold text-foreground">Deployment #{targetDeployment.deploymentNumber}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Commit SHA:</span>
            <span className="font-mono text-foreground flex items-center gap-1">
              <GitCommit className="w-3.5 h-3.5 text-sky-500" />
              {targetDeployment.commitSha?.substring(0, 7) || 'latest'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Original Strategy:</span>
            <span className="font-mono text-foreground">{targetDeployment.strategy}</span>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-surface-border bg-surface hover:bg-surface-hover text-foreground text-xs font-medium transition-colors focus-ring"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isExecuting}
            className="inline-flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-xs transition-colors focus-ring disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isExecuting ? 'animate-spin' : ''}`} />
            <span>{isExecuting ? 'Initiating Rollback...' : 'Execute Rollback'}</span>
          </button>
        </div>
      </div>
    </DetailModal>
  );
};
