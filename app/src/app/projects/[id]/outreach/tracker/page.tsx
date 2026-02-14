'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, TrendingUp, TrendingDown, Minus, MessageSquare, ArrowUpRight, Clock, CheckCircle2 } from 'lucide-react';
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
import type { OutreachReply } from '@/types';

interface ReplyWithSignal extends OutreachReply {
  signal?: {
    title: string;
    subreddit: string;
    permalink: string;
  } | null;
}

type TrackerFilter = 'all' | 'tracking' | 'copied' | 'posted';

function ScoreDelta({ delta }: { delta: number }) {
  if (delta > 0) return <span className="flex items-center gap-0.5 text-green-500 text-[11px] font-medium"><TrendingUp className="h-3 w-3" />+{delta}</span>;
  if (delta < 0) return <span className="flex items-center gap-0.5 text-red-500 text-[11px] font-medium"><TrendingDown className="h-3 w-3" />{delta}</span>;
  return <span className="flex items-center gap-0.5 text-muted-foreground text-[11px]"><Minus className="h-3 w-3" />0</span>;
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return '';
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function OutreachTrackerPage() {
  const { project } = useProject();
  const [replies, setReplies] = useState<ReplyWithSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TrackerFilter>('all');

  const fetchReplies = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ project_id: project.id });
      if (filter !== 'all') params.set('status', filter);

      const res = await fetch(`/api/outreach/replies?${params}`);
      const json = await res.json();

      if (json.error) {
        toast.error(json.error);
        setReplies([]);
      } else {
        setReplies(json.replies || []);
      }
    } catch {
      toast.error('Failed to load replies');
      setReplies([]);
    }
    setLoading(false);
  }, [project.id, filter]);

  useEffect(() => {
    fetchReplies();
  }, [fetchReplies]);

  // Stats (computed from all replies, not just filtered)
  const [allReplies, setAllReplies] = useState<ReplyWithSignal[]>([]);

  useEffect(() => {
    async function fetchAll() {
      try {
        const res = await fetch(`/api/outreach/replies?project_id=${project.id}`);
        const json = await res.json();
        if (json.replies) setAllReplies(json.replies);
      } catch { /* stats will show 0 */ }
    }
    fetchAll();
  }, [project.id]);

  const totalTracking = allReplies.filter((r) => r.status === 'tracking' || r.status === 'posted').length;
  const totalScore = allReplies.reduce((sum, r) => sum + (r.current_score ?? 0), 0);
  const opRepliedCount = allReplies.filter((r) => r.op_replied).length;

  return (
    <PageTransition>
      <div className="flex h-full flex-col">
        <Header title="Reply Tracker" />
        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-6xl p-6 space-y-6">
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{totalTracking}</p>
                  <p className="text-xs text-muted-foreground">Replies Posted</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{totalScore}</p>
                  <p className="text-xs text-muted-foreground">Total Upvotes</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{opRepliedCount}</p>
                  <p className="text-xs text-muted-foreground">OP Replied</p>
                </CardContent>
              </Card>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2">
              <Tabs value={filter} onValueChange={(v) => setFilter(v as TrackerFilter)}>
                <TabsList className="h-8">
                  <TabsTrigger value="all" className="text-xs px-3 h-6">All</TabsTrigger>
                  <TabsTrigger value="tracking" className="text-xs px-3 h-6">Tracking</TabsTrigger>
                  <TabsTrigger value="copied" className="text-xs px-3 h-6">Copied</TabsTrigger>
                  <TabsTrigger value="posted" className="text-xs px-3 h-6">Posted</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Reply cards — 3-column grid */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-48 rounded-xl" />
                ))}
              </div>
            ) : replies.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                No replies yet. Draft replies from the Signals page to start tracking.
              </div>
            ) : (
              <StaggerList className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {replies.map((reply) => {
                  const title = reply.signal?.title || 'Untitled thread';
                  const subreddit = reply.signal?.subreddit || '';
                  const permalink = reply.signal?.permalink || reply.thread_permalink || '';
                  const statusColor = reply.status === 'tracking' || reply.status === 'posted'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';

                  return (
                    <StaggerItem key={reply.id}>
                      <motion.div whileHover={cardHover} whileTap={cardTap} className="h-full">
                        <Card className="transition-shadow hover:shadow-md h-full flex flex-col">
                          <CardContent className="p-4 flex flex-col flex-1 space-y-2.5">
                            {/* Top row: status + subreddit */}
                            <div className="flex items-center gap-1.5">
                              <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${statusColor}`}>
                                {reply.status}
                              </Badge>
                              {subreddit && (
                                <span className="text-[11px] text-muted-foreground">r/{subreddit}</span>
                              )}
                              {reply.op_replied && (
                                <span className="flex items-center gap-0.5 text-[11px] text-green-600 ml-auto">
                                  <CheckCircle2 className="h-3 w-3" />
                                  OP replied
                                </span>
                              )}
                            </div>

                            {/* Title */}
                            {permalink ? (
                              <a
                                href={`https://reddit.com${permalink}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline"
                              >
                                <h3 className="font-medium text-sm leading-snug line-clamp-2">{title}</h3>
                              </a>
                            ) : (
                              <h3 className="font-medium text-sm leading-snug line-clamp-2">{title}</h3>
                            )}

                            {/* Draft preview */}
                            {reply.draft_text && (
                              <p className="text-xs text-muted-foreground line-clamp-3">
                                {reply.draft_text}
                              </p>
                            )}

                            {/* Spacer */}
                            <div className="flex-1" />

                            {/* Meta row */}
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-0.5">
                                <ArrowUpRight className="h-3 w-3 text-orange-500" />
                                {reply.current_score ?? 0}
                              </span>
                              <ScoreDelta delta={0} />
                              <span className="flex items-center gap-0.5">
                                <MessageSquare className="h-3 w-3" />
                                {reply.reply_count}
                              </span>
                              {reply.posted_at && (
                                <span className="flex items-center gap-0.5">
                                  <Clock className="h-3 w-3" />
                                  {timeAgo(reply.posted_at)}
                                </span>
                              )}
                            </div>

                            {/* Action */}
                            {permalink && (
                              <div className="flex items-center gap-1 pt-0.5">
                                <a
                                  href={`https://reddit.com${permalink}`}
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
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
