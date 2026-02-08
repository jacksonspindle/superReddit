'use client';

import { useState, useEffect } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { Header } from '@/components/layout/header';
import { PostCard } from '@/components/inspiration/PostCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { PageTransition } from '@/components/motion';
import { StaggerList, StaggerItem } from '@/components/motion';
import { staggerContainerVariants, staggerItemVariants } from '@/lib/motion';
import type { RedditPost, Project } from '@/types';
import { toast } from 'sonner';

const POPULAR_SUBREDDITS = ['SaaS', 'startups', 'Entrepreneur', 'smallbusiness', 'webdev', 'programming', 'marketing', 'growmybusiness'];

type SortOption = 'hot' | 'top' | 'rising' | 'new';
type TimeFilter = 'day' | 'week' | 'month' | 'year' | 'all';

export default function InspirationPage() {
  const [subreddit, setSubreddit] = useState('SaaS');
  const [inputValue, setInputValue] = useState('SaaS');
  const [sort, setSort] = useState<SortOption>('top');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('week');
  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  const supabase = createClient();

  useEffect(() => {
    fetchPosts();
    loadProjects();
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [subreddit, sort, timeFilter]);

  async function loadProjects() {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .order('updated_at', { ascending: false });
    setProjects(data || []);
    if (data && data.length > 0) {
      setSelectedProjectId(data[0].id);
    }
  }

  async function fetchPosts() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/reddit?subreddit=${subreddit}&sort=${sort}&t=${timeFilter}&limit=25`
      );
      const json = await res.json();
      if (json.error) {
        toast.error(json.error);
        setPosts([]);
      } else {
        setPosts(json.posts || []);
      }
    } catch {
      toast.error('Failed to fetch posts');
      setPosts([]);
    }
    setLoading(false);
  }

  function handleSearch() {
    const clean = inputValue.trim().replace(/^r\//, '');
    if (clean) {
      setSubreddit(clean);
    }
  }

  async function handleUsePost(post: RedditPost) {
    if (!selectedProjectId) {
      toast.error('Select a project first');
      return;
    }

    // Save to discovered_posts and add to canvas
    const { error } = await supabase.from('discovered_posts').insert({
      project_id: selectedProjectId,
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

    // Add as ExamplePostNode on canvas
    const { data: canvasData } = await supabase
      .from('canvas_states')
      .select('*')
      .eq('project_id', selectedProjectId)
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
        .eq('project_id', selectedProjectId);
    }

    toast.success('Post added to project canvas!');
  }

  return (
    <PageTransition>
      <div className="flex h-full flex-col">
        <Header title="Inspiration" />
        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-4xl p-6 space-y-6">
            {/* Search bar */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Enter subreddit name..."
                  className="pl-9"
                />
              </div>
              <Button onClick={handleSearch}>Browse</Button>
            </div>

            {/* Quick subreddit chips */}
            <motion.div
              variants={staggerContainerVariants}
              initial="hidden"
              animate="visible"
              className="flex flex-wrap gap-2"
            >
              {POPULAR_SUBREDDITS.map((sub) => (
                <motion.div key={sub} variants={staggerItemVariants}>
                  <Button
                    variant={subreddit === sub ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      setSubreddit(sub);
                      setInputValue(sub);
                    }}
                  >
                    r/{sub}
                  </Button>
                </motion.div>
              ))}
            </motion.div>

            {/* Filters row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tabs value={sort} onValueChange={(v) => setSort(v as SortOption)}>
                  <TabsList className="h-8">
                    <TabsTrigger value="hot" className="text-xs px-3 h-6">Hot</TabsTrigger>
                    <TabsTrigger value="top" className="text-xs px-3 h-6">Top</TabsTrigger>
                    <TabsTrigger value="rising" className="text-xs px-3 h-6">Rising</TabsTrigger>
                    <TabsTrigger value="new" className="text-xs px-3 h-6">New</TabsTrigger>
                  </TabsList>
                </Tabs>

                {sort === 'top' && (
                  <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as TimeFilter)}>
                    <SelectTrigger className="h-8 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">Today</SelectItem>
                      <SelectItem value="week">This Week</SelectItem>
                      <SelectItem value="month">This Month</SelectItem>
                      <SelectItem value="year">This Year</SelectItem>
                      <SelectItem value="all">All Time</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="h-8 w-56 text-xs">
                  <SelectValue placeholder="Add to project..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                  {projects.length === 0 && (
                    <SelectItem value="__none" disabled>No projects yet</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Subreddit header */}
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">r/{subreddit}</h2>
              <span className="text-sm text-muted-foreground">
                {posts.length} posts loaded
              </span>
            </div>

            {/* Posts list */}
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-32 rounded-xl" />
                ))}
              </div>
            ) : posts.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                No posts found. Try a different subreddit or filter.
              </div>
            ) : (
              <StaggerList className="space-y-3">
                {posts.map((post) => (
                  <StaggerItem key={post.id}>
                    <PostCard
                      post={post}
                      onUsePost={selectedProjectId ? handleUsePost : undefined}
                    />
                  </StaggerItem>
                ))}
              </StaggerList>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
