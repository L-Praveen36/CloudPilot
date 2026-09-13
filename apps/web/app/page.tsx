import React from 'react';
import { Activity, Cloud, Database, Layers, Terminal } from 'lucide-react';

export default function HomePage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  return (
    <main className="min-h-screen flex flex-col justify-between bg-[#090d16] text-slate-100 relative overflow-hidden">
      {/* Background ambient gradient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-blue-600/20 via-cyan-500/10 to-transparent blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="border-b border-slate-800/80 backdrop-blur-md bg-[#090d16]/70 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-blue-600/10 border border-blue-500/30 text-cyan-400">
              <Cloud className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg tracking-tight text-white">CloudPilot</span>
          </div>

          <div className="flex items-center space-x-4">
            <a
              href={`${apiUrl}/auth/github`}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium border border-slate-700 transition-all duration-150"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <span>Sign In</span>
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20 relative z-10 max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-slate-700/60 bg-slate-900/60 text-slate-300 text-xs font-mono mb-8 backdrop-blur-sm">
          <Terminal className="w-3.5 h-3.5 text-cyan-400" />
          <span>v0.2.1 &bull; GitHub OAuth Ready</span>
        </div>

        <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight text-white mb-6">
          CloudPilot
        </h1>

        <p className="text-xl sm:text-2xl font-medium text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-400 max-w-3xl mb-10">
          AI-Powered Cloud Deployment & Observability Platform
        </p>

        <p className="text-slate-400 text-base sm:text-lg max-w-2xl leading-relaxed mb-10">
          A high-performance platform engineered for seamless multi-cloud orchestration, intelligent workload optimization, and real-time observability.
        </p>

        {/* Primary CTA Button */}
        <div className="mb-14">
          <a
            href={`${apiUrl}/auth/github`}
            className="inline-flex items-center space-x-3 px-8 py-4 rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-semibold text-base shadow-lg shadow-white/10 hover:shadow-white/20 transition-all duration-200 group"
          >
            <svg className="w-5 h-5 fill-slate-950 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            <span>Continue with GitHub</span>
          </a>
        </div>

        {/* Foundation Architecture Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl text-left">
          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 w-fit mb-3">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-white text-sm mb-1">Enterprise Auth</h3>
            <p className="text-xs text-slate-400">OAuth2 with single-use CSRF tokens &amp; AES-256-GCM token encryption.</p>
          </div>

          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 w-fit mb-3">
              <Database className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-white text-sm mb-1">Persistent Sessions</h3>
            <p className="text-xs text-slate-400">Server-side session management via secure HTTP-only cookies.</p>
          </div>

          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 w-fit mb-3">
              <Activity className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-white text-sm mb-1">Service Health</h3>
            <p className="text-xs text-slate-400">Active PostgreSQL and Redis health probes.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 px-6 text-center text-xs text-slate-500 bg-[#090d16]/80">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>&copy; {new Date().getFullYear()} CloudPilot Platform. Phase 2.1 Authentication.</span>
          <div className="flex items-center space-x-6 text-slate-400">
            <span>Next.js 15</span>
            <span>&bull;</span>
            <span>NestJS 11</span>
            <span>&bull;</span>
            <span>Prisma</span>
            <span>&bull;</span>
            <span>PostgreSQL</span>
            <span>&bull;</span>
            <span>Redis</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
