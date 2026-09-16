'use client';

import React, { useState, useMemo } from 'react';
import { DetailDrawer } from '@/components/ui/detail-drawer';
import { CopyButton } from '@/components/ui/copy-button';
import { Search, FolderGit2, FileText, FileCode, Settings, FileCheck } from 'lucide-react';

interface FilesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  detectedFiles: string[];
}

export const FilesDrawer: React.FC<FilesDrawerProps> = ({
  isOpen,
  onClose,
  detectedFiles = [],
}) => {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'MANIFEST' | 'CONFIG' | 'SOURCE' | 'DOCS'>('ALL');

  const categorizedFiles = useMemo(() => {
    return detectedFiles.map((f) => {
      const lower = f.toLowerCase();
      let category: 'MANIFEST' | 'CONFIG' | 'SOURCE' | 'DOCS' = 'SOURCE';

      if (lower.includes('package.json') || lower.includes('requirements.txt') || lower.includes('pom.xml') || lower.includes('go.mod')) {
        category = 'MANIFEST';
      } else if (lower.includes('.env') || lower.includes('config') || lower.includes('dockerfile') || lower.includes('tsconfig')) {
        category = 'CONFIG';
      } else if (lower.includes('readme') || lower.includes('.md') || lower.includes('license')) {
        category = 'DOCS';
      }

      return { path: f, category };
    });
  }, [detectedFiles]);

  const filteredFiles = useMemo(() => {
    return categorizedFiles.filter(({ path, category }) => {
      const matchesSearch = path.toLowerCase().includes(search.toLowerCase().trim());
      const matchesCategory = filterType === 'ALL' || category === filterType;
      return matchesSearch && matchesCategory;
    });
  }, [categorizedFiles, search, filterType]);

  const formatCopyList = () => {
    return [
      `CloudPilot Detected Files (${detectedFiles.length} files)`,
      '====================================',
      ...detectedFiles.map((f) => `- ${f}`),
    ].join('\n');
  };

  const getFileIcon = (category: string) => {
    switch (category) {
      case 'MANIFEST':
        return <FileCheck className="w-3.5 h-3.5 text-emerald-500" />;
      case 'CONFIG':
        return <Settings className="w-3.5 h-3.5 text-amber-500" />;
      case 'DOCS':
        return <FileText className="w-3.5 h-3.5 text-sky-500" />;
      default:
        return <FileCode className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  return (
    <DetailDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Detected Repository Files"
      subtitle={`${detectedFiles.length} files mapped during static analysis`}
      icon={<FolderGit2 className="w-5 h-5 text-sky-500" />}
      width="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <CopyButton
            textToCopy={formatCopyList}
            label="Copy File List"
            variant="outline"
          />
          <span className="text-xs text-muted-foreground">
            Showing {filteredFiles.length} of {detectedFiles.length} files
          </span>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files by path or name..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-surface-border bg-surface text-foreground text-xs placeholder:text-muted-foreground focus-ring"
          />
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-1.5 pb-1">
          {(['ALL', 'MANIFEST', 'CONFIG', 'SOURCE', 'DOCS'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFilterType(cat)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                filterType === cat
                  ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30'
                  : 'bg-surface text-muted-foreground border border-surface-border hover:text-foreground'
              }`}
            >
              {cat === 'ALL' ? 'All Files' : cat.charAt(0) + cat.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Files List */}
        <div className="rounded-xl border border-surface-border bg-surface/30 divide-y divide-surface-border max-h-[60vh] overflow-y-auto">
          {filteredFiles.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No files matching your query
            </div>
          ) : (
            filteredFiles.map(({ path, category }) => (
              <div
                key={path}
                className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-surface/60 transition-colors group"
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  {getFileIcon(category)}
                  <span className="font-mono text-foreground truncate text-[11px]">
                    {path}
                  </span>
                </div>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-surface border border-surface-border text-muted-foreground flex-shrink-0">
                  {category}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </DetailDrawer>
  );
};
