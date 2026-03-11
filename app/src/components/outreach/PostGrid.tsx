'use client';

import { useMemo } from 'react';
import { ExternalLink, MessageSquare, ArrowUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { AlertDelivery, OutreachKeyword } from '@/types';

interface PostGridProps {
  deliveries: AlertDelivery[];
  keywords: OutreachKeyword[];
  filterKeywordId: string | null;
  loading: boolean;
}

type DateGroup = 'Today' | 'Yesterday' | 'Last Week' | 'Older';

function getDateGroup(dateStr: string): DateGroup {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);

  if (date >= today) return 'Today';
  if (date >= yesterday) return 'Yesterday';
  if (date >= lastWeek) return 'Last Week';
  return 'Older';
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function highlightKeywords(text: string, matchedKeywords: string[]): React.ReactNode {
  if (!matchedKeywords.length) return text;

  // Build a regex from matched keywords
  const escaped = matchedKeywords.map((kw) =>
    kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, i) => {
    const isMatch = matchedKeywords.some(
      (kw) => kw.toLowerCase() === part.toLowerCase()
    );
    if (isMatch) {
      return (
        <mark key={i} className="bg-green-200/60 dark:bg-green-500/30 text-white rounded px-0.5">
          {part}
        </mark>
      );
    }
    return part;
  });
}

const groupOrder: DateGroup[] = ['Today', 'Yesterday', 'Last Week', 'Older'];

export function PostGrid({ deliveries, keywords, filterKeywordId, loading }: PostGridProps) {
  const grouped = useMemo(() => {
    // Filter by keyword if set
    let filtered = deliveries;
    if (filterKeywordId) {
      const kw = keywords.find((k) => k.id === filterKeywordId);
      if (kw) {
        const phrases = kw.phrases.map((p) => p.toLowerCase());
        filtered = deliveries.filter((d) =>
          d.signal?.matched_keywords?.some((mk) =>
            phrases.includes(mk.toLowerCase())
          )
        );
      }
    }

    // Deduplicate by signal permalink (same post may have multiple deliveries)
    const seen = new Set<string>();
    const unique: AlertDelivery[] = [];
    for (const d of filtered) {
      const key = d.signal?.permalink || d.id;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(d);
      }
    }

    // Group by date
    const groups: Record<DateGroup, AlertDelivery[]> = {
      Today: [],
      Yesterday: [],
      'Last Week': [],
      Older: [],
    };

    for (const d of unique) {
      const group = getDateGroup(d.created_at);
      groups[group].push(d);
    }

    return groups;
  }, [deliveries, keywords, filterKeywordId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const totalPosts = Object.values(grouped).reduce((sum, g) => sum + g.length, 0);

  if (totalPosts === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">No posts caught yet.</p>
        <p className="text-xs mt-1">Posts matching your keywords will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groupOrder.map((groupName) => {
        const posts = grouped[groupName];
        if (posts.length === 0) return null;

        return (
          <div key={groupName}>
            {/* Date header */}
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {groupName}
              </span>
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">{posts.length}</span>
            </div>

            {/* 3-column grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {posts.map((d) => {
                const signal = d.signal;
                if (!signal) return null;

                return (
                  <a
                    key={d.id}
                    href={`https://reddit.com${signal.permalink}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block rounded-lg border p-3 hover:bg-muted/30 hover:border-primary/30 transition-all"
                  >
                    {/* Title */}
                    <p className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
                      {highlightKeywords(signal.title, signal.matched_keywords || [])}
                    </p>

                    {/* Meta row */}
                    <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground">
                      <span className="font-medium">r/{signal.subreddit}</span>
                      <span>·</span>
                      <span>{timeAgo(d.created_at)}</span>
                      <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                    </div>

                    {/* Footer: keyword tags */}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {signal.matched_keywords?.slice(0, 3).map((kw) => (
                        <Badge
                          key={kw}
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0"
                        >
                          {kw}
                        </Badge>
                      ))}
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
