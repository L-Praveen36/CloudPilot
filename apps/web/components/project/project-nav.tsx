'use client';

import React from 'react';
import {
  LayoutDashboard,
  Boxes,
  FolderGit2,
  ShieldCheck,
  Rocket,
  Activity,
  Sparkles,
  Settings2,
} from 'lucide-react';

export type ProjectTabType =
  | 'overview'
  | 'applications'
  | 'repository'
  | 'readiness'
  | 'deployment'
  | 'observability'
  | 'ai'
  | 'cicd';

interface ProjectNavProps {
  activeTab: ProjectTabType;
  onTabChange: (tab: ProjectTabType) => void;
  badgeCounts?: {
    applications?: number;
    readinessScore?: number;
    deployments?: number;
    aiRepairs?: number;
  };
}

export const ProjectNav: React.FC<ProjectNavProps> = ({
  activeTab,
  onTabChange,
  badgeCounts,
}) => {
  const tabs: Array<{
    id: ProjectTabType;
    label: string;
    icon: React.ReactNode;
    badge?: React.ReactNode;
  }> = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'applications',
      label: 'Applications',
      icon: <Boxes className="w-4 h-4" />,
      badge: badgeCounts?.applications ? (
        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-surface border border-surface-border text-muted-foreground font-mono">
          {badgeCounts.applications}
        </span>
      ) : null,
    },
    {
      id: 'repository',
      label: 'Repository',
      icon: <FolderGit2 className="w-4 h-4" />,
    },
    {
      id: 'readiness',
      label: 'Readiness',
      icon: <ShieldCheck className="w-4 h-4" />,
      badge: badgeCounts?.readinessScore !== undefined ? (
        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 font-mono font-medium">
          {badgeCounts.readinessScore}%
        </span>
      ) : null,
    },
    {
      id: 'deployment',
      label: 'Deployment',
      icon: <Rocket className="w-4 h-4" />,
    },
    {
      id: 'observability',
      label: 'Observability',
      icon: <Activity className="w-4 h-4" />,
    },
    {
      id: 'ai',
      label: 'AI Insights',
      icon: <Sparkles className="w-4 h-4" />,
      badge: badgeCounts?.aiRepairs ? (
        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 font-mono">
          {badgeCounts.aiRepairs}
        </span>
      ) : null,
    },
    {
      id: 'cicd',
      label: 'CI/CD & Envs',
      icon: <Settings2 className="w-4 h-4" />,
    },
  ];

  return (
    <div className="border-b border-surface-border overflow-x-auto no-scrollbar">
      <nav className="flex space-x-1 sm:space-x-2 min-w-max py-1" aria-label="Project Sections">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`inline-flex items-center space-x-2 px-3 sm:px-3.5 py-2 rounded-lg text-xs font-semibold transition-all focus-ring ${
                isActive
                  ? 'bg-accent text-accent-foreground border border-surface-border shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface-hover'
              }`}
            >
              <span className={isActive ? 'text-sky-500' : 'text-muted-foreground'}>
                {tab.icon}
              </span>
              <span>{tab.label}</span>
              {tab.badge}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
