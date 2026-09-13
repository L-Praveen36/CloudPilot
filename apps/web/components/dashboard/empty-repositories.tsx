'use client';

import React from 'react';
import { FolderGit2, SearchX, RotateCw, ExternalLink } from 'lucide-react';

interface EmptyRepositoriesProps {
  isSearch: boolean;
  searchQuery?: string;
  onClearSearch?: () => void;
  onRefresh?: () => void;
}

export const EmptyRepositories: React.FC<EmptyRepositoriesProps> = ({
  isSearch,
  searchQuery,
  onClearSearch,
  onRefresh,
}) => {
  if (isSearch) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30">
        <div className="p-3.5 rounded-2xl bg-slate-800/80 text-slate-400 mb-4 ring-1 ring-slate-700/50">
          <SearchX className="w-8 h-8" />
        </div>
        <h3 className="text-base font-bold text-slate-200 mb-1">No matching repositories found</h3>
        <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
          No loaded repositories matched your search query{' '}
          {searchQuery && <strong className="text-cyan-400 font-mono">"{searchQuery}"</strong>}.
          Try refining your terms.
        </p>
        {onClearSearch && (
          <button
            onClick={onClearSearch}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
          >
            <span>Clear Search</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30">
      <div className="p-3.5 rounded-2xl bg-cyan-500/10 text-cyan-400 mb-4 ring-1 ring-cyan-500/20">
        <FolderGit2 className="w-8 h-8" />
      </div>
      <h3 className="text-base font-bold text-slate-100 mb-1">No repositories found</h3>
      <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
        Your connected GitHub account does not appear to have any accessible repositories yet, or
        CloudPilot has not been granted repository access.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-950 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Refresh Repositories</span>
          </button>
        )}
        <a
          href="https://github.com/new"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
        >
          <span>Create on GitHub</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
};
