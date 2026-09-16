'use client';

import React, { useState } from 'react';
import {
  ApplicationStructureDto,
  DetectedApplication,
  ApplicationRelationship,
} from '@cloudpilot/shared';
import { ApplicationDetailModal } from '../modals/application-detail-modal';
import { CopyButton } from '@/components/ui/copy-button';
import {
  Boxes,
  ArrowRight,
  ArrowDown,
  Server,
  Monitor,
  Code2,
  Terminal,
  ExternalLink,
  Zap,
} from 'lucide-react';

interface ApplicationsTabProps {
  structure: ApplicationStructureDto | null;
  onReanalyzeStructure?: () => void;
  isAnalyzing?: boolean;
}

export const ApplicationsTab: React.FC<ApplicationsTabProps> = ({
  structure,
  onReanalyzeStructure,
  isAnalyzing = false,
}) => {
  const [selectedApp, setSelectedApp] = useState<DetectedApplication | null>(null);

  const apps = structure?.applications || [];
  const relationships = structure?.relationships || [];

  const clientApp = apps.find((a) => a.role === 'FRONTEND') || apps[0];
  const serverApp = apps.find((a) => a.role === 'BACKEND') || (apps.length > 1 ? apps[1] : null);

  const formatCopyArchitecture = () => {
    const list = apps.map((a) => {
      return [
        `Application: ${a.name} (${a.role})`,
        `  Framework: ${a.framework || 'None / Standard'}`,
        `  Language: ${a.language || 'JavaScript'}`,
        `  Path: ${a.path}`,
        `  Port: ${a.port?.port || 'N/A'}`,
        `  Entry Point: ${a.entryPoint?.path || 'N/A'}`,
        `  Build Command: ${a.buildCommand?.command || 'N/A'}`,
        `  Start Command: ${a.startCommand?.command || 'N/A'}`,
      ].join('\n');
    }).join('\n\n');

    const rels = relationships.map((r) => `- ${r.source} ──[${r.relationshipType}]──> ${r.target}`).join('\n');

    return [
      `CloudPilot Application Architecture: ${structure?.primaryRole || 'FULLSTACK'}`,
      '====================================================',
      `Total Applications Detected: ${apps.length}`,
      '',
      list,
      '',
      relationships.length > 0 ? `Detected Service Relationships:\n${rels}` : '',
    ].join('\n');
  };

  return (
    <div className="space-y-6">
      {/* Tab Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-surface-border">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-semibold text-foreground tracking-tight">
              Application Architecture
            </h2>
            <span className="text-[11px] font-mono text-muted-foreground px-2 py-0.5 rounded-full bg-surface border border-surface-border">
              {structure?.primaryRole || 'FULLSTACK'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Auto-detected sub-applications, frameworks, entrypoints, and internal communication topology.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <CopyButton
            textToCopy={formatCopyArchitecture}
            label="Copy Architecture"
            variant="outline"
          />
        </div>
      </div>

      {/* Visual Architecture Topology Diagram */}
      {apps.length > 1 && clientApp && serverApp ? (
        <div className="rounded-xl border border-surface-border bg-card p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Service Interaction Diagram
            </span>
            <span className="text-[11px] text-muted-foreground font-mono">
              Topology: Monorepo Microservices
            </span>
          </div>

          <div className="py-6 flex flex-col md:flex-row items-center justify-center gap-4 sm:gap-8 max-w-2xl mx-auto">
            {/* Frontend / Client Node */}
            <div
              onClick={() => setSelectedApp(clientApp)}
              className="w-full md:w-56 p-4 rounded-xl border border-sky-500/30 bg-sky-500/5 hover:bg-sky-500/10 cursor-pointer transition-all shadow-xs hover:shadow text-center space-y-1.5 focus-ring"
            >
              <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-600 dark:text-sky-400 mx-auto flex items-center justify-center mb-1">
                <Monitor className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold uppercase font-mono text-foreground">
                {clientApp.name}
              </h4>
              <p className="text-[11px] text-sky-600 dark:text-sky-400 font-medium">
                {clientApp.framework || 'React'} • Port {clientApp.port?.port || 3000}
              </p>
              <span className="text-[10px] text-muted-foreground block font-mono">
                {clientApp.path}
              </span>
            </div>

            {/* Connection Arrow with PROXY pill */}
            <div className="flex flex-col items-center justify-center text-muted-foreground py-2 md:py-0">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface border border-surface-border uppercase tracking-wider text-muted-foreground mb-1 shadow-2xs">
                {relationships[0]?.relationshipType || 'PROXY'}
              </span>
              <div className="hidden md:flex items-center space-x-1 text-sky-500">
                <div className="w-8 h-0.5 bg-gradient-to-r from-sky-500 to-indigo-500" />
                <ArrowRight className="w-4 h-4" />
              </div>
              <div className="flex md:hidden flex-col items-center text-sky-500">
                <div className="h-6 w-0.5 bg-gradient-to-b from-sky-500 to-indigo-500" />
                <ArrowDown className="w-4 h-4" />
              </div>
            </div>

            {/* Backend / Server Node */}
            <div
              onClick={() => setSelectedApp(serverApp)}
              className="w-full md:w-56 p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/5 hover:bg-indigo-500/10 cursor-pointer transition-all shadow-xs hover:shadow text-center space-y-1.5 focus-ring"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center mb-1">
                <Server className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold uppercase font-mono text-foreground">
                {serverApp.name}
              </h4>
              <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                {serverApp.framework || 'Express'} • Port {serverApp.port?.port || 5000}
              </p>
              <span className="text-[10px] text-muted-foreground block font-mono">
                {serverApp.path}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Applications Cards Grid */}
      <div>
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">
          Detected Application Services ({apps.length})
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {apps.map((app) => (
            <div
              key={app.name}
              className="rounded-xl border border-surface-border bg-card p-5 space-y-4 hover:border-slate-400 dark:hover:border-slate-600 transition-colors flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 rounded-lg bg-accent text-accent-foreground border border-surface-border font-mono">
                      {app.role === 'FRONTEND' ? (
                        <Monitor className="w-4 h-4 text-sky-500" />
                      ) : (
                        <Server className="w-4 h-4 text-indigo-500" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground font-mono uppercase">
                        {app.name}
                      </h4>
                      <span className="text-[11px] text-muted-foreground">
                        {app.role} • {app.language || 'JavaScript'}
                      </span>
                    </div>
                  </div>

                  <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-surface border border-surface-border text-foreground">
                    Port: {app.port?.port ? `${app.port.port}` : 'None'}
                  </span>
                </div>

                {/* Key Attributes List */}
                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="p-2 rounded-lg bg-surface/60 border border-surface-border">
                    <span className="text-[10px] text-muted-foreground uppercase block">Framework</span>
                    <span className="font-semibold text-foreground text-[11px]">{app.framework || 'None / Standard'}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-surface/60 border border-surface-border">
                    <span className="text-[10px] text-muted-foreground uppercase block">Path</span>
                    <span className="font-mono text-foreground text-[11px] truncate block">{app.path}</span>
                  </div>
                </div>

                {app.startCommand?.command && (
                  <div className="p-2.5 rounded-lg bg-code text-[11px] font-mono border border-surface-border flex items-center justify-between">
                    <span className="text-muted-foreground truncate">
                      $ {app.startCommand.command}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-sans">
                      Start
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setSelectedApp(app)}
                  className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1 focus-ring rounded"
                >
                  <span>View full details</span>
                  <ExternalLink className="w-3 h-3" />
                </button>

                <CopyButton
                  textToCopy={() => `Application: ${app.name}\nRole: ${app.role}\nPath: ${app.path}\nPort: ${app.port?.port || 'N/A'}\nStart: ${app.startCommand?.command || 'N/A'}`}
                  label="Copy"
                  size="sm"
                  variant="ghost"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Application Detail Modal */}
      <ApplicationDetailModal
        app={selectedApp}
        isOpen={Boolean(selectedApp)}
        onClose={() => setSelectedApp(null)}
      />
    </div>
  );
};
