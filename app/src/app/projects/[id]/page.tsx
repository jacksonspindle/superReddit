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
  postsDrafted: SparklineData;
  postsPublished: SparklineData;
  totalUpvotes: SparklineData;
  totalComments: SparklineData;
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
  const project = useProject();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const [subredditsRes, genPostsRes, discoveredRes, chatRes] = await Promise.all([
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
      ]);

      const subredditCount = subredditsRes.count ?? 0;
      const genPosts = genPostsRes.data ?? [];
      const discovered = discoveredRes.data ?? [];
      const chatMessages = chatRes.data ?? [];

      const published = genPosts.filter((p) => p.status === 'posted');
      const hasEdited = genPosts.some((p) => p.status === 'edited' || p.status === 'posted');
      const emptyDaily = new Array(SPARKLINE_DAYS).fill(0);

      // Build sparkline data
      const postsDrafted: SparklineData = {
        total: genPosts.length,
        daily: buildDailyBuckets(genPosts.map((p) => p.created_at)),
      };
      const postsPublished: SparklineData = {
        total: published.length,
        daily: buildDailyBuckets(published.map((p) => p.created_at)),
      };
      // Engagement metrics — populated once post tracking is added
      const totalUpvotes: SparklineData = { total: 0, daily: emptyDaily };
      const totalComments: SparklineData = { total: 0, daily: emptyDaily };

      // Build activity map
      const activityDays: Record<string, number> = {};
      const addActivity = (dateStr: string) => {
        const key = toDateKey(dateStr);
        activityDays[key] = (activityDays[key] || 0) + 1;
      };

      genPosts.forEach((p) => addActivity(p.created_at));
      discovered.forEach((p) => addActivity(p.fetched_at));
      chatMessages.forEach((m) => addActivity(m.created_at));

      setData({
        postsDrafted,
        postsPublished,
        totalUpvotes,
        totalComments,
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
            postsDrafted={data.postsDrafted}
            postsPublished={data.postsPublished}
            totalUpvotes={data.totalUpvotes}
            totalComments={data.totalComments}
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
