'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Loader2, Rss, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { FeedPostCard } from '@/components/create/FeedPostCard';
import { useCreateStore } from '@/stores/create-store';
import { useProject } from '@/contexts/project-context';
import type { RedditPost } from '@/types';
import { toast } from 'sonner';

type SortOption = 'hot' | 'top' | 'rising' | 'new';
type TimeFilter = 'day' | 'week' | 'month';

const REDDIT_BASE = 'https://old.reddit.com';

/** Fetch posts from a subreddit directly via the browser (bypasses datacenter IP blocks) */
async function fetchRedditPostsClient(
  subreddit: string,
  sort: SortOption,
  timeFilter: TimeFilter,
  limit: number,
  after?: string
): Promise<{ posts: RedditPost[]; after: string | null }> {
  try {
    const timeParam = sort === 'top' ? `&t=${timeFilter}` : '';
    const afterParam = after ? `&after=${after}` : '';
    const url = `${REDDIT_BASE}/r/${subreddit}/${sort}.json?limit=${limit}${timeParam}${afterParam}&raw_json=1`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return { posts: [], after: null };
    const json = await res.json();
    const posts: RedditPost[] = (json.data?.children || []).map((child: { data: Record<string, unknown> }) => {
      const d = child.data;
      let previewUrl: string | null = null;
      try {
        const preview = d.preview as { images?: { source?: { url?: string } }[] } | undefined;
        const src = preview?.images?.[0]?.source?.url;
        if (src) previewUrl = src.replace(/&amp;/g, '&');
      } catch { /* ignore */ }
      return {
        id: d.id as string,
        title: d.title as string,
        selftext: (d.selftext as string) || '',
        author: d.author as string,
        score: d.score as number,
        num_comments: d.num_comments as number,
        url: d.url as string,
        permalink: d.permalink as string,
        created_utc: d.created_utc as number,
        subreddit: d.subreddit as string,
        link_flair_text: (d.link_flair_text as string) || null,
        is_self: d.is_self as boolean,
        thumbnail: (d.thumbnail as string) || null,
        preview_url: previewUrl,
        post_hint: (d.post_hint as string) || null,
      };
    });
    return { posts, after: json.data?.after || null };
  } catch {
    return { posts: [], after: null };
  }
}

export function FeedPanel() {
  const { project } = useProject();
  const { usePost, referencePosts } = useCreateStore();
  const usedIds = new Set(referencePosts.map((r) => r.id));

  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [trackedSubs, setTrackedSubs] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [sort, setSort] = useState<SortOption>('top');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('day');
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Discover section state
  const [discoverPosts, setDiscoverPosts] = useState<RedditPost[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const seenIds = useRef(new Set<string>());
  // Store Reddit pagination tokens per subreddit
  const afterTokens = useRef(new Map<string, string | null>());

  // Fetch tracked subreddits from server (Supabase)
  const fetchTrackedSubs = useCallback(async () => {
    try {
      const res = await fetch(`/api/reddit/feed?projectId=${project.id}`);
      const json = await res.json();
      return (json.trackedSubreddits || []) as string[];
    } catch {
      return [];
    }
  }, [project.id]);

  // Fetch Reddit posts client-side for all tracked subs
  const fetchPage = useCallback(async (
    sortVal: SortOption,
    timeVal: TimeFilter,
    subFilter: string,
    isReset: boolean,
  ) => {
    if (isReset) {
      setLoading(true);
      seenIds.current = new Set();
      afterTokens.current = new Map();
    } else {
      setLoadingMore(true);
    }

    try {
      // Get tracked subs on first load
      let subs = trackedSubs;
      if (subs.length === 0 || isReset) {
        subs = await fetchTrackedSubs();
        setTrackedSubs(subs);
      }

      if (subs.length === 0) {
        setPosts([]);
        setHasMore(false);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      const targetSubs = subFilter !== 'all'
        ? subs.filter((s) => s.toLowerCase() === subFilter.toLowerCase())
        : subs;

      // Fetch posts from each subreddit in parallel
      const results = await Promise.all(
        targetSubs.map(async (sub) => {
          const after = isReset ? undefined : (afterTokens.current.get(sub) || undefined);
          // Skip subs that have no more pages
          if (!isReset && afterTokens.current.has(sub) && afterTokens.current.get(sub) === null) {
            return { posts: [] as RedditPost[], hasMore: false };
          }
          const result = await fetchRedditPostsClient(sub, sortVal, timeVal, 25, after);
          afterTokens.current.set(sub, result.after);
          return { posts: result.posts, hasMore: !!result.after };
        })
      );

      // Merge, dedupe, sort by score
      const newPosts = results
        .flatMap((r) => r.posts)
        .filter((p) => {
          if (seenIds.current.has(p.id)) return false;
          seenIds.current.add(p.id);
          return true;
        })
        .sort((a, b) => b.score - a.score);

      if (isReset) {
        setPosts(newPosts);
      } else {
        setPosts((prev) => [...prev, ...newPosts]);
      }
      setHasMore(results.some((r) => r.hasMore));
    } catch {
      toast.error('Failed to load feed');
      if (isReset) setPosts([]);
    }

    setLoading(false);
    setLoadingMore(false);
  }, [trackedSubs, fetchTrackedSubs]);

  // Load discover posts once (from existing daily-mix endpoint)
  const discoverLoadedRef = useRef(false);
  const loadDiscover = useCallback(async () => {
    if (discoverLoadedRef.current) return;
    discoverLoadedRef.current = true;
    try {
      const res = await fetch(`/api/reddit/daily-mix?projectId=${project.id}`);
      const json = await res.json();
      setDiscoverPosts(json.discover || []);
    } catch {
      // silent fail for discover
    }
  }, [project.id]);

  // Initial load
  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    fetchPage(sort, timeFilter, activeFilter, true);
    loadDiscover();
  }, [fetchPage, loadDiscover, sort, timeFilter, activeFilter]);

  // Re-fetch when sort/time/filter changes
  function handleSortChange(newSort: SortOption) {
    setSort(newSort);
    fetchPage(newSort, timeFilter, activeFilter, true);
  }

  function handleTimeChange(newTime: TimeFilter) {
    setTimeFilter(newTime);
    fetchPage(sort, newTime, activeFilter, true);
  }

  function handleFilterChange(sub: string) {
    setActiveFilter(sub);
    fetchPage(sort, timeFilter, sub, true);
  }

  function handleRefresh() {
    fetchPage(sort, timeFilter, activeFilter, true);
  }

  function loadMore() {
    if (loadingMore || !hasMore) return;
    fetchPage(sort, timeFilter, activeFilter, false);
  }

  // Infinite scroll — trigger when near bottom
  function handleScroll() {
    const el = scrollRef.current;
    if (!el || loadingMore || !hasMore) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight - scrollTop - clientHeight < 400) {
      loadMore();
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="px-3 py-2 border-b space-y-2">
        {/* Sort + time filter row */}
        <div className="flex items-center gap-1.5">
          <Select value={sort} onValueChange={(v) => handleSortChange(v as SortOption)}>
            <SelectTrigger className="h-7 w-[72px] text-[10px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="top">Top</SelectItem>
              <SelectItem value="hot">Hot</SelectItem>
              <SelectItem value="rising">Rising</SelectItem>
              <SelectItem value="new">New</SelectItem>
            </SelectContent>
          </Select>

          {sort === 'top' && (
            <Select value={timeFilter} onValueChange={(v) => handleTimeChange(v as TimeFilter)}>
              <SelectTrigger className="h-7 w-[80px] text-[10px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Today</SelectItem>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="month">Month</SelectItem>
              </SelectContent>
            </Select>
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0 ml-auto"
            onClick={handleRefresh}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
          </Button>
        </div>

        {/* Subreddit filter pills */}
        <div className="flex items-center gap-1 flex-wrap">
          <Button
            variant={activeFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            className="h-6 text-[10px] px-2"
            onClick={() => handleFilterChange('all')}
          >
            All
          </Button>
          {trackedSubs.map((sub) => (
            <Button
              key={sub}
              variant={activeFilter.toLowerCase() === sub.toLowerCase() ? 'default' : 'outline'}
              size="sm"
              className="h-6 text-[10px] px-2"
              onClick={() => handleFilterChange(sub)}
            >
              r/{sub}
            </Button>
          ))}
        </div>
      </div>

      {/* Feed */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        {loading ? (
          <div className="p-3 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-32 w-full rounded-lg" />
                <Skeleton className="h-3 w-48" />
              </div>
            ))}
          </div>
        ) : posts.length === 0 && !hasMore ? (
          <div className="flex flex-col items-center py-12 text-center">
            <Rss className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-xs text-muted-foreground">
              No subreddits tracked yet
            </p>
            <p className="text-[10px] text-muted-foreground/70 mt-1">
              Add subreddits to your project to see your feed
            </p>
          </div>
        ) : (
          <>
            {posts.map((post) => (
              <FeedPostCard
                key={post.id}
                post={post}
                onUse={usePost}
                isUsed={usedIds.has(post.id)}
              />
            ))}

            {/* Loading more indicator */}
            {loadingMore && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* End of tracked posts — show discover */}
            {!hasMore && discoverPosts.length > 0 && (
              <div className="border-t">
                <div className="flex items-center gap-2 px-3 py-3">
                  <Compass className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-xs font-semibold">You might also like</span>
                </div>
                {discoverPosts.map((post) => (
                  <FeedPostCard
                    key={`discover-${post.id}`}
                    post={post}
                    onUse={usePost}
                    isUsed={usedIds.has(post.id)}
                  />
                ))}
              </div>
            )}

            {!hasMore && discoverPosts.length === 0 && (
              <p className="text-[10px] text-muted-foreground text-center py-4">
                You&apos;re all caught up
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
