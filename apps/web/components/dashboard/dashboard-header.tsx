'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Cloud, LogOut, User as UserIcon, CheckCircle2 } from 'lucide-react';
import { UserDto } from '@cloudpilot/shared';

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
    <header className="border-b border-slate-800/80 backdrop-blur-md bg-[#090d16]/80 sticky top-0 z-40 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Brand Logo & Title */}
        <div className="flex items-center space-x-3">
          <Link
            href="/dashboard"
            className="flex items-center space-x-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded-lg p-1 -m-1"
          >
            <div className="p-2 rounded-lg bg-blue-600/10 border border-blue-500/30 text-cyan-400 group-hover:border-cyan-400/60 group-hover:bg-cyan-500/15 transition-all">
              <Cloud className="w-5 h-5" />
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg tracking-tight text-white group-hover:text-cyan-200 transition-colors">
                CloudPilot
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800/90 border border-slate-700 text-cyan-400 font-semibold tracking-wide">
                CONSOLE
              </span>
            </div>
          </Link>
        </div>

        {/* Right: User Profile & Logout */}
        <div className="flex items-center space-x-3 sm:space-x-5">
          {/* GitHub Connected status pill (hidden on small mobile) */}
          <div className="hidden sm:inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>GitHub Connected</span>
          </div>

          {/* User Profile Pill */}
          <div className="flex items-center space-x-3 pl-2 sm:pl-3 sm:border-l sm:border-slate-800">
            {user.avatarUrl ? (
              <Image
                src={user.avatarUrl}
                alt={user.username}
                width={32}
                height={32}
                unoptimized
                className="w-8 h-8 rounded-full border border-slate-700 object-cover ring-1 ring-slate-800"
              />
            ) : (
              <div className="w-8 h-8 rounded-full border border-slate-700 bg-slate-800 flex items-center justify-center text-slate-400">
                <UserIcon className="w-4 h-4" />
              </div>
            )}

            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-semibold text-slate-200 leading-tight">
                {user.name || user.username}
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                @{user.username}
              </span>
            </div>

            {/* Logout Button */}
            <button
              onClick={onLogout}
              disabled={loggingOut}
              aria-label="Log out of CloudPilot"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-red-500/15 text-slate-300 hover:text-red-400 border border-slate-700/80 hover:border-red-500/40 text-xs font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50"
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
