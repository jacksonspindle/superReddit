'use client';

import { useState, useEffect } from 'react';
import { Search, Loader2, Users, ArrowLeft, Globe } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { CompactPostCard } from '@/components/create/CompactPostCard';
import { useCreateStore } from '@/stores/create-store';
import type { RedditPost } from '@/types';
import { toast } from 'sonner';

interface SubredditResult {
  name: string;
  subscribers: number;
  description: string;
}

type SortOption = 'hot' | 'top' | 'rising' | 'new';

function formatSubs(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

export function InspirationPanel() {
  const [query, setQuery] = useState('');
  const [subreddits, setSubreddits] = useState<SubredditResult[]>([]);
  const [searchingSubreddits, setSearchingSubreddits] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [selectedSub, setSelectedSub] = useState<SubredditResult | null>(null);
  const [sort, setSort] = useState<SortOption>('top');
  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);

  // Global search state (AI-triggered)
  const [isGlobalSearch, setIsGlobalSearch] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');

  const { usePost, referencePosts, pendingSearch, setPendingSearch } = useCreateStore();
  const usedIds = new Set(referencePosts.map((r) => r.id));

  // Watch for pending search actions from the AI chat
  useEffect(() => {
    if (!pendingSearch) return;

    const search = pendingSearch;
    setPendingSearch(null);

    if (search.subreddit) {
      // Search within a specific subreddit
      setQuery(search.query);
      setIsGlobalSearch(false);
      const sub: SubredditResult = { name: search.subreddit, subscribers: 0, description: '' };
      setSelectedSub(sub);
      executeSubredditSearch(sub, search.query, search.sort || 'hot', search.timeFilter || 'week');
    } else {
      // Global search
      setQuery(search.query);
      setSelectedSub(null);
      executeGlobalSearch(search.query, search.sort || 'hot', search.timeFilter || 'week');
    }
  }, [pendingSearch]);

  async function executeGlobalSearch(q: string, sortParam?: string, timeFilter?: string) {
    setLoadingPosts(true);
    setIsGlobalSearch(true);
    setGlobalSearchQuery(q);
    setSelectedSub(null);
    setSubreddits([]);
    setHasSearched(true);

    const params = new URLSearchParams({ q, limit: '20' });
    if (sortParam) params.set('sort', sortParam);
    if (timeFilter) params.set('t', timeFilter);

    try {
      const res = await fetch(`/api/reddit/search?${params}`);
      const json = await res.json();
      if (json.error) {
        toast.error(json.error);
        setPosts([]);
      } else {
        setPosts(json.posts || []);
        if ((json.posts || []).length === 0) {
          toast.info('No posts found for that search');
        }
      }
    } catch {
      toast.error('Search failed');
      setPosts([]);
    }

    setLoadingPosts(false);
  }

  async function executeSubredditSearch(sub: SubredditResult, q: string, sortParam: string, timeFilter: string) {
    setLoadingPosts(true);

    try {
      const res = await fetch(
        `/api/reddit?subreddit=${sub.name}&q=${encodeURIComponent(q)}&sort=${sortParam}&t=${timeFilter}&limit=20`
      );
      const json = await res.json();
      if (json.error) {
        toast.error(json.error);
        setPosts([]);
      } else {
        setPosts(json.posts || []);
      }
    } catch {
      toast.error('Failed to load posts');
      setPosts([]);
    }

    setLoadingPosts(false);
  }

  async function handleSearch() {
    const q = query.trim();
    if (!q || q.length < 2) return;

    setSearchingSubreddits(true);
    setHasSearched(true);
    setSelectedSub(null);
    setIsGlobalSearch(false);
    setPosts([]);

    try {
      const res = await fetch(`/api/reddit/search-subreddits?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      setSubreddits(json.subreddits || []);
      if ((json.subreddits || []).length === 0) {
        toast.info('No subreddits found for that query');
      }
    } catch {
      toast.error('Search failed');
      setSubreddits([]);
    }

    setSearchingSubreddits(false);
  }

  async function selectSubreddit(sub: SubredditResult, sortOverride?: SortOption) {
    setSelectedSub(sub);
    setIsGlobalSearch(false);
    setLoadingPosts(true);

    const useSort = sortOverride ?? sort;
    try {
      const res = await fetch(
        `/api/reddit?subreddit=${sub.name}&sort=${useSort}&t=week&limit=20`
      );
      const json = await res.json();
      if (json.error) {
        toast.error(json.error);
        setPosts([]);
      } else {
        setPosts(json.posts || []);
      }
    } catch {
      toast.error('Failed to load posts');
      setPosts([]);
    }

    setLoadingPosts(false);
  }

  function handleSortChange(newSort: SortOption) {
    setSort(newSort);
    if (selectedSub) selectSubreddit(selectedSub, newSort);
  }

  function handleBack() {
    if (isGlobalSearch) {
      setIsGlobalSearch(false);
      setPosts([]);
    } else {
      setSelectedSub(null);
      setPosts([]);
    }
  }

  // Show posts view when we have a selected subreddit OR global search results
  const showPostsView = selectedSub || isGlobalSearch;

  return (
    <div className="flex flex-col h-full">
      {/* Search bar — always visible */}
      <div className="p-3 space-y-2 border-b">
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search subreddits about..."
              className="pl-8 h-8 text-xs"
            />
          </div>
          <Button
            onClick={handleSearch}
            size="sm"
            className="h-8 text-xs"
            disabled={searchingSubreddits || query.trim().length < 2}
          >
            {searchingSubreddits ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Search'}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {/* State: showing posts (subreddit or global search) */}
        {showPostsView ? (
          <div className="flex flex-col h-full">
            <div className="p-2 space-y-2 border-b">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={handleBack}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
                <div className="flex-1 min-w-0">
                  {isGlobalSearch ? (
                    <div className="flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5 text-blue-500" />
                      <span className="text-xs font-semibold">Search: &quot;{globalSearchQuery}&quot;</span>
                    </div>
                  ) : selectedSub && (
                    <>
                      <span className="text-xs font-semibold">r/{selectedSub.name}</span>
                      <span className="text-[10px] text-muted-foreground ml-1.5">
                        {selectedSub.subscribers > 0 ? `${formatSubs(selectedSub.subscribers)} members` : ''}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {!isGlobalSearch && (
                <Tabs value={sort} onValueChange={(v) => handleSortChange(v as SortOption)}>
                  <TabsList className="h-7 w-full">
                    <TabsTrigger value="hot" className="text-[10px] px-2 h-5 flex-1">Hot</TabsTrigger>
                    <TabsTrigger value="top" className="text-[10px] px-2 h-5 flex-1">Top</TabsTrigger>
                    <TabsTrigger value="rising" className="text-[10px] px-2 h-5 flex-1">Rising</TabsTrigger>
                    <TabsTrigger value="new" className="text-[10px] px-2 h-5 flex-1">New</TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
            </div>

            <div className="flex-1 overflow-auto p-2 space-y-2">
              {loadingPosts ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-lg" />
                ))
              ) : posts.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No posts found</p>
              ) : (
                posts.map((post) => (
                  <CompactPostCard
                    key={post.id}
                    post={post}
                    onUse={usePost}
                    isUsed={usedIds.has(post.id)}
                  />
                ))
              )}
            </div>
          </div>
        ) : (
          /* State: subreddit results or empty */
          <div className="p-2 space-y-1.5">
            {searchingSubreddits ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))
            ) : subreddits.length > 0 ? (
              subreddits.map((sub) => (
                <button
                  key={sub.name}
                  onClick={() => selectSubreddit(sub)}
                  className="w-full text-left rounded-lg border p-2.5 hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center h-7 w-7 rounded-full bg-muted shrink-0">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs font-semibold">r/{sub.name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatSubs(sub.subscribers)} members
                        </span>
                      </div>
                      {sub.description && (
                        <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">
                          {sub.description}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))
            ) : !hasSearched ? (
              <div className="flex flex-col items-center py-10 text-center px-4">
                <Search className="h-8 w-8 text-muted-foreground/40 mb-3" />
                <p className="text-xs font-medium text-muted-foreground">
                  Search for a niche or topic
                </p>
                <p className="text-[10px] text-muted-foreground/70 mt-1">
                  e.g. &quot;One Piece trading cards&quot;, &quot;indie game dev&quot;, &quot;home automation&quot;
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center py-10 text-center px-4">
                <p className="text-xs text-muted-foreground">No subreddits found</p>
                <p className="text-[10px] text-muted-foreground/70 mt-1">
                  Try a different search term
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
