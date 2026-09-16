'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyButtonProps {
  textToCopy: string | (() => string);
  label?: string;
  successLabel?: string;
  className?: string;
  iconOnly?: boolean;
  variant?: 'subtle' | 'outline' | 'ghost';
  size?: 'sm' | 'md';
}

export const CopyButton: React.FC<CopyButtonProps> = ({
  textToCopy,
  label = 'Copy',
  successLabel = 'Copied!',
  className = '',
  iconOnly = false,
  variant = 'outline',
  size = 'sm',
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const text = typeof textToCopy === 'function' ? textToCopy() : textToCopy;
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      try {
        const text = typeof textToCopy === 'function' ? textToCopy() : textToCopy;
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {}
    }
  };

  const baseStyles = 'inline-flex items-center justify-center font-medium transition-all focus-ring rounded-lg';
  const sizeStyles = size === 'sm' ? (iconOnly ? 'p-1.5' : 'px-2.5 py-1 text-xs space-x-1.5') : (iconOnly ? 'p-2' : 'px-3 py-1.5 text-xs space-x-2');

  const variantStyles = {
    outline: 'border border-surface-border bg-surface hover:bg-surface-hover text-foreground hover:border-slate-400 dark:hover:border-slate-600',
    subtle: 'bg-surface-hover hover:bg-surface-active text-muted-foreground hover:text-foreground',
    ghost: 'hover:bg-surface-hover text-muted-foreground hover:text-foreground',
  }[variant];

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? successLabel : label}
      title={copied ? successLabel : label}
      className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
    >
      {copied ? (
        <Check className={`${size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-emerald-500`} />
      ) : (
        <Copy className={`${size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
      )}
      {!iconOnly && <span>{copied ? successLabel : label}</span>}
    </button>
  );
};
