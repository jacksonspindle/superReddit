'use client';

import { useMemo } from 'react';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { OutreachKeyword, AlertDelivery } from '@/types';

interface KeywordCardsProps {
  keywords: OutreachKeyword[];
  deliveries: AlertDelivery[];
  activeKeyword: string | null; // null = "All"
  onSelect: (keyword: string | null) => void;
  onManageOpen: () => void;
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function KeywordCards({
  keywords,
  deliveries,
  activeKeyword,
  onSelect,
  onManageOpen,
}: KeywordCardsProps) {
  const stats = useMemo(() => {
    // Build per-keyword catch counts
    const counts: Record<string, { total: number; today: number }> = {};
    let totalAll = 0;
    let todayAll = 0;

    for (const d of deliveries) {
      const matched = d.signal?.matched_keywords || [];
      const today = isToday(d.created_at);
      totalAll++;
      if (today) todayAll++;

      for (const kw of matched) {
        const lower = kw.toLowerCase();
        if (!counts[lower]) counts[lower] = { total: 0, today: 0 };
        counts[lower].total++;
        if (today) counts[lower].today++;
      }
    }

    // Map keywords to stats
    const keywordStats = keywords.map((k) => {
      const phrases = k.phrases.map((p) => p.toLowerCase());
      let total = 0;
      let today = 0;
      for (const p of phrases) {
        total += counts[p]?.total || 0;
        today += counts[p]?.today || 0;
      }
      return { keyword: k, total, today, label: k.phrases.join(', ') };
    });

    const maxCatches = Math.max(1, ...keywordStats.map((s) => s.total));

    return { keywordStats, totalAll, todayAll, maxCatches };
  }, [keywords, deliveries]);

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {/* All keywords card */}
      <button
        onClick={() => onSelect(null)}
        className={`shrink-0 rounded-lg border px-4 py-2.5 text-left transition-all ${
          activeKeyword === null
            ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
            : 'border-border hover:bg-muted/50'
        }`}
      >
        <p className="text-[11px] text-muted-foreground font-medium">All keywords</p>
        <p className="text-lg font-bold tabular-nums">{stats.totalAll}</p>
        {stats.todayAll > 0 && (
          <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">
            +{stats.todayAll} today
          </span>
        )}
      </button>

      {/* Per-keyword cards */}
      {stats.keywordStats.map((s) => {
        const isActive = activeKeyword === s.keyword.id;
        const barWidth = (s.total / stats.maxCatches) * 100;

        return (
          <button
            key={s.keyword.id}
            onClick={() => onSelect(s.keyword.id)}
            className={`shrink-0 rounded-lg border px-4 py-2.5 text-left transition-all min-w-[120px] ${
              isActive
                ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                : 'border-border hover:bg-muted/50'
            } ${!s.keyword.is_active ? 'opacity-50' : ''}`}
          >
            <p className="text-[11px] text-muted-foreground font-medium truncate max-w-[140px]">
              {s.label}
            </p>
            <p className="text-lg font-bold tabular-nums">{s.total}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {s.today > 0 && (
                <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">
                  +{s.today} today
                </span>
              )}
              <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary/60 rounded-full transition-all"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          </button>
        );
      })}

      {/* Manage button */}
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 h-auto py-3 px-3 gap-1.5"
        onClick={onManageOpen}
      >
        <Settings className="h-3.5 w-3.5" />
        <span className="text-xs">Manage</span>
      </Button>
    </div>
  );
}
