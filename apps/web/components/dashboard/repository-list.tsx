'use client';

import React from 'react';
import { GitHubRepositoryDto } from '@cloudpilot/shared';
import { RepositoryCard } from './repository-card';

interface RepositoryListProps {
  repositories: GitHubRepositoryDto[];
  onConnect: (repo: GitHubRepositoryDto) => void;
}

export const RepositoryList: React.FC<RepositoryListProps> = ({
  repositories,
  onConnect,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {repositories.map((repo) => (
        <RepositoryCard key={repo.id} repo={repo} onConnect={onConnect} />
      ))}
    </div>
  );
};
