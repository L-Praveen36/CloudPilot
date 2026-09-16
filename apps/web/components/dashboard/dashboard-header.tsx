'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Cloud, LogOut, User as UserIcon, CheckCircle2 } from 'lucide-react';
import { UserDto } from '@cloudpilot/shared';
import { ThemeToggle } from '@/components/ui/theme-toggle';

interface DashboardHeaderProps {
  user: UserDto;
  onLogout: () => Promise<void>;
  loggingOut: boolean;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  user,
  onLogout,
  loggingOut,
}) => {
  return (
    <header className="border-b border-surface-border backdrop-blur-md bg-background/80 sticky top-0 z-40 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Brand Logo & Title */}
        <div className="flex items-center space-x-3">
          <Link
            href="/dashboard"
            className="flex items-center space-x-3 group focus-ring rounded-lg p-1 -m-1"
          >
            <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-500 group-hover:border-sky-400/60 group-hover:bg-sky-500/20 transition-all">
              <Cloud className="w-5 h-5" />
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg tracking-tight text-foreground group-hover:text-sky-500 transition-colors">
                CloudPilot
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface border border-surface-border text-sky-500 font-semibold tracking-wide">
                CONSOLE
              </span>
            </div>
          </Link>
        </div>

        {/* Right: Theme Toggle, User Profile & Logout */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          {/* GitHub Connected status pill (hidden on small mobile) */}
          <div className="hidden sm:inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>GitHub Connected</span>
          </div>

          {/* Theme Toggle Button */}
          <ThemeToggle />

          {/* User Profile Pill */}
          <div className="flex items-center space-x-3 pl-2 sm:pl-3 sm:border-l sm:border-surface-border">
            {user.avatarUrl ? (
              <Image
                src={user.avatarUrl}
                alt={user.username}
                width={32}
                height={32}
                unoptimized
                className="w-8 h-8 rounded-full border border-surface-border object-cover ring-1 ring-surface-border"
              />
            ) : (
              <div className="w-8 h-8 rounded-full border border-surface-border bg-surface flex items-center justify-center text-muted-foreground">
                <UserIcon className="w-4 h-4" />
              </div>
            )}

            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-semibold text-foreground leading-tight">
                {user.name || user.username}
              </span>
              <span className="text-[11px] text-muted-foreground font-mono">
                @{user.username}
              </span>
            </div>

            {/* Logout Button */}
            <button
              onClick={onLogout}
              disabled={loggingOut}
              aria-label="Log out of CloudPilot"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-surface hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 border border-surface-border hover:border-rose-500/30 text-xs font-medium transition-all focus-ring disabled:opacity-50"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {loggingOut ? 'Logging out...' : 'Log Out'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
