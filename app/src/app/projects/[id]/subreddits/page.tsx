'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowUpRight, ChevronDown, Clock, ExternalLink,
  Globe, Loader2, MessageSquare, RefreshCw, Search, Sparkles, Trash2, Users,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { PageTransition, StaggerList, StaggerItem } from '@/components/motion';
import { useProject } from '@/contexts/project-context';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { SuggestedSubreddit } from '@/lib/ai/prompts';
import type { RedditPost } from '@/types';

interface TrackedSub {
  id: string;
  name: string;
  subscribers: number | null;
  description: string | null;
}

interface SearchResult {
  name: string;
  subscribers: number;
  description: string;
}

const matchColors: Record<string, string> = {
  best: 'bg-green-500/10 text-green-600 border-green-500/20',
  good: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  relevant: 'bg-muted text-muted-foreground border-border',
};

const matchLabels: Record<string, string> = {
  best: 'Best match',
  good: 'Good match',
  relevant: 'Relevant',
};

function formatSubscribers(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

function timeAgo(timestamp: number) {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(timestamp * 1000).toLocaleDateString();
}

type SortOption = 'hot' | 'top' | 'rising' | 'new';
type TimeFilter = 'day' | 'week' | 'month';

function SubredditFeed({ subName, projectId }: { subName: string; projectId: string }) {
  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [sort, setSort] = useState<SortOption>('top');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('day');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const seenIds = useRef(new Set<string>());

  const fetchPage = useCallback(async (pageNum: number, sortVal: SortOption, timeVal: TimeFilter, isReset: boolean) => {
    if (isReset) {
      setLoading(true);
      seenIds.current = new Set();
    } else {
      setLoadingMore(true);
    }

    try {
      const params = new URLSearchParams({
        projectId,
        sort: sortVal,
        t: timeVal,
        page: String(pageNum),
        sub: subName,
      });
      const res = await fetch(`/api/reddit/feed?${params}`);
      const json = await res.json();

      if (!json.error) {
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
      }
    } catch {
      if (isReset) setPosts([]);
    }

    setLoading(false);
    setLoadingMore(false);
  }, [projectId, subName]);

  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    fetchPage(0, sort, timeFilter, true);
  }, [fetchPage, sort, timeFilter]);

  function handleSortChange(newSort: SortOption) {
    setSort(newSort);
    setPage(0);
    fetchPage(0, newSort, timeFilter, true);
  }

  function handleTimeChange(newTime: TimeFilter) {
    setTimeFilter(newTime);
    setPage(0);
    fetchPage(0, sort, newTime, true);
  }

  function handleLoadMore() {
    if (loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPage(nextPage, sort, timeFilter, false);
  }

  return (
    <div className="border-t">
      {/* Sort controls */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b bg-muted/30">
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
          onClick={() => { setPage(0); fetchPage(0, sort, timeFilter, true); }}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        </Button>
      </div>

      {/* Posts */}
      {loading ? (
        <div className="p-3 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-48" />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">No posts found</p>
      ) : (
        <div>
          {posts.map((post) => (
            <div key={post.id} className="border-b border-border/50 last:border-b-0 px-3 py-2.5 space-y-1.5">
              {/* Author + time */}
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="text-muted-foreground">u/{post.author}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground flex items-center gap-0.5">
                  <Clock className="h-2.5 w-2.5" />
                  {timeAgo(post.created_utc)}
                </span>
              </div>
              {/* Title */}
              <h4 className="text-sm font-medium leading-snug">{post.title}</h4>
              {post.link_flair_text && (
                <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
                  {post.link_flair_text}
                </span>
              )}
              {/* Body preview */}
              {post.selftext && (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{post.selftext}</p>
              )}
              {/* Stats */}
              <div className="flex items-center gap-3 pt-0.5">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ArrowUpRight className="h-3.5 w-3.5 text-orange-500" />
                  <span className="font-medium">{formatNumber(post.score)}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>{formatNumber(post.num_comments)}</span>
                </div>
                <a
                  href={`https://reddit.com${post.permalink}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto"
                >
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5 gap-1">
                    <ExternalLink className="h-3 w-3" />
                    Open
                  </Button>
                </a>
              </div>
            </div>
          ))}

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center py-3">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : null}
                Load more
              </Button>
            </div>
          )}

          {!hasMore && posts.length > 0 && (
            <p className="text-[10px] text-muted-foreground text-center py-3">No more posts</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function SubredditsPage() {
  const { project } = useProject();

  const [trackedSubs, setTrackedSubs] = useState<TrackedSub[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSub, setExpandedSub] = useState<string | null>(null);

  // Search state
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // AI suggestion state
  const [aiSuggestions, setAiSuggestions] = useState<SuggestedSubreddit[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(false);
  const [aiFetched, setAiFetched] = useState(false);

  // Load tracked subreddits + refetch on window focus
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('subreddits')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: true });

      if (error) {
        toast.error('Failed to load subreddits');
      } else {
        setTrackedSubs(data || []);
      }
      setLoading(false);
    }
    load();

    function handleFocus() { load(); }
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [project.id]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    const query = searchInput.trim().replace(/^r\//, '');
    if (query.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/reddit/search-subreddits?q=${encodeURIComponent(query)}`);
        const json = await res.json();
        if (json.subreddits) {
          setSearchResults(json.subreddits);
          setShowDropdown(true);
        }
      } catch {
        setSearchResults([]);
      }
      setSearchLoading(false);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchInput]);

  async function handleAddFromSearch(result: SearchResult) {
    const alreadyExists = trackedSubs.some((s) => s.name.toLowerCase() === result.name.toLowerCase());
    if (alreadyExists) return;

    const supabase = createClient();
    const { data, error } = await supabase
      .from('subreddits')
      .insert({
        project_id: project.id,
        name: result.name,
        subscribers: result.subscribers,
        description: result.description,
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to add subreddit');
      return;
    }

    setTrackedSubs((prev) => [...prev, data]);
    setSearchInput('');
    setShowDropdown(false);
    setSearchResults([]);
    toast.success(`r/${result.name} added`);
  }

  async function handleAddAiSuggestion(suggestion: SuggestedSubreddit) {
    const alreadyExists = trackedSubs.some((s) => s.name.toLowerCase() === suggestion.name.toLowerCase());
    if (alreadyExists) return;

    const supabase = createClient();
    const { data, error } = await supabase
      .from('subreddits')
      .insert({
        project_id: project.id,
        name: suggestion.name,
        subscribers: null,
        description: suggestion.reason || null,
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to add subreddit');
      return;
    }

    setTrackedSubs((prev) => [...prev, data]);
    setAiSuggestions((prev) => prev.filter((s) => s.name !== suggestion.name));
    toast.success(`r/${suggestion.name} added`);
  }

  async function handleRemove(sub: TrackedSub) {
    const supabase = createClient();
    const { error } = await supabase.from('subreddits').delete().eq('id', sub.id);

    if (error) {
      toast.error('Failed to remove subreddit');
      return;
    }

    setTrackedSubs((prev) => prev.filter((s) => s.id !== sub.id));
    toast.success(`r/${sub.name} removed`);
  }

  async function fetchAiSuggestions() {
    setAiLoading(true);
    setAiError(false);
    try {
      const existingSubreddits = trackedSubs.map((s) => s.name);
      const res = await fetch('/api/ai/suggest-subreddits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: project.product_name,
          description: project.product_description,
          url: project.product_url || undefined,
          audience: project.target_audience || undefined,
          tone: project.tone,
          existingSubreddits: existingSubreddits.length > 0 ? existingSubreddits : undefined,
        }),
      });
      const json = await res.json();
      if (json.subreddits) {
        const existingNames = new Set(trackedSubs.map((s) => s.name.toLowerCase()));
        const newSuggestions = json.subreddits.filter(
          (s: SuggestedSubreddit) => !existingNames.has(s.name.toLowerCase())
        );
        setAiSuggestions(newSuggestions);
      }
    } catch {
      setAiError(true);
    }
    setAiLoading(false);
    setAiFetched(true);
  }

  return (
    <PageTransition>
      <div className="flex h-full flex-col">
        <Header title="Subreddits" />
        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-2xl p-6 space-y-6">
            {/* Header with count */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Manage Subreddits</h2>
                <p className="text-sm text-muted-foreground">
                  {trackedSubs.length} subreddit{trackedSubs.length !== 1 ? 's' : ''} tracked
                </p>
              </div>
            </div>

            {/* Search bar */}
            <div className="relative" ref={dropdownRef}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
                  placeholder="Search for a subreddit to add..."
                  className="pl-9"
                />
                {searchLoading && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>

              {showDropdown && searchResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-xl border bg-card shadow-lg overflow-hidden">
                  {searchResults.map((result) => {
                    const alreadyAdded = trackedSubs.some((s) => s.name.toLowerCase() === result.name.toLowerCase());
                    return (
                      <button
                        key={result.name}
                        onClick={() => handleAddFromSearch(result)}
                        disabled={alreadyAdded}
                        className={`w-full text-left px-3 py-2.5 transition-colors border-b last:border-b-0 ${
                          alreadyAdded
                            ? 'opacity-50 cursor-default'
                            : 'hover:bg-muted/50 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">r/{result.name}</span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Users className="h-3 w-3" />
                            {formatSubscribers(result.subscribers)}
                          </span>
                        </div>
                        {result.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{result.description}</p>
                        )}
                        {alreadyAdded && (
                          <span className="text-[10px] text-orange-500 font-medium">Already added</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* AI suggestion button */}
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={fetchAiSuggestions}
              disabled={aiLoading}
            >
              {aiLoading ? (
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-3 w-3" />
              )}
              {aiFetched ? 'Suggest more with AI' : 'Suggest subreddits with AI'}
            </Button>

            {/* AI error */}
            {aiError && !aiLoading && (
              <div className="flex items-center gap-2 text-sm text-yellow-600">
                <AlertTriangle className="h-4 w-4" />
                <span>Couldn&apos;t fetch AI suggestions.</span>
                <Button variant="outline" size="sm" className="h-6 text-xs" onClick={fetchAiSuggestions}>
                  Retry
                </Button>
              </div>
            )}

            {/* AI suggestions */}
            {aiFetched && !aiLoading && aiSuggestions.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3 w-3 text-orange-500" />
                  <span className="text-xs font-medium text-muted-foreground">AI Suggestions</span>
                </div>
                {aiSuggestions.map((suggestion) => (
                  <Card
                    key={suggestion.name}
                    className="cursor-pointer transition-shadow hover:shadow-md"
                    onClick={() => handleAddAiSuggestion(suggestion)}
                  >
                    <CardContent className="px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">r/{suggestion.name}</span>
                            <Badge variant="outline" className={`text-[10px] h-5 ${matchColors[suggestion.match]}`}>
                              {matchLabels[suggestion.match]}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{suggestion.reason}</p>
                          {suggestion.approach && (
                            <p className="text-xs text-muted-foreground/70 mt-0.5 italic">{suggestion.approach}</p>
                          )}
                        </div>
                        <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-muted-foreground/30 text-muted-foreground hover:bg-accent">
                          <span className="text-xs">+</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Tracked subreddits list */}
            {loading ? (
              <div className="py-12 text-center text-muted-foreground">Loading subreddits...</div>
            ) : trackedSubs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 mb-4">
                  <Globe className="h-6 w-6" />
                </div>
                <p className="font-medium">No subreddits yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Search above or use AI suggestions to add subreddits to your project.
                </p>
              </div>
            ) : (
              <StaggerList className="space-y-2">
                {trackedSubs.map((sub) => {
                  const isExpanded = expandedSub === sub.name;
                  return (
                    <StaggerItem key={sub.id}>
                      <Card className="overflow-hidden">
                        <CardContent className="p-0">
                          <div
                            role="button"
                            tabIndex={0}
                            className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => setExpandedSub(isExpanded ? null : sub.name)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedSub(isExpanded ? null : sub.name); } }}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`} />
                                <span className="font-medium text-sm">r/{sub.name}</span>
                                {sub.subscribers && (
                                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Users className="h-3 w-3" />
                                    {formatSubscribers(sub.subscribers)}
                                  </span>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                                onClick={(e) => { e.stopPropagation(); handleRemove(sub); }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            {sub.description && !isExpanded && (
                              <p className="text-xs text-muted-foreground mt-0.5 ml-5.5 line-clamp-1">{sub.description}</p>
                            )}
                          </div>
                          {isExpanded && (
                            <SubredditFeed subName={sub.name} projectId={project.id} />
                          )}
                        </CardContent>
                      </Card>
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
