'use client';

import { useEffect, useState } from 'react';
import { useProject } from '@/contexts/project-context';
import { createClient } from '@/lib/supabase/client';
import { FadeIn } from '@/components/motion';
import { AnalyticsCards } from '@/components/dashboard/AnalyticsCards';
import { ActivityHeatmap } from '@/components/dashboard/ActivityHeatmap';
import { PlanProgress } from '@/components/dashboard/PlanProgress';
import { TrendingPosts } from '@/components/dashboard/TrendingPosts';
import { Skeleton } from '@/components/ui/skeleton';

interface SparklineData {
  total: number;
  daily: number[];
}

interface DashboardData {
  postsPublished: SparklineData;
  totalLeads: SparklineData;
  dmsSent: SparklineData;
  opportunitiesFound: SparklineData;
  hasSubreddits: boolean;
  hasResearch: boolean;
  hasDrafts: boolean;
  hasEdited: boolean;
  hasPublished: boolean;
  activityDays: Record<string, number>;
}

const SPARKLINE_DAYS = 30;

function buildDailyBuckets(dates: string[]): number[] {
  const buckets: Record<string, number> = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Initialize all days to 0
  for (let i = SPARKLINE_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    buckets[toDateKey(d)] = 0;
  }
  // Fill in actual counts
  for (const dateStr of dates) {
    const key = toDateKey(dateStr);
    if (key in buckets) {
      buckets[key]++;
    }
  }
  // Return as ordered array (oldest first)
  return Object.values(buckets);
}

function toDateKey(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function ProjectDashboardPage() {
  const { project } = useProject();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const [subredditsRes, genPostsRes, discoveredRes, chatRes, signalsRes, dmsRes] = await Promise.all([
        supabase
          .from('subreddits')
          .select('id', { count: 'exact', head: true })
          .eq('project_id', project.id),
        supabase
          .from('generated_posts')
          .select('status, created_at')
          .eq('project_id', project.id),
        supabase
          .from('discovered_posts')
          .select('fetched_at')
          .eq('project_id', project.id),
        supabase
          .from('chat_messages')
          .select('created_at')
          .eq('project_id', project.id)
          .eq('role', 'user'),
        supabase
          .from('outreach_signals')
          .select('id, fetched_at')
          .eq('project_id', project.id),
        supabase
          .from('outreach_dms')
          .select('pipeline_stage, dm_sent_at, created_at')
          .eq('project_id', project.id),
      ]);

      const subredditCount = subredditsRes.count ?? 0;
      const genPosts = genPostsRes.data ?? [];
      const discovered = discoveredRes.data ?? [];
      const chatMessages = chatRes.data ?? [];
      const signals = signalsRes.data ?? [];
      const dms = dmsRes.data ?? [];

      const published = genPosts.filter((p) => p.status === 'posted');
      const hasEdited = genPosts.some((p) => p.status === 'edited' || p.status === 'posted');

      // Posts Published
      const postsPublished: SparklineData = {
        total: published.length,
        daily: buildDailyBuckets(published.map((p) => p.created_at)),
      };

      // Total Leads = ready-to-DM pipeline items + all signals
      const readyToDm = dms.filter((d) =>
        ['detected', 'dm_ready', 'draft_generated'].includes(d.pipeline_stage)
      );
      const totalLeads: SparklineData = {
        total: readyToDm.length + signals.length,
        daily: buildDailyBuckets([
          ...readyToDm.map((d) => d.created_at),
          ...signals.map((s) => s.fetched_at),
        ]),
      };

      // DMs Sent = dm_sent + responded + converted (all sent states)
      const sentDms = dms.filter((d) =>
        ['dm_sent', 'responded', 'converted'].includes(d.pipeline_stage)
      );
      const dmsSent: SparklineData = {
        total: sentDms.length,
        daily: buildDailyBuckets(sentDms.map((d) => d.dm_sent_at || d.created_at)),
      };

      // Opportunities Found = all signals (alerts + signals posts)
      const opportunitiesFound: SparklineData = {
        total: signals.length,
        daily: buildDailyBuckets(signals.map((s) => s.fetched_at)),
      };

      // Build activity map
      const activityDays: Record<string, number> = {};
      const addActivity = (dateStr: string) => {
        const key = toDateKey(dateStr);
        activityDays[key] = (activityDays[key] || 0) + 1;
      };

      genPosts.forEach((p) => addActivity(p.created_at));
      discovered.forEach((p) => addActivity(p.fetched_at));
      chatMessages.forEach((m) => addActivity(m.created_at));
      signals.forEach((s) => addActivity(s.fetched_at));

      setData({
        postsPublished,
        totalLeads,
        dmsSent,
        opportunitiesFound,
        hasSubreddits: subredditCount > 0,
        hasResearch: discovered.length > 0,
        hasDrafts: genPosts.length > 0,
        hasEdited,
        hasPublished: published.length > 0,
        activityDays,
      });
    }

    load();
  }, [project.id]);

  if (!data) {
    return (
      <div className="space-y-4 p-5">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="col-span-2 h-56 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  return (
    <FadeIn className="space-y-4 p-5">
      <div>
        <h1 className="text-xl font-semibold">{project.name}</h1>
        <p className="text-sm text-muted-foreground">{project.product_name}</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <AnalyticsCards
            postsPublished={data.postsPublished}
            totalLeads={data.totalLeads}
            dmsSent={data.dmsSent}
            opportunitiesFound={data.opportunitiesFound}
          />
        </div>
        <PlanProgress
          projectId={project.id}
          hasSubreddits={data.hasSubreddits}
          hasResearch={data.hasResearch}
          hasDrafts={data.hasDrafts}
          hasEdited={data.hasEdited}
          hasPublished={data.hasPublished}
        />
      </div>

      <ActivityHeatmap activityDays={data.activityDays} />

      <TrendingPosts projectId={project.id} />
    </FadeIn>
  );
}
