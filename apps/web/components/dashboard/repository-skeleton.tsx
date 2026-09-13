'use client';

import React from 'react';

export const RepositorySkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-pulse">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="flex flex-col justify-between h-56 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5"
        >
          <div>
            {/* Title & Badge */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-5 h-5 rounded bg-slate-800" />
                <div className="w-32 h-4 rounded bg-slate-800" />
              </div>
              <div className="w-14 h-4 rounded-full bg-slate-800" />
            </div>

            {/* Description lines */}
            <div className="space-y-2 mb-4">
              <div className="w-full h-3 rounded bg-slate-800/70" />
              <div className="w-3/4 h-3 rounded bg-slate-800/70" />
            </div>
          </div>

          <div>
            {/* Meta tags */}
            <div className="flex items-center space-x-4 pt-3 border-t border-slate-800/60 mb-4">
              <div className="w-16 h-3 rounded bg-slate-800" />
              <div className="w-10 h-3 rounded bg-slate-800" />
              <div className="w-10 h-3 rounded bg-slate-800" />
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-1">
              <div className="w-20 h-3 rounded bg-slate-800/50" />
              <div className="flex items-center space-x-2">
                <div className="w-16 h-7 rounded-lg bg-slate-800" />
                <div className="w-20 h-7 rounded-lg bg-slate-800" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
