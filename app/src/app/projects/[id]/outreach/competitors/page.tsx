'use client';

import { useEffect, useState } from 'react';
import { MessageSquare, ExternalLink, ArrowUpRight, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import { useProject } from '@/contexts/project-context';
import { PageTransition, StaggerList, StaggerItem } from '@/components/motion';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { CompetitorCard } from '@/components/outreach/CompetitorCard';
import { cardHover, cardTap } from '@/lib/motion';
import { toast } from 'sonner';

interface CompetitorSummary {
  name: string;
  totalMentions: number;
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
  switchingIntentCount: number;
  topSubreddits: string[];
}

interface MentionRow {
  id: string;
  competitor_name: string;
  mention_context: string | null;
  sentiment: string;
  switching_intent: boolean;
  created_at: string;
  outreach_signals: {
    id: string;
    title: string;
    subreddit: string;
    permalink: string;
    author: string;
    score: number;
    num_comments: number;
    created_utc: number;
    combined_score: number;
    signal_types: string[];
    pain_severity: string | null;
  } | null;
}

const sentimentColors: Record<string, string> = {
  positive: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  neutral: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
  negative: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

function timeAgo(utc: number) {
  const seconds = Math.floor(Date.now() / 1000 - utc);
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(utc * 1000).toLocaleDateString();
}

export default function OutreachCompetitorsPage() {
  const { project } = useProject();
  const [competitors, setCompetitors] = useState<CompetitorSummary[]>([]);
  const [mentions, setMentions] = useState<MentionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [compFilter, setCompFilter] = useState<string>('all');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/outreach/competitors?project_id=${project.id}`);
        const json = await res.json();

        if (json.error) {
          toast.error(json.error);
        } else {
          setCompetitors(json.competitors || []);
          setMentions(json.mentions || []);
        }
      } catch {
        toast.error('Failed to load competitor data');
      }
      setLoading(false);
    }
    load();
  }, [project.id]);

  const filteredMentions = compFilter === 'all'
    ? mentions
    : mentions.filter((m) => m.competitor_name === compFilter);

  return (
    <PageTransition>
      <div className="flex h-full flex-col">
        <Header title="Competitor Watch" />
        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-6xl p-6 space-y-6">
            {loading ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-44 rounded-xl" />
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
                No competitor data yet. Competitor mentions are extracted during signal detection.
                Add competitors in your project Profile and run a signal scan.
              </div>
            ) : (
              <>
                {/* Competitor summary cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {competitors.map((comp) => (
                    <CompetitorCard
                      key={comp.name}
                      name={comp.name}
                      totalMentions={comp.totalMentions}
                      sentimentBreakdown={comp.sentimentBreakdown}
                      switchingIntentCount={comp.switchingIntentCount}
                      topSubreddits={comp.topSubreddits}
                      selected={compFilter === comp.name}
                      onClick={() =>
                        setCompFilter(compFilter === comp.name ? 'all' : comp.name)
                      }
                    />
                  ))}
                </div>

                {/* Filter tabs */}
                <div className="flex items-center gap-2">
                  <Tabs value={compFilter} onValueChange={setCompFilter}>
                    <TabsList className="h-8">
                      <TabsTrigger value="all" className="text-xs px-3 h-6">All</TabsTrigger>
                      {competitors.map((c) => (
                        <TabsTrigger key={c.name} value={c.name} className="text-xs px-3 h-6">
                          {c.name}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>

                {/* Mention header */}
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">Mentions</h2>
                  <span className="text-sm text-muted-foreground">
                    {filteredMentions.length} mentions
                  </span>
                </div>

                {/* Mention cards */}
                {filteredMentions.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    No mentions found for this filter.
                  </div>
                ) : (
                  <StaggerList className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredMentions.map((mention) => {
                      const signal = mention.outreach_signals;
                      return (
                        <StaggerItem key={mention.id}>
                          <motion.div whileHover={cardHover} whileTap={cardTap} className="h-full">
                            <Card className="transition-shadow hover:shadow-md h-full flex flex-col">
                              <CardContent className="p-4 flex flex-col flex-1 space-y-2.5">
                                {/* Top badges */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] px-1.5 py-0 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
                                  >
                                    {mention.competitor_name}
                                  </Badge>
                                  <Badge
                                    variant="secondary"
                                    className={`text-[10px] px-1.5 py-0 ${sentimentColors[mention.sentiment]}`}
                                  >
                                    {mention.sentiment}
                                  </Badge>
                                  {mention.switching_intent && (
                                    <Badge
                                      variant="secondary"
                                      className="text-[10px] px-1.5 py-0 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300"
                                    >
                                      switching intent
                                    </Badge>
                                  )}
                                  {signal && (
                                    <span className="text-[11px] text-muted-foreground">
                                      r/{signal.subreddit}
                                    </span>
                                  )}
                                </div>

                                {/* Title */}
                                {signal && (
                                  <a
                                    href={`https://reddit.com${signal.permalink}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:underline"
                                  >
                                    <h3 className="font-medium text-sm leading-snug line-clamp-2">
                                      {signal.title}
                                    </h3>
                                  </a>
                                )}

                                {/* Context */}
                                {mention.mention_context && (
                                  <p className="text-xs text-muted-foreground line-clamp-3">
                                    ...{mention.mention_context}...
                                  </p>
                                )}

                                <div className="flex-1" />

                                {/* Meta */}
                                {signal && (
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
                                )}

                                {/* Action */}
                                {signal && (
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
                                )}
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
