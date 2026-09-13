'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  UserDto,
  GitHubRepositoryDto,
  ProjectDto,
  RepositoryPagination as PaginationMeta,
  RepositoryRateLimit,
} from '@cloudpilot/shared';
import {
  getCurrentUser,
  getRepositories,
  getProjects,
  deleteProject,
  logout,
  ApiClientError,
} from '@/lib/api';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { RepositorySearch } from '@/components/dashboard/repository-search';
import { RepositoryList } from '@/components/dashboard/repository-list';
import { RepositorySkeleton } from '@/components/dashboard/repository-skeleton';
import { EmptyRepositories } from '@/components/dashboard/empty-repositories';
import { RepositoryPagination } from '@/components/dashboard/repository-pagination';
import { ProjectCard } from '@/components/dashboard/project-card';
import { ConnectModal } from '@/components/dashboard/connect-modal';
import {
  AlertCircle,
  CheckCircle2,
  X,
  RefreshCw,
  FolderGit2,
  Layers,
  Sparkles,
  Plus,
} from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();

  // User & Auth State
  const [user, setUser] = useState<UserDto | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);

  // Active Tab: 'projects' or 'repositories'
  const [activeTab, setActiveTab] = useState<'projects' | 'repositories'>('projects');

  // Projects State
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [isProjectsLoading, setIsProjectsLoading] = useState<boolean>(true);

  // Repositories State
  const [repositories, setRepositories] = useState<GitHubRepositoryDto[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    perPage: 30,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [rateLimit, setRateLimit] = useState<RepositoryRateLimit | undefined>(undefined);
  const [isRepoLoading, setIsRepoLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Error State
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<number | null>(null);

  // Connect Modal & Success Banner State
  const [selectedRepoForConnect, setSelectedRepoForConnect] =
    useState<GitHubRepositoryDto | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Project to Disconnect Confirmation Modal
  const [projectToDisconnect, setProjectToDisconnect] = useState<ProjectDto | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState<boolean>(false);

  // 1. Fetch Current User on Mount
  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      try {
        const data = await getCurrentUser();
        if (isMounted) {
          setUser(data.user);
        }
      } catch {
        if (isMounted) {
          router.replace('/');
        }
      } finally {
        if (isMounted) {
          setIsAuthLoading(false);
        }
      }
    }

    loadUser();

    return () => {
      isMounted = false;
    };
  }, [router]);

  // 2. Fetch Projects
  const fetchProjectsList = useCallback(async () => {
    setIsProjectsLoading(true);
    try {
      const response = await getProjects();
      setProjects(response.projects);
    } catch (err: any) {
      if (err instanceof ApiClientError && err.status === 401) {
        router.replace('/');
      }
    } finally {
      setIsProjectsLoading(false);
    }
  }, [router]);

  // 3. Fetch Repositories for given page
  const fetchRepos = useCallback(
    async (pageToLoad: number, showRefreshSpinner: boolean = false) => {
      if (showRefreshSpinner) {
        setIsRefreshing(true);
      } else {
        setIsRepoLoading(true);
      }
      setErrorMessage(null);
      setErrorCode(null);

      try {
        const response = await getRepositories(pageToLoad, 30);
        setRepositories(response.repositories);
        setPagination(response.pagination);
        if (response.rateLimit) {
          setRateLimit(response.rateLimit);
        }
      } catch (err: any) {
        if (err instanceof ApiClientError) {
          if (err.status === 401) {
            router.replace('/');
            return;
          }
          setErrorCode(err.status);
          setErrorMessage(err.message);
          if (err.rateLimit) {
            setRateLimit(err.rateLimit);
          }
        } else {
          setErrorMessage('Failed to load repositories. Please try again.');
        }
      } finally {
        setIsRepoLoading(false);
        setIsRefreshing(false);
      }
    },
    [router],
  );

  // Load projects and repos when user is verified
  useEffect(() => {
    if (user) {
      fetchProjectsList();
      fetchRepos(1);
    }
  }, [user, fetchProjectsList, fetchRepos]);

  // Handle Logout
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      router.replace('/');
    }
  };

  // Handle Page Change for Repositories
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage === pagination.page) return;
    setSearchQuery('');
    fetchRepos(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Client-Side Search Filtering for Repositories
  const filteredRepositories = useMemo(() => {
    if (!searchQuery.trim()) {
      return repositories;
    }
    const q = searchQuery.toLowerCase().trim();
    return repositories.filter((repo) => {
      const nameMatch = repo.name.toLowerCase().includes(q);
      const descMatch = repo.description?.toLowerCase().includes(q);
      return nameMatch || descMatch;
    });
  }, [repositories, searchQuery]);

  // Client-Side Search Filtering for Projects
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) {
      return projects;
    }
    const q = searchQuery.toLowerCase().trim();
    return projects.filter((proj) =>
      proj.repositoryFullName.toLowerCase().includes(q),
    );
  }, [projects, searchQuery]);

  // Handle Connect Success (Phase 2.4 Persistent Project Created)
  const handleConnectSuccess = (newProject: ProjectDto) => {
    setProjects((prev) => [newProject, ...prev.filter((p) => p.id !== newProject.id)]);
    setSuccessBanner(`Repository "${newProject.repositoryFullName}" connected successfully as a CloudPilot project.`);
    setActiveTab('projects');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle Project Disconnection
  const handleConfirmDisconnect = async () => {
    if (!projectToDisconnect) return;
    setIsDisconnecting(true);

    try {
      await deleteProject(projectToDisconnect.id);
      setProjects((prev) => prev.filter((p) => p.id !== projectToDisconnect.id));
      setSuccessBanner(`Project "${projectToDisconnect.repositoryFullName}" was disconnected.`);
      setProjectToDisconnect(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to disconnect project');
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center text-slate-400">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-10 h-10 border-4 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin" />
          <p className="text-sm font-medium">Verifying CloudPilot session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col justify-between relative overflow-hidden">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[360px] bg-gradient-to-b from-blue-600/10 via-cyan-500/5 to-transparent blur-3xl pointer-events-none" />

      {/* Top Header */}
      <DashboardHeader
        user={user}
        onLogout={handleLogout}
        loggingOut={isLoggingOut}
      />

      {/* Main Workspace Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {/* Success Banner */}
        {successBanner && (
          <div className="mb-6 p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-start space-x-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs sm:text-sm font-medium text-emerald-200">
                {successBanner}
              </p>
            </div>
            <button
              onClick={() => setSuccessBanner(null)}
              aria-label="Dismiss banner"
              className="text-emerald-400 hover:text-emerald-200 p-1 -m-1 rounded focus:outline-none"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Error Alert Banner */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-300 flex items-start justify-between gap-3">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-white">
                  {errorCode === 429
                    ? 'GitHub API Rate Limit Reached'
                    : errorCode === 502
                    ? 'GitHub API Temporarily Unavailable'
                    : 'Notice'}
                </p>
                <p className="text-xs text-red-300/90 mt-0.5 leading-relaxed">
                  {errorMessage}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setErrorMessage(null);
                fetchRepos(pagination.page);
                fetchProjectsList();
              }}
              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 text-xs font-semibold transition-colors flex-shrink-0"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Dashboard Title & Tabs Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Control Plane
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Manage your persistent CloudPilot deployment projects and GitHub repositories.
            </p>
          </div>

          {/* Segmented Tab Controls */}
          <div className="inline-flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 self-start sm:self-auto">
            <button
              onClick={() => {
                setActiveTab('projects');
                setSearchQuery('');
              }}
              className={`inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'projects'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Connected Projects</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  activeTab === 'projects'
                    ? 'bg-cyan-700/80 text-white'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {projects.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab('repositories');
                setSearchQuery('');
              }}
              className={`inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'repositories'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <FolderGit2 className="w-3.5 h-3.5" />
              <span>Browse Repositories</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  activeTab === 'repositories'
                    ? 'bg-cyan-700/80 text-white'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {repositories.length}
              </span>
            </button>
          </div>
        </div>

        {/* TAB 1: CONNECTED PROJECTS */}
        {activeTab === 'projects' && (
          <div>
            {isProjectsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-pulse">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-44 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5"
                  />
                ))}
              </div>
            ) : projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-14 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30">
                <div className="p-3.5 rounded-2xl bg-cyan-500/10 text-cyan-400 mb-4 ring-1 ring-cyan-500/20">
                  <Sparkles className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-slate-100 mb-1">
                  No Connected Projects Yet
                </h3>
                <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
                  Connect a repository from your GitHub account to create your first persistent
                  CloudPilot deployment project.
                </p>
                <button
                  onClick={() => setActiveTab('repositories')}
                  className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold shadow-lg shadow-cyan-950 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  <Plus className="w-4 h-4" />
                  <span>Browse & Connect Repositories</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onDisconnect={(proj) => setProjectToDisconnect(proj)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: BROWSE GITHUB REPOSITORIES */}
        {activeTab === 'repositories' && (
          <div>
            {/* Search, Stats & Refresh Controls */}
            {!isRepoLoading && repositories.length > 0 && (
              <RepositorySearch
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onRefresh={() => fetchRepos(pagination.page, true)}
                isRefreshing={isRefreshing}
                totalLoaded={repositories.length}
                totalFiltered={filteredRepositories.length}
                rateLimit={rateLimit}
              />
            )}

            {/* Repository Grid / Skeleton / Empty States */}
            {isRepoLoading ? (
              <RepositorySkeleton />
            ) : repositories.length === 0 ? (
              <EmptyRepositories
                isSearch={false}
                onRefresh={() => fetchRepos(1, true)}
              />
            ) : filteredRepositories.length === 0 ? (
              <EmptyRepositories
                isSearch={true}
                searchQuery={searchQuery}
                onClearSearch={() => setSearchQuery('')}
              />
            ) : (
              <>
                <RepositoryList
                  repositories={filteredRepositories}
                  onConnect={(repo: GitHubRepositoryDto) => setSelectedRepoForConnect(repo)}
                />

                {/* Pagination Controls */}
                <RepositoryPagination
                  pagination={pagination}
                  onPageChange={handlePageChange}
                  isLoading={isRepoLoading || isRefreshing}
                />
              </>
            )}
          </div>
        )}
      </main>

      {/* Connect Confirmation Modal */}
      <ConnectModal
        repo={selectedRepoForConnect}
        isOpen={Boolean(selectedRepoForConnect)}
        onClose={() => setSelectedRepoForConnect(null)}
        onSuccess={handleConnectSuccess}
      />

      {/* Disconnect Project Confirmation Modal */}
      {projectToDisconnect && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
        >
          <div
            onClick={() => !isDisconnecting && setProjectToDisconnect(null)}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-md rounded-2xl border border-red-500/30 bg-slate-900 p-6 z-10 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">Disconnect Project?</h3>
            <p className="text-xs text-slate-300 mb-6 leading-relaxed">
              Are you sure you want to disconnect{' '}
              <strong className="font-mono text-cyan-300">{projectToDisconnect.repositoryFullName}</strong>?
              This removes the project record from CloudPilot. Your GitHub repository will not be affected.
            </p>
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setProjectToDisconnect(null)}
                disabled={isDisconnecting}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDisconnect}
                disabled={isDisconnecting}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold disabled:opacity-50"
              >
                {isDisconnecting ? 'Disconnecting...' : 'Yes, Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500 bg-[#090d16]/80 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>&copy; {new Date().getFullYear()} CloudPilot Platform. Phase 2.4 Ready.</span>
          <div className="flex items-center space-x-4 text-slate-400">
            <span>Next.js 15</span>
            <span>&bull;</span>
            <span>NestJS 11</span>
            <span>&bull;</span>
            <span>Prisma</span>
            <span>&bull;</span>
            <span>PostgreSQL</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
