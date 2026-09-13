'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { RepositoryPagination as PaginationMeta } from '@cloudpilot/shared';

interface RepositoryPaginationProps {
  pagination: PaginationMeta;
  onPageChange: (newPage: number) => void;
  isLoading: boolean;
}

export const RepositoryPagination: React.FC<RepositoryPaginationProps> = ({
  pagination,
  onPageChange,
  isLoading,
}) => {
  const { page, hasNextPage, hasPreviousPage } = pagination;

  return (
    <div className="flex items-center justify-between pt-8 border-t border-slate-800/80 mt-8">
      {/* Previous Button */}
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={!hasPreviousPage || isLoading || page <= 1}
        aria-label="Go to previous page"
        className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 hover:border-slate-600 text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-900/90 disabled:hover:text-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
      >
        <ChevronLeft className="w-4 h-4" />
        <span>Previous</span>
      </button>

      {/* Page Badge */}
      <div className="flex items-center space-x-2">
        <span className="text-xs text-slate-400 font-mono">
          Page <strong className="text-slate-200 font-semibold px-2 py-0.5 rounded bg-slate-800 border border-slate-700/80">{page}</strong>
        </span>
      </div>

      {/* Next Button */}
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={!hasNextPage || isLoading}
        aria-label="Go to next page"
        className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 hover:border-slate-600 text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-900/90 disabled:hover:text-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
      >
        <span>Next</span>
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};
