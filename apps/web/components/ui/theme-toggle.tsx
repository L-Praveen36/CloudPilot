'use client';

import React from 'react';
import { Sun, Moon, Laptop } from 'lucide-react';
import { useTheme } from './theme-provider';

export const ThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const toggleTheme = () => {
    if (theme === 'system') {
      setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
    } else if (theme === 'dark') {
      setTheme('light');
    } else {
      setTheme('dark');
    }
  };

  return (
    <button
      onClick={toggleTheme}
      type="button"
      aria-label={`Current theme: ${theme}. Click to switch theme.`}
      title={`Current: ${theme} (resolved: ${resolvedTheme})`}
      className={`p-2 rounded-lg border border-surface-border bg-surface hover:bg-surface-hover text-muted-foreground hover:text-foreground transition-colors focus-ring ${className}`}
    >
      {resolvedTheme === 'dark' ? (
        <Sun className="w-4 h-4 text-amber-400" />
      ) : (
        <Moon className="w-4 h-4 text-sky-500" />
      )}
    </button>
  );
};
