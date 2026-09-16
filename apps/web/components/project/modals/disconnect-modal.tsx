'use client';

import React from 'react';
import { DetailModal } from '@/components/ui/detail-modal';
import { Trash2, AlertCircle } from 'lucide-react';

interface DisconnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  onConfirm: () => Promise<void>;
  isDisconnecting: boolean;
}

export const DisconnectModal: React.FC<DisconnectModalProps> = ({
  isOpen,
  onClose,
  projectName,
  onConfirm,
  isDisconnecting,
}) => {
  return (
    <DetailModal
      isOpen={isOpen}
      onClose={onClose}
      title="Disconnect Project"
      subtitle={`Remove '${projectName}' from CloudPilot control plane`}
      icon={<Trash2 className="w-5 h-5 text-rose-500" />}
      maxWidth="md"
    >
      <div className="space-y-4 text-xs">
        <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-800 dark:text-rose-300 flex items-start space-x-2.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Are you sure you want to disconnect <strong>{projectName}</strong>? This removes stored repository analysis, intelligence metadata, and deployment records from CloudPilot.
          </p>
        </div>

        <p className="text-muted-foreground leading-relaxed">
          Your source repository on GitHub remains completely untouched. You can re-connect this repository anytime from the Dashboard.
        </p>

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
            disabled={isDisconnecting}
            className="inline-flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-xs transition-colors focus-ring disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isDisconnecting ? 'Disconnecting...' : 'Disconnect Project'}</span>
          </button>
        </div>
      </div>
    </DetailModal>
  );
};
