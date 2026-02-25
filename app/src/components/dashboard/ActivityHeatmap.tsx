'use client';

import { useMemo } from 'react';
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

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LABELS: [number, string][] = [[1, 'Mon'], [3, 'Wed'], [5, 'Fri']];

function getColor(count: number, quartiles: [number, number, number, number]): string {
  if (count === 0) return 'bg-[#161b22] dark:bg-[#161b22] bg-muted/40';
  if (count <= quartiles[0]) return 'bg-orange-900/60';
  if (count <= quartiles[1]) return 'bg-orange-600/70';
  if (count <= quartiles[2]) return 'bg-orange-500/85';
  return 'bg-orange-500';
}

function computeQuartiles(activityDays: Record<string, number>): [number, number, number, number] {
  const values = Object.values(activityDays).filter((v) => v > 0).sort((a, b) => a - b);
  if (values.length === 0) return [1, 2, 3, 4];
  const q = (p: number) => values[Math.max(0, Math.ceil(values.length * p) - 1)];
  return [q(0.25), q(0.5), q(0.75), q(1)];
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

interface Cell {
  date: Date;
  dateKey: string;
  count: number;
  col: number;
  row: number;
  isFuture: boolean;
  isOutOfYear: boolean;
}

export function ActivityHeatmap({ activityDays }: ActivityHeatmapProps) {
  const quartiles = useMemo(() => computeQuartiles(activityDays), [activityDays]);

  const { cells, monthPositions, totalActivities, totalCols, year } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentYear = today.getFullYear();

    // Start from Jan 1 of the current year
    const jan1 = new Date(currentYear, 0, 1);
    // Pad back to the nearest Sunday so the grid starts on a Sunday row
    const startPad = jan1.getDay(); // 0=Sun, 1=Mon, etc.
    const gridStart = new Date(jan1);
    if (startPad !== 0) {
      gridStart.setDate(gridStart.getDate() - startPad);
    }

    // End on Dec 31 of the current year
    const dec31 = new Date(currentYear, 11, 31);
    // Pad forward to the nearest Saturday so the grid ends on a full week
    const endPad = dec31.getDay(); // 0=Sun ... 6=Sat
    const gridEnd = new Date(dec31);
    if (endPad !== 6) {
      gridEnd.setDate(gridEnd.getDate() + (6 - endPad));
    }

    const totalDays = Math.round((gridEnd.getTime() - gridStart.getTime()) / 86400000) + 1;
    const cellList: Cell[] = [];
    const months: { label: string; col: number }[] = [];
    let lastMonth = -1;
    let total = 0;

    for (let i = 0; i < totalDays; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      const col = Math.floor(i / 7);
      const row = i % 7;
      const dateKey = toDateKey(d);
      const isOutOfYear = d.getFullYear() !== currentYear;
      const isFuture = d > today;
      const count = isOutOfYear || isFuture ? 0 : (activityDays[dateKey] || 0);

      if (!isOutOfYear && !isFuture) {
        total += count;
      }

      cellList.push({ date: d, dateKey, count, col, row, isFuture, isOutOfYear });

      // Track month label positions — first occurrence of each month
      const month = d.getMonth();
      if (d.getFullYear() === currentYear && month !== lastMonth && d.getDate() <= 7) {
        months.push({ label: MONTH_LABELS[month], col });
        lastMonth = month;
      }
    }

    const numCols = cellList.length > 0 ? cellList[cellList.length - 1].col + 1 : 0;

    return {
      cells: cellList,
      monthPositions: months,
      totalActivities: total,
      totalCols: numCols,
      year: currentYear,
    };
  }, [activityDays]);

  // Size constants matching GitHub
  const CELL_SIZE = 11;
  const GAP = 3;
  const DAY_LABEL_WIDTH = 32;
  const gridWidth = totalCols * (CELL_SIZE + GAP) - GAP;

  return (
    <Card className="mx-auto w-fit gap-3 py-4">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">
            {totalActivities} {totalActivities === 1 ? 'activity' : 'activities'} in {year}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <TooltipProvider delayDuration={100}>
          <div className="overflow-x-auto">
            {/* Month labels row */}
            <div className="relative" style={{ height: 16, marginLeft: DAY_LABEL_WIDTH, width: gridWidth }}>
              {monthPositions.map(({ label, col }) => (
                <span
                  key={`${label}-${col}`}
                  className="absolute text-[11px] text-muted-foreground"
                  style={{ left: col * (CELL_SIZE + GAP) }}
                >
                  {label}
                </span>
              ))}
            </div>

            <div className="flex">
              {/* Day labels (Mon, Wed, Fri) */}
              <div className="flex flex-col" style={{ width: DAY_LABEL_WIDTH }}>
                {Array.from({ length: 7 }).map((_, i) => {
                  const entry = DAY_LABELS.find(([row]) => row === i);
                  return (
                    <div
                      key={i}
                      className="flex items-center text-[11px] text-muted-foreground"
                      style={{ height: CELL_SIZE, marginBottom: GAP }}
                    >
                      {entry ? entry[1] : ''}
                    </div>
                  );
                })}
              </div>

              {/* Contribution grid */}
              <div
                className="grid"
                style={{
                  gridTemplateRows: `repeat(7, ${CELL_SIZE}px)`,
                  gridAutoFlow: 'column',
                  gridAutoColumns: `${CELL_SIZE}px`,
                  gap: GAP,
                }}
              >
                {cells.map(({ dateKey, date, count, isFuture, isOutOfYear }) => {
                  // Out-of-year cells (padding from prev/next year) are invisible
                  if (isOutOfYear) {
                    return (
                      <div
                        key={dateKey}
                        style={{ width: CELL_SIZE, height: CELL_SIZE }}
                      />
                    );
                  }

                  // Future cells render as empty squares
                  if (isFuture) {
                    return (
                      <Tooltip key={dateKey}>
                        <TooltipTrigger asChild>
                          <div
                            className="rounded-[2px] bg-muted/30"
                            style={{ width: CELL_SIZE, height: CELL_SIZE }}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          No activities on {formatDate(date)}
                        </TooltipContent>
                      </Tooltip>
                    );
                  }

                  return (
                    <Tooltip key={dateKey}>
                      <TooltipTrigger asChild>
                        <div
                          className={`rounded-[2px] ${getColor(count, quartiles)}`}
                          style={{ width: CELL_SIZE, height: CELL_SIZE }}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        {count === 0
                          ? `No activities on ${formatDate(date)}`
                          : `${count} ${count === 1 ? 'activity' : 'activities'} on ${formatDate(date)}`}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>

            {/* Legend */}
            <div className="mt-2 flex items-center justify-end gap-1.5">
              <span className="text-[11px] text-muted-foreground">Less</span>
              <div className="rounded-[2px] bg-muted/40" style={{ width: CELL_SIZE, height: CELL_SIZE }} />
              <div className="rounded-[2px] bg-orange-900/60" style={{ width: CELL_SIZE, height: CELL_SIZE }} />
              <div className="rounded-[2px] bg-orange-600/70" style={{ width: CELL_SIZE, height: CELL_SIZE }} />
              <div className="rounded-[2px] bg-orange-500/85" style={{ width: CELL_SIZE, height: CELL_SIZE }} />
              <div className="rounded-[2px] bg-orange-500" style={{ width: CELL_SIZE, height: CELL_SIZE }} />
              <span className="text-[11px] text-muted-foreground">More</span>
            </div>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
