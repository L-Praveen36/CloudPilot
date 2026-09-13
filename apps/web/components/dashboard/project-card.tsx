'use client';

import React from 'react';
import Link from 'next/link';
import {
  Lock,
  Globe,
  GitBranch,
  ArrowUpRight,
  Trash2,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { ProjectDto } from '@cloudpilot/shared';

interface ProjectCardProps {
  project: ProjectDto;
  onDisconnect: (project: ProjectDto) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, onDisconnect }) => {
  const createdDate = new Date(project.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900/90 hover:border-slate-700/90 transition-all duration-200 p-5 shadow-lg shadow-black/20 hover:shadow-cyan-950/20 backdrop-blur-sm">
      {/* Header & Title */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center space-x-2 min-w-0">
            {project.private ? (
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
              title={project.repositoryFullName}
              className="font-bold text-sm sm:text-base text-slate-100 group-hover:text-cyan-300 transition-colors truncate"
            >
              {project.repositoryName}
            </h3>
          </div>

          {/* Status Badge */}
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-medium flex-shrink-0">
            <CheckCircle2 className="w-3 h-3" />
            <span>Connected</span>
          </div>
        </div>

        <p className="text-xs text-slate-400 font-mono mb-4 truncate">
          {project.repositoryFullName}
        </p>
      </div>

      {/* Metadata & Actions */}
      <div>
        <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-800/80 mb-4">
          <div className="flex items-center space-x-1.5 text-slate-400" title="Connected date">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[11px]">{createdDate}</span>
          </div>

          <div
            className="flex items-center space-x-1 font-mono text-[11px] text-cyan-400/90"
            title={`Default branch: ${project.defaultBranch}`}
          >
            <GitBranch className="w-3 h-3" />
            <span>{project.defaultBranch}</span>
          </div>
        </div>

        {/* Bottom Action Buttons */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            onClick={() => onDisconnect(project)}
            title="Disconnect project from CloudPilot"
            className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-red-500/15 text-slate-400 hover:text-red-400 border border-slate-800 hover:border-red-500/30 text-xs font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Disconnect</span>
          </button>

          <Link
            href={`/projects/${project.id}`}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold shadow-md shadow-cyan-950/50 hover:shadow-cyan-500/20 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <span>Open Project</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
};
