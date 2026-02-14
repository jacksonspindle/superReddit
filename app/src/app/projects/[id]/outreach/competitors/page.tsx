'use client';

import { useCallback, useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, MessageSquare, ExternalLink, AlertCircle, ArrowUpRight, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import { useProject } from '@/contexts/project-context';
import { PageTransition, StaggerList, StaggerItem } from '@/components/motion';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { cardHover, cardTap } from '@/lib/motion';
import { toast } from 'sonner';
import type { OutreachSignal, OutreachConfig } from '@/types';

interface CompetitorSummary {
  name: string;
  mentions: number;
  topIntent: string;
}

type CompFilter = 'all' | string;

const intentColors: Record<string, string> = {
  question: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  comparison: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  problem: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  discussion: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
  showcase: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
};

function timeAgo(utc: number) {
  const seconds = Math.floor(Date.now() / 1000 - utc);
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(utc * 1000).toLocaleDateString();
}

function matchCompetitor(signal: OutreachSignal, competitors: string[]): string | null {
  const text = `${signal.title} ${signal.body ?? ''}`.toLowerCase();
  for (const comp of competitors) {
    if (text.includes(comp.toLowerCase())) return comp;
  }
  return null;
}

export default function OutreachCompetitorsPage() {
  const project = useProject();
  const [config, setConfig] = useState<OutreachConfig | null>(null);
  const [signals, setSignals] = useState<OutreachSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [compFilter, setCompFilter] = useState<CompFilter>('all');

  // Fetch config + competitor signals
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Fetch config for competitor names
        const configRes = await fetch(`/api/outreach/config?project_id=${project.id}`);
        const configJson = await configRes.json();
        const cfg = configJson.config as OutreachConfig | null;
        setConfig(cfg);

        // Fetch all signals (we'll filter for competitor mentions client-side)
        const sigRes = await fetch(`/api/outreach/signals?project_id=${project.id}`);
        const sigJson = await sigRes.json();

        if (sigJson.signals) {
          // Filter to only competitor-mentioned signals
          const competitorSignals = (sigJson.signals as OutreachSignal[]).filter(
            (s) => s.competitor_mentioned
          );
          setSignals(competitorSignals);
        }
      } catch {
        toast.error('Failed to load competitor data');
      }
      setLoading(false);
    }
    load();
  }, [project.id]);

  const competitors = config?.competitors || [];

  // Build summaries
  const summaries: CompetitorSummary[] = competitors.map((name) => {
    const mentions = signals.filter((s) => matchCompetitor(s, [name]) !== null);
    // Find most common intent type
    const intentCounts: Record<string, number> = {};
    mentions.forEach((s) => {
      if (s.intent_type) intentCounts[s.intent_type] = (intentCounts[s.intent_type] || 0) + 1;
    });
    const topIntent = Object.entries(intentCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'question';
    return { name, mentions: mentions.length, topIntent };
  });

  // Filter signals by selected competitor
  const filtered = compFilter === 'all'
    ? signals
    : signals.filter((s) => matchCompetitor(s, [compFilter]) !== null);

  return (
    <PageTransition>
      <div className="flex h-full flex-col">
        <Header title="Competitor Watch" />
        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-6xl p-6 space-y-6">
            {loading ? (
              <>
                <div className="grid grid-cols-3 gap-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-28 rounded-xl" />
                  ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-48 rounded-xl" />
                  ))}
                </div>
              </>
            ) : competitors.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                No competitors configured. Add competitors in the Outreach setup to start tracking.
              </div>
            ) : (
              <>
                {/* Competitor summary cards */}
                <div className="grid grid-cols-3 gap-3">
                  {summaries.map((comp) => (
                    <Card
                      key={comp.name}
                      className={`cursor-pointer transition-shadow hover:shadow-md ${compFilter === comp.name ? 'ring-2 ring-primary' : ''}`}
                      onClick={() => setCompFilter(compFilter === comp.name ? 'all' : comp.name)}
                    >
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-sm">{comp.name}</p>
                          <Badge variant="secondary" className={intentColors[comp.topIntent] || intentColors.discussion}>
                            {comp.topIntent}
                          </Badge>
                        </div>
                        <p className="text-2xl font-bold">{comp.mentions}</p>
                        <p className="text-[11px] text-muted-foreground">mentions found</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Filter tabs */}
                <div className="flex items-center gap-2">
                  <Tabs value={compFilter} onValueChange={(v) => setCompFilter(v)}>
                    <TabsList className="h-8">
                      <TabsTrigger value="all" className="text-xs px-3 h-6">All</TabsTrigger>
                      {competitors.map((c) => (
                        <TabsTrigger key={c} value={c} className="text-xs px-3 h-6">
                          {c}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>

                {/* Mention header */}
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">Mentions</h2>
                  <span className="text-sm text-muted-foreground">
                    {filtered.length} posts
                  </span>
                </div>

                {/* Mention cards — 3-column grid */}
                {filtered.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    No competitor mentions found yet. Signals are checked periodically.
                  </div>
                ) : (
                  <StaggerList className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filtered.map((signal) => {
                      const comp = matchCompetitor(signal, competitors) || 'Unknown';
                      return (
                        <StaggerItem key={signal.id}>
                          <motion.div whileHover={cardHover} whileTap={cardTap} className="h-full">
                            <Card className="transition-shadow hover:shadow-md h-full flex flex-col">
                              <CardContent className="p-4 flex flex-col flex-1 space-y-2.5">
                                {/* Top row: competitor + intent + subreddit */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] px-1.5 py-0 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
                                  >
                                    {comp}
                                  </Badge>
                                  {signal.intent_type && (
                                    <Badge
                                      variant="secondary"
                                      className={`text-[10px] px-1.5 py-0 ${intentColors[signal.intent_type] || intentColors.discussion}`}
                                    >
                                      {signal.intent_type}
                                    </Badge>
                                  )}
                                  <span className="text-[11px] text-muted-foreground">r/{signal.subreddit}</span>
                                </div>

                                {/* Title */}
                                <a
                                  href={`https://reddit.com${signal.permalink}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:underline"
                                >
                                  <h3 className="font-medium text-sm leading-snug line-clamp-2">{signal.title}</h3>
                                </a>

                                {/* Body preview */}
                                {signal.body && (
                                  <p className="text-xs text-muted-foreground line-clamp-3">
                                    {signal.body}
                                  </p>
                                )}

                                {/* Spacer */}
                                <div className="flex-1" />

                                {/* Meta row */}
                                <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                                  <span className="flex items-center gap-0.5">
                                    <ArrowUpRight className="h-3 w-3 text-orange-500" />
                                    {signal.score}
                                  </span>
                                  <span className="flex items-center gap-0.5">
                                    <MessageSquare className="h-3 w-3" />
                                    {signal.num_comments}
                                  </span>
                                  <span className="flex items-center gap-0.5">
                                    <Clock className="h-3 w-3" />
                                    {timeAgo(signal.created_utc)}
                                  </span>
                                  <span>u/{signal.author}</span>
                                </div>

                                {/* Action */}
                                <div className="flex items-center gap-1 pt-0.5">
                                  <a
                                    href={`https://reddit.com${signal.permalink}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2">
                                      <ExternalLink className="mr-1 h-3 w-3" />
                                      View Thread
                                    </Button>
                                  </a>
                                </div>
                              </CardContent>
                            </Card>
                          </motion.div>
                        </StaggerItem>
                      );
                    })}
                  </StaggerList>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
