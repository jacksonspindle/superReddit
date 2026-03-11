'use client';

import { useState } from 'react';
import {
  ArrowUpRight, MessageSquare, Clock, ExternalLink, X, Bell,
  Star, Flame, Sun, Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ReplyBuilder } from '@/components/outreach/ReplyBuilder';
import { toast } from 'sonner';
import type { OutreachSignal, SignalType, LeadTier, BuyerIntent } from '@/types';

interface SignalCardV2Props {
  signal: OutreachSignal;
  projectId: string;
  onStatusChange: (signalId: string, status: string) => void;
  onFavoriteToggle: (signalId: string, isFavorited: boolean) => void;
  onMarkSeen: (signalId: string) => void;
}

const intentColors: Record<string, string> = {
  question: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  comparison: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
  problem: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
  discussion: 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300',
  showcase: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
};

const signalTypeColors: Record<string, string> = {
  tool_switch: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300',
  budget_constraint: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
  repeated_pain: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300',
  high_signal_comment: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300',
  mod_safe: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300',
  trend_cluster: 'bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-300',
  convertible_thread: 'bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-300',
};

const painColors: Record<string, string> = {
  low: 'text-gray-500 dark:text-gray-400',
  medium: 'text-yellow-600 dark:text-yellow-400',
  high: 'text-red-600 dark:text-red-400',
};

const painLabels: Record<string, string> = {
  low: '~ Low Pain',
  medium: '! Med Pain',
  high: '!! High Pain',
};

const buyerIntentConfig: Record<BuyerIntent, { label: string; badge: string }> = {
  problem_aware: {
    label: 'Problem Aware',
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300',
  },
  solution_seeking: {
    label: 'Solution Seeking',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  },
  comparing: {
    label: 'Comparing',
    badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
  },
  ready_to_buy: {
    label: 'Ready to Buy',
    badge: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
  },
};

const tierConfig: Record<LeadTier, { label: string; badge: string; stripe: string; icon: typeof Flame }> = {
  hot: {
    label: 'Hot Lead',
    badge: 'bg-red-500/15 text-red-500 dark:bg-red-500/20 dark:text-red-400',
    stripe: 'bg-gradient-to-r from-red-500 to-red-400',
    icon: Flame,
  },
  warm: {
    label: 'Warm Lead',
    badge: 'bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400',
    stripe: 'bg-gradient-to-r from-amber-500 to-amber-400',
    icon: Sun,
  },
  cold: {
    label: 'Cold',
    badge: 'bg-gray-500/15 text-gray-500 dark:bg-gray-500/20 dark:text-gray-400',
    stripe: '',
    icon: Sun,
  },
};

function deriveTier(signal: OutreachSignal): LeadTier {
  if (signal.lead_tier) return signal.lead_tier;
  // Backward compat: derive from combined_score
  const score = signal.combined_score ?? 0;
  if (score >= 0.7) return 'hot';
  if (score >= 0.4) return 'warm';
  return 'cold';
}

function scoreColor(value: number): string {
  if (value >= 7) return 'text-green-600 dark:text-green-400';
  if (value >= 4) return 'text-amber-600 dark:text-amber-400';
  return 'text-gray-500 dark:text-gray-400';
}

function scoreBarColor(value: number): string {
  if (value >= 7) return 'bg-green-500';
  if (value >= 4) return 'bg-amber-500';
  return 'bg-gray-400';
}

const timeAgo = (timestamp: number) => {
  if (!timestamp) return '';
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(timestamp * 1000).toLocaleDateString();
};

const formatNumber = (n: number) => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
};

function ScoreBadge({ label, value }: { label: string; value: number }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-md bg-muted/50 border border-border px-2 py-1">
      <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
      <span className={`text-xs font-semibold ${scoreColor(value)}`}>{value}</span>
      <div className="w-5 h-0.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${scoreBarColor(value)}`}
          style={{ width: `${value * 10}%` }}
        />
      </div>
    </div>
  );
}

export function SignalCard({ signal, projectId, onStatusChange, onFavoriteToggle, onMarkSeen }: SignalCardV2Props) {
  const [showReply, setShowReply] = useState(false);
  const tier = deriveTier(signal);
  const config = tierConfig[tier];
  const TierIcon = config.icon;
  const signalTypes = signal.signal_types || [];
  const hasV3Scores = signal.authenticity_score != null;
  const hasV2Scores = signal.fit_score != null;

  async function handleSendDiscordAlert() {
    try {
      const res = await fetch('/api/outreach/signals/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signal_id: signal.id,
          discord_alert_status: 'pending',
        }),
      });
      if (res.ok) {
        toast.success('Discord alert queued');
      }
    } catch {
      toast.error('Failed to queue alert');
    }
  }

  function handleCardClick() {
    if (signal.is_unseen) {
      onMarkSeen(signal.id);
    }
  }

  return (
    <div className="h-full" onClick={handleCardClick}>
      <Card className={`transition-shadow hover:shadow-md h-full flex flex-col relative overflow-hidden ${
        tier === 'hot'
          ? 'border-red-500/60 border-[1.5px]'
          : tier === 'warm'
            ? 'border-amber-500/60 border-[1.5px]'
            : signal.is_unseen === true
              ? 'border-l-[3px] border-l-blue-500'
              : ''
      }`}>

        <CardContent className="p-4 flex flex-col flex-1 space-y-2.5">
          {/* Header row: tier + intent + comment badge + actions */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${config.badge}`}>
                {tier !== 'cold' && <TierIcon className="h-2.5 w-2.5" />}
                {config.label}
              </span>

              {signal.is_comment && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300">
                  <MessageSquare className="h-2.5 w-2.5" />
                  Comment
                </span>
              )}

              {signal.buyer_intent && buyerIntentConfig[signal.buyer_intent] ? (
                <Badge
                  variant="secondary"
                  className={`text-[10px] px-1.5 py-0 ${buyerIntentConfig[signal.buyer_intent].badge}`}
                >
                  {buyerIntentConfig[signal.buyer_intent].label}
                </Badge>
              ) : signal.intent_type && signal.intent_type !== 'unknown' ? (
                <Badge
                  variant="secondary"
                  className={`text-[10px] px-1.5 py-0 ${intentColors[signal.intent_type] || intentColors.discussion}`}
                >
                  {signal.intent_type}
                </Badge>
              ) : null}

              {signal.is_unseen && (
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 flex-shrink-0" />
              )}
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => { e.stopPropagation(); onFavoriteToggle(signal.id, !signal.is_favorited); }}
                    className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors ${
                      signal.is_favorited
                        ? 'text-amber-500'
                        : 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    <Star className="h-3.5 w-3.5" fill={signal.is_favorited ? 'currentColor' : 'none'} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{signal.is_favorited ? 'Unfavorite' : 'Favorite'}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => { e.stopPropagation(); onStatusChange(signal.id, 'dismissed'); }}
                    className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Dismiss</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Signal type tags */}
          {signalTypes.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {signalTypes.slice(0, 4).map((type) => (
                <Badge
                  key={type}
                  variant="secondary"
                  className={`text-[9px] px-1.5 py-0 font-semibold ${signalTypeColors[type] || 'bg-gray-100 text-gray-800'}`}
                >
                  {type.replace(/_/g, ' ')}
                </Badge>
              ))}
            </div>
          )}

          {/* Subreddit + discovery source */}
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center rounded-md bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 text-[11px] font-semibold text-indigo-400">
              r/{signal.subreddit}
            </span>
            {signal.discovery_source && signal.discovery_source !== 'keyword_search' && (
              <span className="text-[9px] text-muted-foreground/60 font-medium">
                {signal.discovery_source === 'subreddit_browse' ? 'browse' : signal.discovery_source === 'both' ? 'browse+keyword' : 'comment'}
              </span>
            )}
          </div>

          {/* Title */}
          <a
            href={`https://reddit.com${signal.permalink}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-sm leading-snug line-clamp-2">{signal.title}</h3>
          </a>

          {/* Body preview */}
          {signal.body && (
            <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
              {signal.body}
            </p>
          )}

          {/* Score row - removed */}

          {/* Pain + Decision Maker */}
          {(signal.pain_severity || signal.decision_maker) && (
            <div className="flex items-center gap-2 flex-wrap">
              {signal.pain_severity && (
                <span className={`text-[10px] font-semibold ${painColors[signal.pain_severity]}`}>
                  {painLabels[signal.pain_severity]}
                </span>
              )}
              {signal.decision_maker && (
                <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0 text-[9px] font-semibold bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">
                  Decision Maker
                </span>
              )}
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Meta row */}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
            <span className="flex items-center gap-0.5">
              <ArrowUpRight className="h-3 w-3 text-orange-500" />
              {formatNumber(signal.score)}
            </span>
            <span className="flex items-center gap-0.5">
              <MessageSquare className="h-3 w-3" />
              {formatNumber(signal.num_comments)}
            </span>
            <span className="flex items-center gap-0.5">
              <Clock className="h-3 w-3" />
              {timeAgo(signal.created_utc)}
            </span>
            <span className="text-[10px]">u/{signal.author}</span>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-border">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] px-2"
                onClick={(e) => { e.stopPropagation(); window.open(`https://reddit.com${signal.permalink}`, '_blank'); }}
              >
                <ExternalLink className="mr-1 h-3 w-3" />
                View Thread
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] px-2"
                onClick={(e) => { e.stopPropagation(); handleSendDiscordAlert(); }}
              >
                <Bell className="h-3 w-3" />
              </Button>
            </div>
            <Button
              variant="default"
              size="sm"
              className="h-6 text-[11px] px-3"
              onClick={(e) => { e.stopPropagation(); setShowReply(!showReply); }}
            >
              <Pencil className="mr-1 h-3 w-3" />
              Draft Reply
            </Button>
          </div>

          {/* Inline reply builder */}
          {showReply && (
            <div onClick={(e) => e.stopPropagation()}>
              <ReplyBuilder
                signalId={signal.id}
                projectId={projectId}
                permalink={signal.permalink}
                onCopied={() => onStatusChange(signal.id, 'replied')}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
