'use client';

import { useState, useMemo } from 'react';
import { Plus, X, TrendingUp } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { OutreachKeyword, AlertDelivery } from '@/types';

interface ManageKeywordsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keywords: OutreachKeyword[];
  deliveries: AlertDelivery[];
  onAdd: (phrases: string[]) => void;
  onRemove: (id: string) => void;
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

export function ManageKeywordsDialog({
  open,
  onOpenChange,
  keywords,
  deliveries,
  onAdd,
  onRemove,
}: ManageKeywordsDialogProps) {
  const [input, setInput] = useState('');

  const rankedKeywords = useMemo(() => {
    // Build per-keyword catch counts
    const counts: Record<string, { total: number; today: number }> = {};

    for (const d of deliveries) {
      const matched = d.signal?.matched_keywords || [];
      const today = isToday(d.created_at);
      for (const kw of matched) {
        const lower = kw.toLowerCase();
        if (!counts[lower]) counts[lower] = { total: 0, today: 0 };
        counts[lower].total++;
        if (today) counts[lower].today++;
      }
    }

    const withStats = keywords.map((k) => {
      const phrases = k.phrases.map((p) => p.toLowerCase());
      let total = 0;
      let today = 0;
      for (const p of phrases) {
        total += counts[p]?.total || 0;
        today += counts[p]?.today || 0;
      }
      return { keyword: k, total, today };
    });

    // Sort by total catches descending
    withStats.sort((a, b) => b.total - a.total);

    const max = Math.max(1, ...withStats.map((s) => s.total));
    return { items: withStats, max };
  }, [keywords, deliveries]);

  function handleAdd() {
    const phrases = input
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (phrases.length === 0) return;
    onAdd(phrases);
    setInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Keywords</DialogTitle>
        </DialogHeader>

        <div className="space-y-1 max-h-[50vh] overflow-y-auto">
          {rankedKeywords.items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No keywords yet. Add one below to start monitoring.
            </p>
          ) : (
            rankedKeywords.items.map((s, i) => {
              const barWidth = (s.total / rankedKeywords.max) * 100;
              return (
                <div
                  key={s.keyword.id}
                  className="group flex items-center gap-3 rounded-lg border px-3 py-2 text-sm hover:bg-muted/30 transition-colors"
                >
                  <span className="text-xs text-muted-foreground font-mono w-5 shrink-0">
                    #{i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {s.keyword.phrases.map((phrase) => (
                        <Badge key={phrase} variant="secondary" className="text-[11px]">
                          {phrase}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {s.total} catches
                      </span>
                      {s.today > 0 && (
                        <span className="text-[10px] text-green-600 dark:text-green-400 flex items-center gap-0.5">
                          <TrendingUp className="h-2.5 w-2.5" />
                          +{s.today} today
                        </span>
                      )}
                      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden max-w-[80px]">
                        <div
                          className="h-full bg-primary/60 rounded-full"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => onRemove(s.keyword.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <div className="flex gap-2 w-full">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add keywords (comma-separated)"
              className="text-sm"
            />
            <Button onClick={handleAdd} size="sm" disabled={!input.trim()}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
