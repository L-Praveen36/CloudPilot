'use client';

import React, { useState, useEffect } from 'react';
import { X, Zap, GitBranch, Lock, Globe, AlertCircle, Loader2 } from 'lucide-react';
import { GitHubRepositoryDto, ProjectDto } from '@cloudpilot/shared';
import { createProject, ApiClientError } from '@/lib/api';

interface ConnectModalProps {
  repo: GitHubRepositoryDto | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (project: ProjectDto) => void;
}

export const ConnectModal: React.FC<ConnectModalProps> = ({
  repo,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset state when opened or repo changes
  useEffect(() => {
    if (isOpen) {
      setIsSubmitting(false);
      setErrorMessage(null);
    }
  }, [isOpen, repo]);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !repo) {
    return null;
  }

  const handleConnect = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await createProject({
        githubRepositoryId: repo.id,
        repositoryOwner: repo.owner.login,
        repositoryName: repo.name,
      });

      onSuccess(response.project);
      onClose();
    } catch (err: any) {
      if (err instanceof ApiClientError) {
        if (err.status === 409) {
          setErrorMessage('This repository is already connected to your CloudPilot account.');
        } else {
          setErrorMessage(err.message);
        }
      } else {
        setErrorMessage('Failed to connect repository. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="connect-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <div
        onClick={!isSubmitting ? onClose : undefined}
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-700/80 bg-slate-900 shadow-2xl p-6 sm:p-7 z-10 animate-in fade-in zoom-in-95 duration-150">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isSubmitting}
          aria-label="Close modal"
          className="absolute top-5 right-5 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3 mb-5">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Zap className="w-5 h-5 fill-cyan-400" />
          </div>
          <div>
            <h2 id="connect-modal-title" className="text-lg font-bold text-white tracking-tight">
              Connect Repository
            </h2>
            <p className="text-xs text-slate-400">
              Create a persistent deployment project in CloudPilot
            </p>
          </div>
        </div>

        {/* Error Alert inside Modal */}
        {errorMessage && (
          <div className="flex items-start space-x-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs mb-5 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* Repository Summary Box */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 mb-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Target Repository</span>
            <div className="flex items-center space-x-1.5">
              {repo.private ? (
                <span className="inline-flex items-center space-x-1 text-[11px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  <Lock className="w-3 h-3" />
                  <span>Private</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  <Globe className="w-3 h-3" />
                  <span>Public</span>
                </span>
              )}
            </div>
          </div>
          <p className="text-sm font-bold text-cyan-300 font-mono break-all">{repo.fullName}</p>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
            <span className="text-slate-400">Default Branch</span>
            <span className="inline-flex items-center space-x-1 text-slate-200 font-mono">
              <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
              <span>{repo.defaultBranch}</span>
            </span>
          </div>
        </div>

        {/* Explanatory Info */}
        <p className="text-xs text-slate-400 leading-relaxed mb-6">
          Connecting this repository creates a persistent CloudPilot project. CloudPilot will verify
          repository accessibility with GitHub and store the project configuration in PostgreSQL.
        </p>

        {/* Modal Actions */}
        <div className="flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConnect}
            disabled={isSubmitting}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold shadow-lg shadow-cyan-950/50 hover:shadow-cyan-500/25 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 fill-white" />
                <span>Connect & Create Project</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
