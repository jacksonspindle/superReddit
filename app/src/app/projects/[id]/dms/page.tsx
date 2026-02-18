'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  Radar,
  Send,
  MessageSquareReply,
  UserCheck,
  ExternalLink,
  ArrowUpRight,
  Eye,
  X,
  Maximize2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useProject } from '@/contexts/project-context';
import { PageTransition, StaggerList, StaggerItem } from '@/components/motion';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface StageCounts {
  detected: number;
  dm_ready: number;
  draft_generated: number;
  dm_sent: number;
  responded: number;
  follow_up: number;
  converted: number;
  closed: number;
}

interface DailyTrend {
  date: string;
  detected: number;
  ready: number;
  sent: number;
  follow_up: number;
  converted: number;
}

interface TopPost {
  id: string;
  title: string;
  subreddit: string;
  permalink: string;
  score: number;
  num_comments: number;
  leads: number;
  converted: number;
}

interface BestResponse {
  id: string;
  signal_id: string | null;
  thread_permalink: string | null;
  current_score: number;
  reply_count: number;
  op_replied: boolean;
  status: string;
  posted_at: string | null;
  signal_title: string;
  subreddit: string;
  leads_generated: number;
}

interface AnalyticsData {
  stageCounts: StageCounts;
  followUpCount: number;
  dailyTrends: DailyTrend[];
  topPosts: TopPost[];
  bestResponses: BestResponse[];
  totalDms: number;
}

const STAGE_CARDS = [
  { key: 'detected', label: 'Detected', description: 'Total leads detected from monitored threads', icon: Eye, color: 'text-blue-500', bgColor: 'bg-blue-500/10', chartColor: 'hsl(var(--chart-1))' },
  { key: 'ready', label: 'Ready to DM', description: 'Leads qualified and ready for outreach', icon: Radar, color: 'text-amber-500', bgColor: 'bg-amber-500/10', chartColor: 'hsl(var(--chart-4))' },
  { key: 'sent', label: 'DM Sent', description: 'Direct messages sent to qualified leads', icon: Send, color: 'text-violet-500', bgColor: 'bg-violet-500/10', chartColor: 'hsl(var(--chart-5))' },
  { key: 'follow_up', label: 'Follow Up', description: 'Leads that responded or need follow-up', icon: MessageSquareReply, color: 'text-orange-500', bgColor: 'bg-orange-500/10', chartColor: 'hsl(var(--chart-3))' },
  { key: 'converted', label: 'Converted', description: 'Leads successfully converted to customers', icon: UserCheck, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10', chartColor: 'hsl(var(--chart-2))' },
] as const;

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateLong(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function DmAnalyticsPage() {
  const { project } = useProject();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedStage, setExpandedStage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await fetch(`/api/outreach/dms/analytics?project_id=${project.id}`);
        const json = await res.json();
        if (json.error) {
          toast.error(json.error);
        } else {
          setData(json);
        }
      } catch {
        toast.error('Failed to load analytics');
      }
      setLoading(false);
    }
    fetchAnalytics();
  }, [project.id]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') setExpandedStage(null);
  }, []);

  useEffect(() => {
    if (expandedStage) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [expandedStage, handleKeyDown]);

  function getStageCount(key: string): number {
    if (!data) return 0;
    const sc = data.stageCounts;
    switch (key) {
      case 'detected': return data.totalDms;
      case 'ready': return sc.dm_ready + sc.draft_generated;
      case 'sent': return sc.dm_sent;
      case 'follow_up': return sc.responded + data.followUpCount;
      case 'converted': return sc.converted;
      default: return 0;
    }
  }

  function getChartData(key: string) {
    return data?.dailyTrends.map((d) => ({
      date: d.date,
      value: d[key as keyof DailyTrend] as number,
    })) ?? [];
  }

  // Stats for expanded view
  function getStageStats(key: string) {
    const chartData = getChartData(key);
    const values = chartData.map((d) => d.value);
    const total = values.reduce((a, b) => a + b, 0);
    const max = Math.max(...values, 0);
    const avg = values.length > 0 ? (total / values.length).toFixed(1) : '0';
    const peakDay = chartData.find((d) => d.value === max);
    const last7 = values.slice(-7).reduce((a, b) => a + b, 0);
    const prev7 = values.slice(-14, -7).reduce((a, b) => a + b, 0);
    const trend = prev7 > 0 ? (((last7 - prev7) / prev7) * 100).toFixed(0) : last7 > 0 ? '+100' : '0';
    return { total, max, avg, peakDay, last7, prev7, trend };
  }

  const expandedCard = expandedStage ? STAGE_CARDS.find((s) => s.key === expandedStage) : null;

  if (loading) {
    return (
      <PageTransition>
        <div className="flex h-full flex-col">
          <Header title="DM Analytics" />
          <div className="flex-1 overflow-auto">
            <div className="mx-auto max-w-[1600px] p-6 space-y-6">
              <div className="grid grid-cols-5 gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 rounded-xl" />
                ))}
              </div>
              <Skeleton className="h-64 rounded-xl" />
              <Skeleton className="h-64 rounded-xl" />
            </div>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="flex h-full flex-col">
        <Header title="DM Analytics" />
        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-[1600px] p-6 space-y-6">
            {/* Stage cards in a row — each with its own chart */}
            <StaggerList className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {STAGE_CARDS.map((stage) => {
                const count = getStageCount(stage.key);
                const chartData = getChartData(stage.key);

                return (
                  <StaggerItem key={stage.key}>
                    <Card
                      className="relative overflow-hidden cursor-pointer transition-all hover:ring-2 hover:ring-ring/20 group"
                      onClick={() => setExpandedStage(stage.key)}
                    >
                      <CardContent className="p-4 pb-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`rounded-lg p-1.5 ${stage.bgColor}`}>
                              <stage.icon className={`h-4 w-4 ${stage.color}`} />
                            </div>
                            <span className="text-xs text-muted-foreground font-medium">{stage.label}</span>
                          </div>
                          <Maximize2 className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <p className="text-3xl font-bold">{count}</p>
                        {/* Sparkline with CSS axis lines */}
                        <div className="h-32 mt-3 -mx-1 relative">
                          <div className="absolute inset-0 border-l-2 border-b-2 border-muted-foreground/40 rounded-bl-sm" />
                          <div className="absolute inset-0">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 1 }}>
                                <defs>
                                  <linearGradient id={`card-grad-${stage.key}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={stage.chartColor} stopOpacity={0.25} />
                                    <stop offset="100%" stopColor={stage.chartColor} stopOpacity={0} />
                                  </linearGradient>
                                </defs>
                                <Area
                                  type="natural"
                                  dataKey="value"
                                  stroke={stage.chartColor}
                                  strokeWidth={1.5}
                                  fill={`url(#card-grad-${stage.key})`}
                                  dot={false}
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </StaggerItem>
                );
              })}
            </StaggerList>

            {/* Top Performing Posts */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Top Performing Posts</CardTitle>
                <p className="text-xs text-muted-foreground">Posts ranked by how many DM leads they generated</p>
              </CardHeader>
              <CardContent>
                {data?.topPosts && data.topPosts.length > 0 ? (
                  <div className="space-y-1">
                    <div className="h-48 mb-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={data.topPosts.slice(0, 7)}
                          layout="vertical"
                          margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
                          <XAxis type="number" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                          <YAxis
                            type="category"
                            dataKey="title"
                            width={180}
                            tick={{ fontSize: 11 }}
                            className="text-muted-foreground"
                            tickFormatter={(v: string) => v.length > 28 ? v.slice(0, 28) + '...' : v}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                              fontSize: '12px',
                            }}
                          />
                          <Bar dataKey="leads" name="Leads" radius={[0, 4, 4, 0]}>
                            {data.topPosts.slice(0, 7).map((_, i) => (
                              <Cell key={i} fill={`hsl(var(--chart-${(i % 5) + 1}))`} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2">
                      {data.topPosts.map((post, i) => (
                        <div
                          key={post.id}
                          className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50"
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{post.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                r/{post.subreddit}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">
                                {post.score} pts · {post.num_comments} comments
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <p className="text-sm font-bold">{post.leads}</p>
                              <p className="text-[10px] text-muted-foreground">leads</p>
                            </div>
                            {post.converted > 0 && (
                              <div className="text-right">
                                <p className="text-sm font-bold text-emerald-500">{post.converted}</p>
                                <p className="text-[10px] text-muted-foreground">converted</p>
                              </div>
                            )}
                            <a
                              href={`https://reddit.com${post.permalink}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No posts with leads yet. Reply to signals to start generating leads.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Best Performing Responses */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Best Performing Responses</CardTitle>
                <p className="text-xs text-muted-foreground">Your replies ranked by lead generation success</p>
              </CardHeader>
              <CardContent>
                {data?.bestResponses && data.bestResponses.length > 0 ? (
                  <div className="space-y-2">
                    {data.bestResponses.map((resp, i) => (
                      <div
                        key={resp.id}
                        className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{resp.signal_title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {resp.subreddit && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                r/{resp.subreddit}
                              </Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              {resp.current_score} pts · {resp.reply_count} replies
                            </span>
                            {resp.op_replied && (
                              <Badge className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                                OP replied
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <div className="flex items-center gap-1">
                              <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                              <p className="text-sm font-bold">{resp.leads_generated}</p>
                            </div>
                            <p className="text-[10px] text-muted-foreground">leads</p>
                          </div>
                          {resp.thread_permalink && (
                            <a
                              href={`https://reddit.com${resp.thread_permalink}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No responses tracked yet. Post replies and we&apos;ll track their performance.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Expanded stage detail overlay */}
      <AnimatePresence>
        {expandedStage && expandedCard && (() => {
          const count = getStageCount(expandedCard.key);
          const chartData = getChartData(expandedCard.key);
          const stats = getStageStats(expandedCard.key);

          return (
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 flex items-start justify-center bg-background/80 backdrop-blur-sm overflow-auto"
              onClick={() => setExpandedStage(null)}
            >
              <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 24, scale: 0.97 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="w-full max-w-4xl my-8 mx-4"
                onClick={(e) => e.stopPropagation()}
              >
                <Card className="shadow-2xl border-2">
                  {/* Header */}
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-xl p-2.5 ${expandedCard.bgColor}`}>
                          <expandedCard.icon className={`h-5 w-5 ${expandedCard.color}`} />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{expandedCard.label}</CardTitle>
                          <p className="text-sm text-muted-foreground">{expandedCard.description}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => setExpandedStage(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    {/* Key metrics row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="rounded-lg border p-3 text-center">
                        <p className="text-2xl font-bold">{count}</p>
                        <p className="text-xs text-muted-foreground">Total</p>
                      </div>
                      <div className="rounded-lg border p-3 text-center">
                        <p className="text-2xl font-bold">{stats.avg}</p>
                        <p className="text-xs text-muted-foreground">Daily avg</p>
                      </div>
                      <div className="rounded-lg border p-3 text-center">
                        <p className="text-2xl font-bold">{stats.max}</p>
                        <p className="text-xs text-muted-foreground">
                          Peak{stats.peakDay ? ` (${formatDate(stats.peakDay.date)})` : ''}
                        </p>
                      </div>
                      <div className="rounded-lg border p-3 text-center">
                        <p className={`text-2xl font-bold ${Number(stats.trend) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {Number(stats.trend) >= 0 ? '+' : ''}{stats.trend}%
                        </p>
                        <p className="text-xs text-muted-foreground">vs prev 7 days</p>
                      </div>
                    </div>

                    {/* Full chart */}
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis
                            dataKey="date"
                            tickFormatter={formatDate}
                            tick={{ fontSize: 11 }}
                            className="text-muted-foreground"
                          />
                          <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" allowDecimals={false} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                              fontSize: '12px',
                            }}
                            labelFormatter={(label) => formatDateLong(String(label))}
                            formatter={(value) => [value ?? 0, expandedCard.label]}
                          />
                          <defs>
                            <linearGradient id={`expanded-grad`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={expandedCard.chartColor} stopOpacity={0.4} />
                              <stop offset="100%" stopColor={expandedCard.chartColor} stopOpacity={0.05} />
                            </linearGradient>
                          </defs>
                          <Area
                            type="monotone"
                            dataKey="value"
                            name={expandedCard.label}
                            stroke={expandedCard.chartColor}
                            strokeWidth={2.5}
                            fill="url(#expanded-grad)"
                            dot={false}
                            activeDot={{ r: 5, strokeWidth: 2 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Daily breakdown table */}
                    <div>
                      <h4 className="text-sm font-medium mb-2">Daily Breakdown</h4>
                      <div className="rounded-lg border overflow-hidden">
                        <div className="max-h-48 overflow-auto">
                          <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                              <tr>
                                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Date</th>
                                <th className="text-right px-3 py-2 font-medium text-muted-foreground text-xs">Count</th>
                                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs w-1/2">Volume</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[...chartData].reverse().map((row) => (
                                <tr key={row.date} className="border-t hover:bg-accent/30 transition-colors">
                                  <td className="px-3 py-1.5 text-xs">{formatDateLong(row.date)}</td>
                                  <td className="px-3 py-1.5 text-xs text-right font-medium">{row.value}</td>
                                  <td className="px-3 py-1.5">
                                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                                      <div
                                        className="h-full rounded-full transition-all"
                                        style={{
                                          width: stats.max > 0 ? `${(row.value / stats.max) * 100}%` : '0%',
                                          backgroundColor: expandedCard.chartColor,
                                        }}
                                      />
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </PageTransition>
  );
}
