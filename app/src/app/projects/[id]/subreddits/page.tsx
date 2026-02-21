'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Globe, Loader2, Search, Sparkles, Trash2, Users, X } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PageTransition, StaggerList, StaggerItem } from '@/components/motion';
import { useProject } from '@/contexts/project-context';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { SuggestedSubreddit } from '@/lib/ai/prompts';

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

export default function SubredditsPage() {
  const { project } = useProject();

  const [trackedSubs, setTrackedSubs] = useState<TrackedSub[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Load tracked subreddits
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
                    <CardContent className="p-3">
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
                {trackedSubs.map((sub) => (
                  <StaggerItem key={sub.id}>
                    <Card>
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">r/{sub.name}</span>
                              {sub.subscribers && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Users className="h-3 w-3" />
                                  {formatSubscribers(sub.subscribers)}
                                </span>
                              )}
                            </div>
                            {sub.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{sub.description}</p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemove(sub)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
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
