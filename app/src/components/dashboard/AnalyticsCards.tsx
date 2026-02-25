'use client';

import { useMemo } from 'react';

interface Metric {
  label: string;
  total: number;
  /** Daily counts for the last 30 days, oldest first */
  sparkline: number[];
  color: string;
}

interface AnalyticsCardsProps {
  postsPublished: { total: number; daily: number[] };
  totalLeads: { total: number; daily: number[] };
  dmsSent: { total: number; daily: number[] };
  opportunitiesFound: { total: number; daily: number[] };
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const { points, max } = useMemo(() => {
    const m = Math.max(...data, 1);
    const h = 32;
    const w = 200;
    const step = w / (data.length - 1 || 1);
    const pts = data
      .map((v, i) => `${i * step},${h - (v / m) * (h - 4) - 2}`)
      .join(' ');
    return { points: pts, max: m };
  }, [data]);

  return (
    <svg
      viewBox="0 0 200 32"
      preserveAspectRatio="none"
      className="h-8 w-full"
    >
      {max > 0 && (
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {/* Flat line when no data */}
      {max <= 0 && (
        <line
          x1="0" y1="30" x2="200" y2="30"
          stroke={color}
          strokeWidth="2.5"
          strokeOpacity="0.3"
        />
      )}
    </svg>
  );
}

export function AnalyticsCards({
  postsPublished,
  totalLeads,
  dmsSent,
  opportunitiesFound,
}: AnalyticsCardsProps) {
  const metrics: Metric[] = [
    { label: 'POSTS PUBLISHED', total: postsPublished.total, sparkline: postsPublished.daily, color: '#22c55e' },
    { label: 'TOTAL LEADS', total: totalLeads.total, sparkline: totalLeads.daily, color: '#a855f7' },
    { label: 'DMS SENT', total: dmsSent.total, sparkline: dmsSent.daily, color: '#3b82f6' },
    { label: 'OPPORTUNITIES FOUND', total: opportunitiesFound.total, sparkline: opportunitiesFound.daily, color: '#f97316' },
  ];

  return (
    <div className="grid h-full grid-cols-2 gap-3">
      {metrics.map((m) => (
        <div
          key={m.label}
          className="flex flex-col justify-between rounded-xl border bg-card px-4 pt-3 pb-0 overflow-hidden"
        >
          <div>
            <p className="text-[11px] font-medium tracking-wider text-muted-foreground">
              {m.label}
            </p>
            <p className="text-2xl font-bold">{m.total}</p>
          </div>
          <div className="-mx-4 mt-auto">
            <Sparkline data={m.sparkline} color={m.color} />
          </div>
        </div>
      ))}
    </div>
  );
}
