'use client';

import React from 'react';
import {
  Cloud,
  Terminal,
  Boxes,
  ShieldCheck,
  Rocket,
  Activity,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Lock,
  Server,
  Zap,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';

export default function HomePage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  return (
    <main className="min-h-screen flex flex-col justify-between bg-background text-foreground relative overflow-hidden transition-colors">
      {/* Background ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[360px] bg-gradient-to-b from-sky-500/15 via-indigo-500/10 to-transparent blur-3xl pointer-events-none" />

      {/* Navigation Header */}
      <header className="border-b border-surface-border backdrop-blur-md bg-background/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-500">
              <Cloud className="w-5 h-5" />
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg tracking-tight text-foreground">CloudPilot</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface border border-surface-border text-sky-500 font-semibold tracking-wide">
                v2.1
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <ThemeToggle />

            <a
              href={`${apiUrl}/auth/github`}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-xs hover:shadow transition-all focus-ring"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <span>Sign In with GitHub</span>
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-4 sm:px-6 py-16 relative z-10 max-w-5xl mx-auto space-y-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-surface-border bg-surface/60 text-muted-foreground text-xs font-mono backdrop-blur-sm">
          <Terminal className="w-3.5 h-3.5 text-sky-500" />
          <span>Autonomous Containerization & Cloud Deployment</span>
        </div>

        <div className="space-y-4 max-w-3xl">
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-foreground">
            From Git repository to isolated production container in seconds.
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
            CloudPilot inspects your source code, maps multi-application microservices, automatically generates optimal multi-stage container pipelines, and provides live telemetry and autonomous AI diagnosis.
          </p>
        </div>

        {/* Primary Call to Action */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <a
            href={`${apiUrl}/auth/github`}
            className="inline-flex items-center space-x-2.5 px-6 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all focus-ring group"
          >
            <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            <span>Connect GitHub Account</span>
            <ArrowRight className="w-4 h-4 text-white/80 group-hover:translate-x-0.5 transition-transform" />
          </a>
        </div>

        {/* 4 Pillars Architecture */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full text-left pt-6">
          <div className="p-4 rounded-xl border border-surface-border bg-card/60 backdrop-blur-sm space-y-2">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-500 w-fit">
              <Boxes className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
              1. Static Intelligence
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Detects monorepo workspaces, frameworks, entrypoints, ports, and environment variable requirements directly from source.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-surface-border bg-card/60 backdrop-blur-sm space-y-2">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500 w-fit">
              <Rocket className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
              2. Auto Containerization
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Synthesizes optimized multi-stage Dockerfiles for fullstack React/Express, Node, Python, and multi-service stacks.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-surface-border bg-card/60 backdrop-blur-sm space-y-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 w-fit">
              <Activity className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
              3. Live Observability
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Continuous sampling of container CPU utilization, memory allocation, network I/O, and automated HTTP health probes.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-surface-border bg-card/60 backdrop-blur-sm space-y-2">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500 w-fit">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
              4. AI Diagnostics
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Autonomous failure root-cause analysis, actionable code remediation diffs, and 1-click suggested repair workflows.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-surface-border py-4 px-6 text-center text-xs text-muted-foreground bg-card/40">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>&copy; {new Date().getFullYear()} CloudPilot Platform • Autonomous Cloud Orchestration</span>
          <div className="flex items-center space-x-4 text-[11px] text-muted-foreground font-mono">
            <span>Next.js 15</span>
            <span>•</span>
            <span>NestJS 11</span>
            <span>•</span>
            <span>Prisma</span>
            <span>•</span>
            <span>Docker</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
