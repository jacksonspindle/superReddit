'use client';

import { useState, useEffect, useCallback } from 'react';
import { Pen, BookOpen } from 'lucide-react';
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
import { WRITING_STYLES } from '@/lib/viral-library/styles';
import type { RedditPost } from '@/types';
import { toast } from 'sonner';

export default function ViralLibraryPage() {
  const project = useProject();
  const [activeTab, setActiveTab] = useState<string>('all');
  const [livePostsByStyle, setLivePostsByStyle] = useState<Record<string, RedditPost[]>>({});
  const [loadingStyles, setLoadingStyles] = useState<Set<string>>(new Set());

  const supabase = createClient();
  const { fetchBookmarks, addBookmark, removeBookmark, isBookmarked } = useBookmarkStore();

  const userStyles = new Set(project.writing_styles ?? []);

  const loadStylePosts = useCallback(
    async (styleKey: string) => {
      // If already cached, skip
      if (styleKey === 'all') {
        const allLoaded = WRITING_STYLES.every((s) => livePostsByStyle[s.id]);
        if (allLoaded) return;
      } else if (livePostsByStyle[styleKey]) {
        return;
      }

      setLoadingStyles((prev) => new Set(prev).add(styleKey));

      try {
        const res = await fetch(`/api/reddit/viral-library?style=${styleKey}`);
        const json = await res.json();
        if (json.postsByStyle) {
          setLivePostsByStyle((prev) => ({ ...prev, ...json.postsByStyle }));
        }
      } catch {
        toast.error('Failed to load posts');
      }

      setLoadingStyles((prev) => {
        const next = new Set(prev);
        next.delete(styleKey);
        return next;
      });
    },
    [livePostsByStyle]
  );

  useEffect(() => {
    loadStylePosts('all');
    fetchBookmarks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTabChange(styleId: string) {
    setActiveTab(styleId);
    loadStylePosts(styleId === 'all' ? 'all' : styleId);
  }

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

  // Build the list of style sections to render
  const visibleStyles =
    activeTab === 'all'
      ? WRITING_STYLES
      : WRITING_STYLES.filter((s) => s.id === activeTab);

  return (
    <PageTransition>
      <div className="flex h-full flex-col">
        <Header title="Viral Library" />
        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-4xl p-6 space-y-6">
            {/* Style pill bar */}
            <motion.div
              variants={staggerContainerVariants}
              initial="hidden"
              animate="visible"
              className="flex flex-wrap gap-2"
            >
              <motion.div variants={staggerItemVariants}>
                <Button
                  variant={activeTab === 'all' ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => handleTabChange('all')}
                >
                  All
                </Button>
              </motion.div>
              {WRITING_STYLES.map((style) => (
                <motion.div key={style.id} variants={staggerItemVariants}>
                  <Button
                    variant={activeTab === style.id ? 'default' : 'outline'}
                    size="sm"
                    className={`h-7 text-xs ${
                      userStyles.has(style.id)
                        ? 'ring-1 ring-orange-500/50'
                        : ''
                    }`}
                    onClick={() => handleTabChange(style.id)}
                  >
                    {style.name}
                  </Button>
                </motion.div>
              ))}
            </motion.div>

            {/* Per-style sections */}
            {visibleStyles.map((style) => {
              const seedPosts = style.seedPosts;
              const livePosts = livePostsByStyle[style.id] ?? [];
              const styleLoading =
                activeTab === 'all' ? loadingStyles.has('all') : loadingStyles.has(style.id);

              return (
                <section key={style.id}>
                  {/* Section header */}
                  <div className="flex items-center gap-2 mb-3">
                    <Pen className="h-4 w-4 text-orange-500" />
                    <h2 className="text-lg font-semibold">{style.name}</h2>
                    {userStyles.has(style.id) && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] bg-orange-500/10 text-orange-600 border-orange-500/20"
                      >
                        Your style
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    {style.description}
                  </p>

                  {/* Posts grid: seed posts always visible, live posts load in */}
                  <StaggerList className="columns-1 md:columns-2 gap-3 space-y-3">
                    {seedPosts.map((post) => (
                      <StaggerItem key={post.id} className="break-inside-avoid">
                        <div className="relative">
                          <div className="absolute top-2 right-2 z-10">
                            <Badge
                              variant="secondary"
                              className="text-[10px] bg-orange-500/10 text-orange-600 border-orange-500/20"
                            >
                              Example
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

                    {livePosts.map((post) => (
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

                  {/* Loading skeletons for live posts */}
                  {styleLoading && (
                    <div className="columns-1 md:columns-2 gap-3 space-y-3 mt-3">
                      {[1, 2, 3, 4].map((i) => (
                        <Skeleton
                          key={`skel-${style.id}-${i}`}
                          className="h-40 rounded-xl break-inside-avoid"
                        />
                      ))}
                    </div>
                  )}

                  {/* Empty state for live section */}
                  {!styleLoading && livePosts.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      No additional live posts found for this style.
                    </p>
                  )}
                </section>
              );
            })}

            {/* Global empty state */}
            {visibleStyles.length === 0 && (
              <div className="py-16 text-center">
                <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
                <h3 className="text-lg font-semibold">No styles found</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Select a writing style tab to browse viral posts.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
