'use client';

import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Loader2,
  Play,
  Square,
  ShieldCheck,
  Radio,
} from 'lucide-react';

export type StatusVariant =
  | 'READY'
  | 'READY_WITH_WARNINGS'
  | 'BLOCKED'
  | 'HEALTHY'
  | 'UNHEALTHY'
  | 'RUNNING'
  | 'STARTING'
  | 'BUILDING'
  | 'PENDING'
  | 'STOPPED'
  | 'FAILED'
  | 'CANCELLED'
  | 'CONNECTED'
  | 'UNKNOWN';

interface StatusBadgeProps {
  status: string;
  label?: string;
  size?: 'sm' | 'md';
  pulse?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'sm',
  pulse = false,
  className = '',
}) => {
  const normalized = (status || '').toUpperCase().trim();
  const displayLabel = label || status;

  let colorClasses = 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  let IconComponent = Clock;

  switch (normalized) {
    case 'READY':
    case 'HEALTHY':
    case 'RUNNING':
    case 'CONNECTED':
    case 'PROCESSED':
      colorClasses = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
      IconComponent = CheckCircle2;
      break;

    case 'READY_WITH_WARNINGS':
    case 'WARNING':
    case 'IGNORED':
      colorClasses = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
      IconComponent = AlertTriangle;
      break;

    case 'BLOCKED':
    case 'UNHEALTHY':
    case 'FAILED':
    case 'ERROR':
      colorClasses = 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30';
      IconComponent = XCircle;
      break;

    case 'BUILDING':
    case 'STARTING':
    case 'HEALTH_CHECKING':
    case 'VALIDATING':
      colorClasses = 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30';
      IconComponent = Loader2;
      break;

    case 'STOPPED':
    case 'CANCELLED':
      colorClasses = 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30';
      IconComponent = Square;
      break;

    case 'PENDING':
    default:
      colorClasses = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30';
      IconComponent = Clock;
      break;
  }

  const isAnimated = pulse || normalized === 'BUILDING' || normalized === 'STARTING' || normalized === 'HEALTH_CHECKING' || normalized === 'VALIDATING';
  const sizeClasses = size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-xs font-semibold';
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium tracking-tight ${sizeClasses} ${colorClasses} ${className}`}
    >
      <IconComponent className={`${iconSize} ${isAnimated ? 'animate-spin' : ''}`} />
      <span>{displayLabel}</span>
    </span>
  );
};
