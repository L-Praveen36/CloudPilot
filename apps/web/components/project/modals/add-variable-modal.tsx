'use client';

import React, { useState } from 'react';
import { DetailModal } from '@/components/ui/detail-modal';
import { Lock, Plus, ShieldCheck } from 'lucide-react';

interface AddVariableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (key: string, value: string, isSecret: boolean) => Promise<void>;
  environmentName: string;
  isSaving: boolean;
}

export const AddVariableModal: React.FC<AddVariableModalProps> = ({
  isOpen,
  onClose,
  onSave,
  environmentName,
  isSaving,
}) => {
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [isSecret, setIsSecret] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim() || !value) return;
    await onSave(key.trim().toUpperCase(), value, isSecret);
    setKey('');
    setValue('');
    setIsSecret(true);
  };

  return (
    <DetailModal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Environment Variable"
      subtitle={`Securely encrypt variable for '${environmentName}' target environment`}
      icon={<Lock className="w-5 h-5 text-sky-500" />}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block text-[11px] font-medium text-foreground mb-1">
            Variable Key
          </label>
          <input
            type="text"
            required
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="e.g. DATABASE_URL, API_KEY"
            className="w-full px-3 py-2 rounded-xl border border-surface-border bg-surface text-foreground font-mono text-xs focus-ring uppercase"
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-foreground mb-1">
            Variable Value
          </label>
          <textarea
            required
            rows={3}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Enter plain text value to be AES-256-GCM encrypted..."
            className="w-full px-3 py-2 rounded-xl border border-surface-border bg-surface text-foreground font-mono text-xs focus-ring resize-none"
          />
        </div>

        <div className="flex items-center space-x-2.5 p-3 rounded-xl border border-surface-border bg-surface/30">
          <input
            type="checkbox"
            id="isSecretCheckbox"
            checked={isSecret}
            onChange={(e) => setIsSecret(e.target.checked)}
            className="rounded border-surface-border text-sky-600 focus:ring-sky-500 w-4 h-4"
          />
          <label htmlFor="isSecretCheckbox" className="text-xs text-foreground font-medium cursor-pointer">
            Mark as Secret (Masked in UI, protected from unauthorized exposure)
          </label>
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
            type="submit"
            disabled={isSaving || !key.trim() || !value}
            className="inline-flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-xs transition-colors focus-ring disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Encrypting & Saving...' : 'Save Variable'}</span>
          </button>
        </div>
      </form>
    </DetailModal>
  );
};
