'use client';

import { Maximize2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface KanbanColumnProps {
  title: string;
  count: number;
  colorClass: string;
  borderColor: string;
  onExpandColumn: () => void;
  emptyMessage: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}

export function KanbanColumn({
  title,
  count,
  colorClass,
  borderColor,
  onExpandColumn,
  emptyMessage,
  headerAction,
  children,
}: KanbanColumnProps) {
  return (
    <div className="rounded-xl border bg-muted/30 flex flex-col min-w-0 min-h-[500px] overflow-hidden">
      {/* Column header */}
      <button
        onClick={onExpandColumn}
        className="flex items-center justify-between px-3 py-3 border-b-2 group cursor-pointer hover:bg-muted/50 transition-colors"
        style={{ borderBottomColor: borderColor }}
      >
        <span className={cn('text-xs font-bold uppercase tracking-wider', colorClass)}>
          {title}
        </span>
        <div className="flex items-center gap-1.5">
          <Badge variant="secondary" className="text-[10px] px-2 py-0 font-semibold">
            {count}
          </Badge>
          <Maximize2 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </button>

      {/* Optional header action (e.g. Start Sending / Follow Up button) */}
      {headerAction && (
        <div className="px-3 pt-2">{headerAction}</div>
      )}

      {/* Cards area — plain scrollable div, no Radix ScrollArea */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3">
        {count === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <p className="text-xs text-muted-foreground">{emptyMessage}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">{children}</div>
        )}
      </div>
    </div>
  );
}
