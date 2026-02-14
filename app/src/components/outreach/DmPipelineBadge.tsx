'use client';

import { cn } from '@/lib/utils';
import type { DmPipelineStage } from '@/types';

const config: Record<DmPipelineStage, { label: string; color: string; dot: string }> = {
  detected: { label: 'Detected', color: 'text-gray-600', dot: 'bg-gray-500' },
  dm_ready: { label: 'Ready', color: 'text-blue-600', dot: 'bg-blue-500' },
  draft_generated: { label: 'Drafted', color: 'text-purple-600', dot: 'bg-purple-500' },
  dm_sent: { label: 'Sent', color: 'text-green-600', dot: 'bg-green-500' },
  responded: { label: 'Responded', color: 'text-emerald-600', dot: 'bg-emerald-500' },
  converted: { label: 'Converted', color: 'text-amber-600', dot: 'bg-amber-500' },
  closed: { label: 'Closed', color: 'text-slate-600', dot: 'bg-slate-500' },
};

interface DmPipelineBadgeProps {
  stage: DmPipelineStage;
  className?: string;
}

export function DmPipelineBadge({ stage, className }: DmPipelineBadgeProps) {
  const { label, color, dot } = config[stage] || config.detected;

  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-medium', color, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />
      {label}
    </span>
  );
}
