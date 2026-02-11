'use client';

import { useMemo } from 'react';
import { Flame } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ActivityHeatmapProps {
  /** Map of ISO date string (YYYY-MM-DD) → activity count */
  activityDays: Record<string, number>;
}

const WEEKS = 52;
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getColor(count: number): string {
  if (count === 0) return 'bg-muted/50';
  if (count <= 2) return 'bg-orange-500/30';
  if (count <= 5) return 'bg-orange-500/50';
  if (count <= 10) return 'bg-orange-500/75';
  return 'bg-orange-500';
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function ActivityHeatmap({ activityDays }: ActivityHeatmapProps) {
  const { cells, monthLabels, streak } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find the start: go back WEEKS * 7 days, then align to Sunday
    const start = new Date(today);
    start.setDate(start.getDate() - (WEEKS * 7 - 1) - today.getDay());

    // Build cells
    const totalDays = WEEKS * 7;
    const cellList: { date: Date; dateKey: string; count: number; col: number; row: number }[] = [];
    const monthSet = new Map<string, number>(); // month label → column index

    for (let i = 0; i < totalDays; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const col = Math.floor(i / 7);
      const row = i % 7;
      const dateKey = toDateKey(d);
      const count = activityDays[dateKey] || 0;

      cellList.push({ date: d, dateKey, count, col, row });

      // Track month labels (first occurrence of each month)
      if (row === 0) {
        const monthKey = d.toLocaleDateString('en-US', { month: 'short' });
        if (!monthSet.has(monthKey)) {
          monthSet.set(monthKey, col);
        }
      }
    }

    // Calculate streak: walk backward from today (skip today if 0)
    let streakCount = 0;
    const todayKey = toDateKey(today);
    const startOffset = (activityDays[todayKey] || 0) === 0 ? 1 : 0;

    for (let i = startOffset; i < totalDays; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = toDateKey(d);
      if ((activityDays[key] || 0) > 0) {
        streakCount++;
      } else {
        break;
      }
    }

    return {
      cells: cellList,
      monthLabels: Array.from(monthSet.entries()),
      streak: streakCount,
    };
  }, [activityDays]);

  const streakMessage =
    streak === 0
      ? 'Start your streak today!'
      : streak === 1
        ? 'Keep it going tomorrow!'
        : `Keep the momentum going!`;

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Activity</CardTitle>
          <div className="flex items-center gap-2 text-sm">
            <Flame className="h-4 w-4 text-orange-500" />
            <span className="font-semibold">{streak}-day streak</span>
            <span className="text-muted-foreground">— {streakMessage}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="overflow-x-auto">
            {/* Month labels */}
            <div className="relative mb-1" style={{ paddingLeft: 32, height: 14 }}>
              {monthLabels.map(([label, col]) => (
                <span
                  key={`${label}-${col}`}
                  className="absolute text-[10px] text-muted-foreground"
                  style={{ left: 32 + col * 16 }}
                >
                  {label}
                </span>
              ))}
            </div>

            <div className="flex gap-[3px]">
              {/* Day labels */}
              <div className="flex flex-col gap-[3px] pr-1" style={{ width: 28 }}>
                {DAY_LABELS.map((label, i) => (
                  <div
                    key={label}
                    className="flex h-[13px] items-center text-[10px] text-muted-foreground"
                  >
                    {i % 2 === 1 ? label : ''}
                  </div>
                ))}
              </div>

              {/* Grid */}
              <div
                className="grid flex-1 gap-[3px]"
                style={{
                  gridTemplateRows: 'repeat(7, 13px)',
                  gridAutoFlow: 'column',
                  gridAutoColumns: '1fr',
                }}
              >
                {cells.map(({ dateKey, date, count }) => (
                  <Tooltip key={dateKey}>
                    <TooltipTrigger asChild>
                      <div
                        className={`h-[13px] rounded-[2px] ${getColor(count)}`}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      {count} {count === 1 ? 'activity' : 'activities'} on{' '}
                      {formatDate(date)}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="mt-2 flex items-center justify-end gap-1.5">
              <span className="text-[10px] text-muted-foreground">Less</span>
              <div className="h-[13px] w-[13px] rounded-[2px] bg-muted/50" />
              <div className="h-[13px] w-[13px] rounded-[2px] bg-orange-500/30" />
              <div className="h-[13px] w-[13px] rounded-[2px] bg-orange-500/50" />
              <div className="h-[13px] w-[13px] rounded-[2px] bg-orange-500/75" />
              <div className="h-[13px] w-[13px] rounded-[2px] bg-orange-500" />
              <span className="text-[10px] text-muted-foreground">More</span>
            </div>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
