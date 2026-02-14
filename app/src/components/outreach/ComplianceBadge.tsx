'use client';

import { cn } from '@/lib/utils';
import type { SafetyLevel } from '@/lib/outreach/compliance';

const config: Record<SafetyLevel, { label: string; color: string; dot: string }> = {
  safe: { label: 'Safe', color: 'text-green-600', dot: 'bg-green-500' },
  caution: { label: 'Caution', color: 'text-yellow-600', dot: 'bg-yellow-500' },
  strict: { label: 'Strict', color: 'text-red-600', dot: 'bg-red-500' },
};

interface ComplianceBadgeProps {
  level: SafetyLevel;
  className?: string;
}

export function ComplianceBadge({ level, className }: ComplianceBadgeProps) {
  const { label, color, dot } = config[level];

  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-medium', color, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />
      {label}
    </span>
  );
}
