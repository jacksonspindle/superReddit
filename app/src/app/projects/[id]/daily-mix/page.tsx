'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Loader2, Compass, Rss } from 'lucide-react';
import { motion } from 'motion/react';
import { useProject } from '@/contexts/project-context';
import { Header } from '@/components/layout/header';
import { PostCard } from '@/components/inspiration/PostCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { PageTransition } from '@/components/motion';
import { StaggerList, StaggerItem } from '@/components/motion';
import { staggerContainerVariants, staggerItemVariants } from '@/lib/motion';
import { useBookmarkStore } from '@/stores/bookmark-store';
import type { RedditPost } from '@/types';
import { toast } from 'sonner';

interface DailyMixData {
  feed: RedditPost[];
  discover: RedditPost[];
  trackedSubreddits: string[];
  empty?: boolean;
}

export default function DailyMixPage() {
  const { project } = useProject();
  const [data, setData] = useState<DailyMixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const supabase = createClient();
  const { fetchBookmarks, addBookmark, removeBookmark, isBookmarked } = useBookmarkStore();

  const loadDailyMix = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await fetch(`/api/reddit/daily-mix?projectId=${project.id}`);
      const json = await res.json();
      if (json.error) {
        toast.error(json.error);
      } else {
        setData(json);
        if (isRefresh) toast.success('Feed refreshed!');
      }
    } catch {
      toast.error('Failed to load feed');
    }

    setLoading(false);
    setRefreshing(false);
  }, [project.id]);

  useEffect(() => {
    loadDailyMix();
    fetchBookmarks();
  }, [loadDailyMix, fetchBookmarks]);

  async function handleUsePost(post: RedditPost) {
    const { error } = await supabase.from('discovered_posts').insert({
      project_id: project.id,
      subreddit_name: post.subreddit,
      reddit_id: post.id,
      title: post.title,
      body: post.selftext || null,
      author: post.author,
      score: post.score,
      num_comments: post.num_comments,
      url: post.url,
      permalink: post.permalink,
      created_utc: post.created_utc,
    });

    if (error) {
      // Might be duplicate, that's okay
    }

    const { data: canvasData } = await supabase
      .from('canvas_states')
      .select('*')
      .eq('project_id', project.id)
      .single();

    if (canvasData) {
      const existingNodes = canvasData.nodes || [];
      const nodeId = `example-${post.id}`;

      if (existingNodes.find((n: { id: string }) => n.id === nodeId)) {
        toast.info('This post is already on the canvas');
        return;
      }

      const exampleCount = existingNodes.filter(
        (n: { data: { type: string } }) => n.data?.type === 'example-post'
      ).length;

      const newNode = {
        id: nodeId,
        type: 'example-post',
        position: { x: 800, y: 50 + exampleCount * 220 },
        data: {
          type: 'example-post',
          redditId: post.id,
          title: post.title,
          body: post.selftext || null,
          author: post.author,
          score: post.score,
          numComments: post.num_comments,
          subreddit: post.subreddit,
          permalink: post.permalink,
          selected: false,
        },
      };

      await supabase
        .from('canvas_states')
        .update({ nodes: [...existingNodes, newNode] })
        .eq('project_id', project.id);
    }

    toast.success('Post added to project canvas!');
  }

  async function handleToggleBookmark(post: RedditPost) {
    if (isBookmarked(post.id)) {
      await removeBookmark(post.id);
      toast.success('Bookmark removed');
    } else {
      await addBookmark(post);
      toast.success('Post bookmarked!');
    }
  }

  const filteredFeed = data?.feed.filter((p) =>
    activeFilter === 'all' ? true : p.subreddit.toLowerCase() === activeFilter.toLowerCase()
  ) ?? [];

  return (
    <PageTransition>
      <div className="flex h-full flex-col">
        <Header title="Your Feed" />
        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-4xl p-6 space-y-6">

            {/* Pill filter bar */}
            <div className="flex items-center gap-2 flex-wrap">
              <motion.div
                variants={staggerContainerVariants}
                initial="hidden"
                animate="visible"
                className="flex flex-wrap gap-2 flex-1"
              >
                <motion.div variants={staggerItemVariants}>
                  <Button
                    variant={activeFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setActiveFilter('all')}
                  >
                    All
                  </Button>
                </motion.div>
                {(data?.trackedSubreddits ?? []).map((sub) => (
                  <motion.div key={sub} variants={staggerItemVariants}>
                    <Button
                      variant={activeFilter.toLowerCase() === sub.toLowerCase() ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setActiveFilter(sub)}
                    >
                      r/{sub}
                    </Button>
                  </motion.div>
                ))}
              </motion.div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => loadDailyMix(true)}
                disabled={refreshing}
              >
                {refreshing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                Refresh
              </Button>
            </div>

            {/* Loading state */}
            {loading ? (
              <div className="space-y-6">
                <div>
                  <Skeleton className="h-6 w-32 mb-3" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-40 rounded-xl" />
                    ))}
                  </div>
                </div>
                <div>
                  <Skeleton className="h-6 w-32 mb-3" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={`d-${i}`} className="h-40 rounded-xl" />
                    ))}
                  </div>
                </div>
              </div>
            ) : data?.empty ? (
              /* Empty state */
              <div className="py-16 text-center">
                <Rss className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
                <h3 className="text-lg font-semibold">No subreddits tracked yet</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Add subreddits to your project to see your personalized feed.
                </p>
              </div>
            ) : (
              <>
                {/* Your Feed section */}
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Rss className="h-4 w-4 text-orange-500" />
                    <h2 className="text-lg font-semibold">For You</h2>
                    <span className="text-sm text-muted-foreground">
                      {filteredFeed.length} posts
                    </span>
                  </div>

                  {filteredFeed.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">
                      No posts match this filter.
                    </p>
                  ) : (
                    <StaggerList className="columns-1 md:columns-2 gap-3 space-y-3">
                      {filteredFeed.map((post) => (
                        <StaggerItem key={post.id} className="break-inside-avoid">
                          <PostCard
                            post={post}
                            onUsePost={handleUsePost}
                            isBookmarked={isBookmarked(post.id)}
                            onToggleBookmark={handleToggleBookmark}
                          />
                        </StaggerItem>
                      ))}
                    </StaggerList>
                  )}
                </section>

                {/* Discover section */}
                {(data?.discover ?? []).length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <Compass className="h-4 w-4 text-blue-500" />
                      <h2 className="text-lg font-semibold">Discover</h2>
                      <span className="text-sm text-muted-foreground">
                        Trending in communities you don&apos;t track yet
                      </span>
                    </div>

                    <StaggerList className="columns-1 md:columns-2 gap-3 space-y-3">
                      {(data?.discover ?? []).map((post) => (
                        <StaggerItem key={post.id} className="break-inside-avoid">
                          <div className="relative">
                            <div className="absolute top-2 right-2 z-10">
                              <Badge variant="secondary" className="text-[10px]">
                                r/{post.subreddit}
                              </Badge>
                            </div>
                            <PostCard
                              post={post}
                              onUsePost={handleUsePost}
                              isBookmarked={isBookmarked(post.id)}
                              onToggleBookmark={handleToggleBookmark}
                            />
                          </div>
                        </StaggerItem>
                      ))}
                    </StaggerList>
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
