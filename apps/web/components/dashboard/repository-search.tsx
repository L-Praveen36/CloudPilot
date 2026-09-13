'use client';

import React from 'react';
import { Search, RotateCw, X, Activity } from 'lucide-react';
import { RepositoryRateLimit } from '@cloudpilot/shared';

interface RepositorySearchProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  totalLoaded: number;
  totalFiltered: number;
  rateLimit?: RepositoryRateLimit;
}

export const RepositorySearch: React.FC<RepositorySearchProps> = ({
  searchQuery,
  onSearchChange,
  onRefresh,
  isRefreshing,
  totalLoaded,
  totalFiltered,
  rateLimit,
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
      {/* Search Input */}
      <div className="relative flex-1 max-w-md">
        <label htmlFor="repo-search" className="sr-only">
          Search repositories
        </label>
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          id="repo-search"
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search loaded repositories by name or description..."
          className="w-full pl-10 pr-9 py-2 rounded-xl bg-slate-900/80 border border-slate-800 focus:border-cyan-500/80 focus:ring-2 focus:ring-cyan-500/20 text-slate-100 placeholder-slate-500 text-xs sm:text-sm transition-all focus:outline-none"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            aria-label="Clear search query"
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 focus:outline-none"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Right Controls: Count, RateLimit & Refresh */}
      <div className="flex items-center justify-between sm:justify-end space-x-3 text-xs">
        {/* Results Count */}
        <span className="text-slate-400 font-mono">
          {searchQuery ? (
            <span>
              Showing <strong className="text-cyan-400 font-semibold">{totalFiltered}</strong> of{' '}
              {totalLoaded}
            </span>
          ) : (
            <span>
              <strong className="text-slate-200 font-semibold">{totalLoaded}</strong> repositories
              on page
            </span>
          )}
        </span>

        {/* Rate Limit Pill (if available) */}
        {rateLimit && (
          <div
            title={`GitHub API Quota: ${rateLimit.remaining} requests remaining${
              rateLimit.resetAt ? ` (resets at ${new Date(rateLimit.resetAt).toLocaleTimeString()})` : ''
            }`}
            className="hidden md:inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 text-[11px] font-mono cursor-default"
          >
            <Activity className="w-3 h-3 text-cyan-400" />
            <span>API: {rateLimit.remaining} reqs</span>
          </div>
        )}

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          aria-label="Refresh repository list"
          className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 hover:border-slate-600 text-xs font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:opacity-50"
        >
          <RotateCw
            className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`}
          />
          <span className="hidden sm:inline">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>
    </div>
  );
};
