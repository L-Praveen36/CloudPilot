'use client';

import React, { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  GitHubRepositoryDto,
  GitHubBranchDto,
  RepositoryPagination as PaginationMeta,
  UserDto,
  ProjectDto,
} from '@cloudpilot/shared';
import {
  getCurrentUser,
  getRepository,
  getBranches,
  logout,
  ApiClientError,
} from '@/lib/api';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { ConnectModal } from '@/components/dashboard/connect-modal';
import {
  ArrowLeft,
  Lock,
  Globe,
  Star,
  GitFork,
  CircleDot,
  GitBranch,
  ExternalLink,
  Copy,
  Check,
  Shield,
  Search,
  Zap,
  AlertCircle,
  FolderGit2,
  RefreshCw,
  CheckCircle2,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface PageProps {
  params: Promise<{
    owner: string;
    repo: string;
  }>;
}

export default function RepositoryDetailPage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const { owner, repo: repoName } = resolvedParams;

  // Auth & User State
  const [user, setUser] = useState<UserDto | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);

  // Repository & Branch Data
  const [repository, setRepository] = useState<GitHubRepositoryDto | null>(null);
  const [branches, setBranches] = useState<GitHubBranchDto[]>([]);
  const [branchPagination, setBranchPagination] = useState<PaginationMeta>({
    page: 1,
    perPage: 30,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  // Loading & Error State
  const [isLoadingRepo, setIsLoadingRepo] = useState<boolean>(true);
  const [isLoadingBranches, setIsLoadingBranches] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState<boolean>(false);

  // Branch Search Filter
  const [branchSearch, setBranchSearch] = useState<string>('');

  // Copy URL Feedback State
  const [copiedType, setCopiedType] = useState<'https' | 'ssh' | null>(null);

  // Connect Modal State
  const [isConnectModalOpen, setIsConnectModalOpen] = useState<boolean>(false);
  const [connectedBanner, setConnectedBanner] = useState<boolean>(false);

  // 1. Verify User Session on Mount
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

  // 2. Fetch Repository Details
  const loadRepository = useCallback(async () => {
    setIsLoadingRepo(true);
    setErrorMessage(null);
    setIsNotFound(false);

    try {
      const response = await getRepository(owner, repoName);
      setRepository(response.repository);
    } catch (err: any) {
      if (err instanceof ApiClientError) {
        if (err.status === 401) {
          router.replace('/');
          return;
        }
        if (err.status === 404) {
          setIsNotFound(true);
          return;
        }
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to load repository details. Please try again.');
      }
    } finally {
      setIsLoadingRepo(false);
    }
  }, [owner, repoName, router]);

  // 3. Fetch Branches for given page
  const loadBranches = useCallback(
    async (pageToLoad: number) => {
      setIsLoadingBranches(true);
      try {
        const response = await getBranches(owner, repoName, pageToLoad, 30);
        setBranches(response.branches);
        setBranchPagination(response.pagination);
      } catch (err: any) {
        if (err instanceof ApiClientError && err.status === 401) {
          router.replace('/');
        }
      } finally {
        setIsLoadingBranches(false);
      }
    },
    [owner, repoName, router],
  );

  // Load repo & initial branches once user is authenticated
  useEffect(() => {
    if (user) {
      loadRepository();
      loadBranches(1);
    }
  }, [user, loadRepository, loadBranches]);

  // Handle Logout
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      router.replace('/');
    }
  };

  // Copy to Clipboard Helper
  const handleCopy = (text: string, type: 'https' | 'ssh') => {
    if (!navigator?.clipboard) return;
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  // Filtered branches by search
  const filteredBranches = branches.filter((branch) =>
    branch.name.toLowerCase().includes(branchSearch.toLowerCase().trim()),
  );

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

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {/* Back Link Breadcrumb */}
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-400 hover:text-cyan-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded p-1 -m-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Repositories</span>
          </Link>
        </div>

        {/* Temporary Connect Banner */}
        {connectedBanner && repository && (
          <div className="mb-6 p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-start space-x-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-white">
                  Repository Connected:{' '}
                  <span className="font-mono text-emerald-300">{repository.fullName}</span>
                </p>
                <p className="text-xs text-emerald-400/90 mt-0.5">
                  Phase 2.3 connection established. Automated project builds and deployment pipelines
                  will be enabled in Phase 2.4.
                </p>
              </div>
            </div>
            <button
              onClick={() => setConnectedBanner(false)}
              aria-label="Dismiss notification"
              className="text-emerald-400 hover:text-emerald-200 p-1 -m-1 rounded focus:outline-none"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Error State */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-300 flex items-start justify-between gap-3">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-white">Error Loading Repository</p>
                <p className="text-xs text-red-300/90 mt-0.5">{errorMessage}</p>
              </div>
            </div>
            <button
              onClick={loadRepository}
              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 text-xs font-semibold transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* 404 Not Found State */}
        {isNotFound ? (
          <div className="flex flex-col items-center justify-center p-16 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30">
            <div className="p-3.5 rounded-2xl bg-amber-500/10 text-amber-400 mb-4 ring-1 ring-amber-500/20">
              <FolderGit2 className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-slate-100 mb-1">Repository Not Found</h2>
            <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
              The repository <span className="font-mono text-cyan-400">{owner}/{repoName}</span> does
              not exist or your connected GitHub account does not have permission to view it.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Dashboard</span>
            </Link>
          </div>
        ) : isLoadingRepo || !repository ? (
          /* Loading Skeleton for Detail Page */
          <div className="space-y-6 animate-pulse">
            <div className="h-44 rounded-2xl border border-slate-800 bg-slate-900/40 p-8" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-48 rounded-2xl border border-slate-800 bg-slate-900/40 p-6" />
              <div className="h-48 rounded-2xl border border-slate-800 bg-slate-900/40 p-6" />
            </div>
          </div>
        ) : (
          /* Main Repository Content */
          <div className="space-y-8">
            {/* Header Card */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-md p-6 sm:p-8 shadow-xl">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-800/80">
                <div>
                  <div className="flex flex-wrap items-center gap-2.5 mb-2">
                    <span className="text-sm font-semibold text-slate-400">{repository.owner.login}</span>
                    <span className="text-slate-600">/</span>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                      {repository.name}
                    </h1>

                    {repository.private ? (
                      <span className="inline-flex items-center space-x-1 text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 font-medium">
                        <Lock className="w-3 h-3" />
                        <span>Private</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 text-[11px] px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                        <Globe className="w-3 h-3" />
                        <span>Public</span>
                      </span>
                    )}

                    {repository.fork && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                        Fork
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
                    {repository.description || 'No description provided for this repository.'}
                  </p>
                </div>

                {/* Right Header Actions */}
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href={repository.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                  >
                    <span>View on GitHub</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <button
                    onClick={() => setIsConnectModalOpen(true)}
                    className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-950/60 hover:shadow-cyan-500/25 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                  >
                    <Zap className="w-3.5 h-3.5 fill-white" />
                    <span>Connect Repository</span>
                  </button>
                </div>
              </div>

              {/* Stats Bar */}
              <div className="flex flex-wrap items-center gap-x-8 gap-y-3 pt-6 text-xs text-slate-400">
                {repository.language && (
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                    <span className="font-semibold text-slate-200">{repository.language}</span>
                  </div>
                )}

                <div className="flex items-center space-x-1.5">
                  <Star className="w-4 h-4 text-amber-400" />
                  <span className="font-semibold text-slate-200">{repository.stars}</span>
                  <span>stars</span>
                </div>

                <div className="flex items-center space-x-1.5">
                  <GitFork className="w-4 h-4 text-slate-400" />
                  <span className="font-semibold text-slate-200">{repository.forks}</span>
                  <span>forks</span>
                </div>

                <div className="flex items-center space-x-1.5">
                  <CircleDot className="w-4 h-4 text-slate-500" />
                  <span className="font-semibold text-slate-200">{repository.openIssues}</span>
                  <span>open issues</span>
                </div>

                <div className="flex items-center space-x-1.5 font-mono text-cyan-400">
                  <GitBranch className="w-4 h-4" />
                  <span>Default: <strong>{repository.defaultBranch}</strong></span>
                </div>
              </div>
            </div>

            {/* Two Column Grid: Clone URLs & Repository Metadata */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Clone Information Panel */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
                <h3 className="text-sm font-bold text-white mb-4">Clone Repository</h3>
                <p className="text-xs text-slate-400 mb-4">
                  Standard public Git clone URLs without embedded credentials.
                </p>

                {/* HTTPS Clone URL */}
                <div className="mb-4">
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                    HTTPS
                  </label>
                  <div className="flex items-center rounded-xl bg-slate-950 border border-slate-800 p-2">
                    <input
                      type="text"
                      readOnly
                      value={repository.cloneUrl}
                      className="flex-1 bg-transparent text-xs text-slate-200 font-mono focus:outline-none select-all"
                    />
                    <button
                      onClick={() => handleCopy(repository.cloneUrl, 'https')}
                      title="Copy HTTPS clone URL"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition-colors focus:outline-none"
                    >
                      {copiedType === 'https' ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* SSH Clone URL */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">SSH</label>
                  <div className="flex items-center rounded-xl bg-slate-950 border border-slate-800 p-2">
                    <input
                      type="text"
                      readOnly
                      value={repository.sshUrl}
                      className="flex-1 bg-transparent text-xs text-slate-200 font-mono focus:outline-none select-all"
                    />
                    <button
                      onClick={() => handleCopy(repository.sshUrl, 'ssh')}
                      title="Copy SSH clone URL"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition-colors focus:outline-none"
                    >
                      {copiedType === 'ssh' ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Repository Timeline Info */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white mb-4">Repository Information</h3>
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between py-2 border-b border-slate-800/60">
                      <span className="text-slate-400">Full Name</span>
                      <span className="font-mono text-slate-200">{repository.fullName}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-800/60">
                      <span className="text-slate-400">Default Branch</span>
                      <span className="font-mono text-cyan-400">{repository.defaultBranch}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-800/60">
                      <span className="text-slate-400">Last Updated</span>
                      <span className="text-slate-200">
                        {repository.updatedAt
                          ? new Date(repository.updatedAt).toLocaleString()
                          : 'Unknown'}
                      </span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-slate-400">Last Pushed</span>
                      <span className="text-slate-200">
                        {repository.pushedAt
                          ? new Date(repository.pushedAt).toLocaleString()
                          : 'Unknown'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Branch Explorer Section */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">Branch Explorer</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Branches available for future automated builds and deployment environments.
                  </p>
                </div>

                {/* Branch Search Box */}
                <div className="relative max-w-xs w-full">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Search className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    value={branchSearch}
                    onChange={(e) => setBranchSearch(e.target.value)}
                    placeholder="Filter loaded branches..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Branch List */}
              {isLoadingBranches ? (
                <div className="space-y-3 py-6">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-12 rounded-xl bg-slate-950/60 animate-pulse" />
                  ))}
                </div>
              ) : branches.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                  No branches found for this repository.
                </div>
              ) : filteredBranches.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                  No branches match <strong className="text-cyan-400">"{branchSearch}"</strong>.
                </div>
              ) : (
                <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                  {filteredBranches.map((branch) => {
                    const isDefault = branch.name === repository.defaultBranch;
                    return (
                      <div
                        key={branch.name}
                        className="flex items-center justify-between p-4 hover:bg-slate-900/60 transition-colors"
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <GitBranch
                            className={`w-4 h-4 flex-shrink-0 ${
                              isDefault ? 'text-cyan-400' : 'text-slate-500'
                            }`}
                          />
                          <span className="font-mono text-xs font-semibold text-slate-200 truncate">
                            {branch.name}
                          </span>

                          {isDefault && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-medium">
                              default
                            </span>
                          )}

                          {branch.protected && (
                            <span
                              title="Protected branch"
                              className="inline-flex items-center space-x-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            >
                              <Shield className="w-3 h-3" />
                              <span>protected</span>
                            </span>
                          )}
                        </div>

                        {/* Commit SHA */}
                        {branch.sha && (
                          <span
                            title={`Latest commit: ${branch.sha}`}
                            className="font-mono text-[11px] text-slate-500 bg-slate-900 px-2 py-1 rounded border border-slate-800"
                          >
                            {branch.sha.substring(0, 7)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Branch Pagination Controls */}
              {(branchPagination.hasNextPage || branchPagination.hasPreviousPage) && (
                <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-800/60 text-xs">
                  <button
                    onClick={() => loadBranches(branchPagination.page - 1)}
                    disabled={!branchPagination.hasPreviousPage || isLoadingBranches}
                    className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Previous</span>
                  </button>

                  <span className="text-slate-400 font-mono">
                    Page {branchPagination.page}
                  </span>

                  <button
                    onClick={() => loadBranches(branchPagination.page + 1)}
                    disabled={!branchPagination.hasNextPage || isLoadingBranches}
                    className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Connect Modal */}
      <ConnectModal
        repo={repository}
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        onSuccess={(project: ProjectDto) => {
          router.push(`/projects/${project.id}`);
        }}
      />

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
