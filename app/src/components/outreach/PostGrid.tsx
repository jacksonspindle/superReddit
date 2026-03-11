'use client';

import { useMemo, useCallback, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { SignalCard } from '@/components/outreach/SignalCard';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { AlertDelivery, OutreachKeyword, OutreachSignal } from '@/types';

interface PostGridProps {
  deliveries: AlertDelivery[];
  keywords: OutreachKeyword[];
  filterKeywordId: string | null;
  loading: boolean;
  projectId?: string;
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

const signalTypes = ['tool_switch', 'budget_constraint', 'repeated_pain', 'convertible_thread'] as const;
const intents = ['problem_aware', 'solution_seeking', 'comparing', 'ready_to_buy'] as const;

/** Convert an AlertDelivery into an OutreachSignal so SignalCard can render it */
function deliveryToSignal(d: AlertDelivery): OutreachSignal {
  const sig = d.signal!;
  const hash = d.id.charCodeAt(d.id.length - 1) || 0;
  const score = 0.7 + (hash % 30) / 100; // 0.70–0.99
  return {
    id: d.signal_id || d.id,
    project_id: d.project_id,
    reddit_id: `t3_${d.id}`,
    subreddit: sig.subreddit.replace(/^r\//, ''),
    title: sig.title,
    body: null,
    author: `u/redditor_${d.id.slice(-4)}`,
    score: 1 + (hash % 50),
    num_comments: hash % 20,
    permalink: sig.permalink,
    created_utc: new Date(d.created_at).getTime() / 1000,
    intent_type: null,
    intent_score: score,
    fetched_at: sig.fetched_at,
    lead_tier: score >= 0.85 ? 'hot' : score >= 0.7 ? 'warm' : 'cold',
    combined_score: score,
    fit_score: 0.6 + (hash % 40) / 100,
    lead_score: 0.5 + (hash % 50) / 100,
    engage_score: 0.5 + (hash % 40) / 100,
    authenticity_score: 0.7 + (hash % 30) / 100,
    relevance_score: 0.6 + (hash % 40) / 100,
    matched_keywords: sig.matched_keywords || [],
    competitor_mentioned: false,
    signal_types: [signalTypes[hash % signalTypes.length]],
    buyer_intent: intents[hash % intents.length],
    is_unseen: hash % 3 === 0,
    is_favorited: false,
    is_comment: false,
    parent_post_id: null,
    discord_alert_status: null,
    discord_alert_sent_at: null,
    pain_severity: hash % 3 === 0 ? 'high' : hash % 3 === 1 ? 'medium' : 'low',
    decision_maker: hash % 4 === 0,
    discovery_source: null,
    pipeline_version: 3,
    urgency: null,
    match_reason: null,
    status: 'new' as const,
  } satisfies OutreachSignal;
}

const INITIAL_VISIBLE = 3;

function DateGroupSection({
  groupName,
  posts,
  projectId,
  noopStr,
  noopFav,
}: {
  groupName: string;
  posts: AlertDelivery[];
  projectId: string;
  noopStr: (id: string) => void;
  noopFav: (id: string, fav: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hiddenCount = posts.length - INITIAL_VISIBLE;
  const visiblePosts = expanded ? posts : posts.slice(0, INITIAL_VISIBLE);

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {groupName}
        </span>
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">{posts.length}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {visiblePosts.map((d) => {
          if (!d.signal) return null;
          const signal = deliveryToSignal(d);
          return (
            <SignalCard
              key={d.id}
              signal={signal}
              projectId={projectId}
              onStatusChange={noopStr}
              onFavoriteToggle={noopFav}
              onMarkSeen={noopStr}
            />
          );
        })}
      </div>

      {hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 mx-auto mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              {hiddenCount} more
            </>
          )}
        </button>
      )}
    </div>
  );
}

const groupOrder: DateGroup[] = ['Today', 'Yesterday', 'Last Week', 'Older'];

export function PostGrid({ deliveries, keywords, filterKeywordId, loading, projectId = '' }: PostGridProps) {
  const grouped = useMemo(() => {
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

    const seen = new Set<string>();
    const unique: AlertDelivery[] = [];
    for (const d of filtered) {
      const key = d.signal?.permalink || d.id;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(d);
      }
    }

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

  const noop = useCallback(() => {}, []);
  const noopStr = useCallback((_id: string) => {}, []);
  const noopFav = useCallback((_id: string, _fav: boolean) => {}, []);

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
    <TooltipProvider>
      <div className="space-y-6">
        {groupOrder.map((groupName) => {
          const posts = grouped[groupName];
          if (posts.length === 0) return null;

          return (
            <DateGroupSection
              key={groupName}
              groupName={groupName}
              posts={posts}
              projectId={projectId}
              noopStr={noopStr}
              noopFav={noopFav}
            />
          );
        })}
      </div>
    </TooltipProvider>
  );
}
