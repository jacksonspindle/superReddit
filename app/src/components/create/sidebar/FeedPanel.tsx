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

export function FeedPanel() {
  const { project } = useProject();
  const { usePost, referencePosts } = useCreateStore();
  const usedIds = new Set(referencePosts.map((r) => r.id));

  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [trackedSubs, setTrackedSubs] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [sort, setSort] = useState<SortOption>('top');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('day');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Discover section state
  const [discoverPosts, setDiscoverPosts] = useState<RedditPost[]>([]);
  const [discoverLoaded, setDiscoverLoaded] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const seenIds = useRef(new Set<string>());

  const fetchPage = useCallback(async (
    pageNum: number,
    sortVal: SortOption,
    timeVal: TimeFilter,
    subFilter: string,
    isReset: boolean,
  ) => {
    if (isReset) {
      setLoading(true);
      seenIds.current = new Set();
    } else {
      setLoadingMore(true);
    }

    try {
      const params = new URLSearchParams({
        projectId: project.id,
        sort: sortVal,
        t: timeVal,
        page: String(pageNum),
      });
      if (subFilter !== 'all') params.set('sub', subFilter);

      const res = await fetch(`/api/reddit/feed?${params}`);
      const json = await res.json();

      if (json.error) {
        toast.error(json.error);
        if (isReset) setPosts([]);
      } else {
        // Dedupe against already-loaded posts
        const newPosts = (json.posts as RedditPost[]).filter((p) => {
          if (seenIds.current.has(p.id)) return false;
          seenIds.current.add(p.id);
          return true;
        });

        if (isReset) {
          setPosts(newPosts);
        } else {
          setPosts((prev) => [...prev, ...newPosts]);
        }
        setHasMore(json.hasMore ?? false);
        setTrackedSubs(json.trackedSubreddits ?? []);
      }
    } catch {
      toast.error('Failed to load feed');
      if (isReset) setPosts([]);
    }

    setLoading(false);
    setLoadingMore(false);
  }, [project.id]);

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
    setDiscoverLoaded(true);
  }, [project.id]);

  // Initial load — ref guard ensures this only runs once
  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    fetchPage(0, sort, timeFilter, activeFilter, true);
    loadDiscover();
  }, [fetchPage, loadDiscover, sort, timeFilter, activeFilter]);

  // Re-fetch when sort/time/filter changes
  function handleSortChange(newSort: SortOption) {
    setSort(newSort);
    setPage(0);
    fetchPage(0, newSort, timeFilter, activeFilter, true);
  }

  function handleTimeChange(newTime: TimeFilter) {
    setTimeFilter(newTime);
    setPage(0);
    fetchPage(0, sort, newTime, activeFilter, true);
  }

  function handleFilterChange(sub: string) {
    setActiveFilter(sub);
    setPage(0);
    fetchPage(0, sort, timeFilter, sub, true);
  }

  function handleRefresh() {
    setPage(0);
    fetchPage(0, sort, timeFilter, activeFilter, true);
  }

  function loadMore() {
    if (loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPage(nextPage, sort, timeFilter, activeFilter, false);
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
