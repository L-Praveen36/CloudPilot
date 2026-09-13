'use client';

import React from 'react';
import Link from 'next/link';
import {
  Lock,
  Globe,
  GitFork,
  Star,
  CircleDot,
  GitBranch,
  ArrowUpRight,
  Zap,
} from 'lucide-react';
import { GitHubRepositoryDto } from '@cloudpilot/shared';

interface RepositoryCardProps {
  repo: GitHubRepositoryDto;
  onConnect: (repo: GitHubRepositoryDto) => void;
}

// Map common languages to distinct dot colors
const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: 'bg-blue-400',
  JavaScript: 'bg-yellow-400',
  Python: 'bg-emerald-400',
  Go: 'bg-cyan-400',
  Rust: 'bg-orange-400',
  Java: 'bg-amber-600',
  Ruby: 'bg-red-500',
  'C++': 'bg-pink-500',
  'C#': 'bg-purple-500',
  PHP: 'bg-indigo-400',
  HTML: 'bg-rose-400',
  CSS: 'bg-blue-500',
  Shell: 'bg-green-400',
};

export const RepositoryCard: React.FC<RepositoryCardProps> = ({ repo, onConnect }) => {
  const languageColor = repo.language
    ? LANGUAGE_COLORS[repo.language] || 'bg-slate-400'
    : 'bg-slate-500';

  const updatedTimeAgo = repo.updatedAt
    ? formatTimeAgo(new Date(repo.updatedAt))
    : 'Recently';

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900/80 hover:border-slate-700/90 transition-all duration-200 p-5 shadow-lg shadow-black/20 hover:shadow-cyan-950/20 backdrop-blur-sm">
      {/* Card Header & Title */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="flex items-center space-x-2 min-w-0">
            {repo.private ? (
              <span
                title="Private repository"
                className="p-1 rounded-md bg-amber-500/10 text-amber-400 flex-shrink-0"
              >
                <Lock className="w-3.5 h-3.5" />
              </span>
            ) : (
              <span
                title="Public repository"
                className="p-1 rounded-md bg-slate-800 text-slate-400 flex-shrink-0"
              >
                <Globe className="w-3.5 h-3.5" />
              </span>
            )}
            <h3
              title={repo.fullName}
              className="font-bold text-sm sm:text-base text-slate-100 group-hover:text-cyan-300 transition-colors truncate"
            >
              {repo.name}
            </h3>
          </div>

          <div className="flex items-center space-x-1.5 flex-shrink-0">
            {repo.fork && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400">
                Fork
              </span>
            )}
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                repo.private
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  : 'bg-slate-800/80 border-slate-700 text-slate-300'
              }`}
            >
              {repo.private ? 'Private' : 'Public'}
            </span>
          </div>
        </div>

        {/* Repository Description */}
        <p className="text-xs text-slate-400 line-clamp-2 min-h-[32px] mb-4 leading-relaxed">
          {repo.description || 'No description provided.'}
        </p>
      </div>

      {/* Meta & Stats */}
      <div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400 pt-3 border-t border-slate-800/80 mb-4">
          {/* Primary Language */}
          {repo.language && (
            <div className="flex items-center space-x-1.5">
              <span className={`w-2 h-2 rounded-full ${languageColor}`} />
              <span className="text-slate-300 font-medium">{repo.language}</span>
            </div>
          )}

          {/* Stars */}
          <div className="flex items-center space-x-1" title={`${repo.stars} stars`}>
            <Star className="w-3 h-3 text-amber-400/80" />
            <span>{repo.stars}</span>
          </div>

          {/* Forks */}
          <div className="flex items-center space-x-1" title={`${repo.forks} forks`}>
            <GitFork className="w-3 h-3 text-slate-400" />
            <span>{repo.forks}</span>
          </div>

          {/* Open Issues */}
          {repo.openIssues > 0 && (
            <div className="flex items-center space-x-1" title={`${repo.openIssues} open issues`}>
              <CircleDot className="w-3 h-3 text-slate-500" />
              <span>{repo.openIssues}</span>
            </div>
          )}

          {/* Default Branch */}
          <div
            className="flex items-center space-x-1 font-mono text-[11px] text-cyan-400/90 ml-auto"
            title={`Default branch: ${repo.defaultBranch}`}
          >
            <GitBranch className="w-3 h-3" />
            <span>{repo.defaultBranch}</span>
          </div>
        </div>

        {/* Bottom Actions Row */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <span className="text-[11px] text-slate-500 truncate" title={repo.updatedAt || undefined}>
            Updated {updatedTimeAgo}
          </span>

          <div className="flex items-center space-x-2">
            <Link
              href={`/repositories/${encodeURIComponent(repo.owner.login)}/${encodeURIComponent(repo.name)}`}
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
            >
              <span>Details</span>
              <ArrowUpRight className="w-3 h-3 text-slate-400" />
            </Link>

            <button
              onClick={() => onConnect(repo)}
              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold shadow-md shadow-cyan-950/50 hover:shadow-cyan-500/20 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <Zap className="w-3 h-3 fill-white" />
              <span>Connect</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}
