'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, AlertTriangle, Loader2, Search, Sparkles, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { SuggestedSubreddit } from '@/lib/ai/prompts';

interface SearchResult {
  name: string;
  subscribers: number;
  description: string;
}

export interface AddedSubreddit {
  name: string;
  subscribers?: number;
  description?: string;
  match?: 'best' | 'good' | 'relevant';
  fromAI?: boolean;
  reason?: string;
  approach?: string;
}

interface SubredditsStepProps {
  productName: string;
  productDescription: string;
  productUrl: string;
  targetAudience: string;
  tone: string;
  addedSubs: AddedSubreddit[];
  onAddedSubsChange: (subs: AddedSubreddit[]) => void;
  aiSuggestions: SuggestedSubreddit[];
  onAiSuggestionsChange: (suggestions: SuggestedSubreddit[]) => void;
  aiFetched: boolean;
  onAiFetchedChange: (fetched: boolean) => void;
  onBack: () => void;
  onNext: () => void;
}

const matchColors = {
  best: 'bg-green-500/10 text-green-600 border-green-500/20',
  good: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  relevant: 'bg-muted text-muted-foreground border-border',
};

const matchLabels = {
  best: 'Best match',
  good: 'Good match',
  relevant: 'Relevant',
};

function formatSubscribers(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

export function SubredditsStep({
  productName,
  productDescription,
  productUrl,
  targetAudience,
  tone,
  addedSubs,
  onAddedSubsChange,
  aiSuggestions,
  onAiSuggestionsChange,
  aiFetched,
  onAiFetchedChange,
  onBack,
  onNext,
}: SubredditsStepProps) {
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(false);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Debounced search — tries server API first, falls back to client-side Reddit fetch
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
      let results: SearchResult[] = [];

      // 1. Try our server-side API
      try {
        const res = await fetch(`/api/reddit/search-subreddits?q=${encodeURIComponent(query)}`);
        const json = await res.json();
        if (json.subreddits && json.subreddits.length > 0) {
          results = json.subreddits;
        }
      } catch {
        // server route failed
      }

      // 2. Fallback: call Reddit directly from the browser (user's IP won't be blocked)
      if (results.length === 0) {
        try {
          const res = await fetch(
            `https://www.reddit.com/subreddits/search.json?q=${encodeURIComponent(query)}&limit=8&raw_json=1`,
            { headers: { Accept: 'application/json' } }
          );
          if (res.ok) {
            const json = await res.json();
            results = (json?.data?.children || []).map(
              (c: { data: Record<string, unknown> }) => ({
                name: c.data.display_name as string,
                subscribers: (c.data.subscribers as number) || 0,
                description: ((c.data.public_description as string) || '').slice(0, 120),
              })
            );
          }
        } catch {
          // client-side fallback also failed
        }
      }

      setSearchResults(results);
      if (results.length > 0) setShowDropdown(true);
      setSearchLoading(false);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchInput]);

  async function fetchAiSuggestions() {
    setAiLoading(true);
    setAiError(false);
    try {
      const existingSubreddits = addedSubs.map((s) => s.name);
      const res = await fetch('/api/ai/suggest-subreddits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: productName,
          description: productDescription,
          url: productUrl || undefined,
          audience: targetAudience || undefined,
          tone,
          existingSubreddits: existingSubreddits.length > 0 ? existingSubreddits : undefined,
        }),
      });
      const json = await res.json();
      if (json.subreddits) {
        // Filter out any that are already added
        const existingNames = new Set(addedSubs.map((s) => s.name.toLowerCase()));
        const newSuggestions = json.subreddits.filter(
          (s: SuggestedSubreddit) => !existingNames.has(s.name.toLowerCase())
        );
        onAiSuggestionsChange(newSuggestions);
      }
    } catch {
      setAiError(true);
    }
    setAiLoading(false);
    onAiFetchedChange(true);
  }

  function handleSelectSearchResult(result: SearchResult) {
    const alreadyExists = addedSubs.some((s) => s.name.toLowerCase() === result.name.toLowerCase());
    if (alreadyExists) return;

    const newSub: AddedSubreddit = {
      name: result.name,
      subscribers: result.subscribers,
      description: result.description,
    };
    onAddedSubsChange([...addedSubs, newSub]);

    setSearchInput('');
    setShowDropdown(false);
    setSearchResults([]);
  }

  function handleAddAiSuggestion(suggestion: SuggestedSubreddit) {
    const newSub: AddedSubreddit = {
      name: suggestion.name,
      match: suggestion.match,
      fromAI: true,
      reason: suggestion.reason,
      approach: suggestion.approach,
    };
    onAddedSubsChange([...addedSubs, newSub]);

    // Remove from AI suggestions list
    onAiSuggestionsChange(aiSuggestions.filter((s) => s.name !== suggestion.name));
  }

  function handleRemoveSub(name: string) {
    onAddedSubsChange(addedSubs.filter((s) => s.name !== name));
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      <h2 className="text-2xl font-bold tracking-tight">Choose Subreddits</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Search for subreddits where your target audience hangs out.
      </p>

      {/* Search input with autocomplete */}
      <div className="relative mt-4" ref={dropdownRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
            placeholder="Search for a subreddit..."
            className="pl-9 text-sm"
          />
          {searchLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {showDropdown && searchResults.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-xl border bg-card shadow-lg overflow-hidden">
            {searchResults.map((result) => {
              const alreadyAdded = addedSubs.some((s) => s.name.toLowerCase() === result.name.toLowerCase());
              return (
                <button
                  key={result.name}
                  onClick={() => handleSelectSearchResult(result)}
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

      {/* AI suggestions prompt */}
      {!aiFetched && !aiLoading && (
        <button
          onClick={fetchAiSuggestions}
          className="mt-2 text-xs text-orange-500 hover:text-orange-400 transition-colors"
        >
          <Sparkles className="inline h-3 w-3 mr-1 -mt-0.5" />
          Stuck? Let AI suggest subreddits for you
        </button>
      )}

      {/* Added subreddits list */}
      <div className="mt-4">
        {addedSubs.length === 0 && !aiFetched && !aiLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              Search for subreddits above to get started
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Add the communities where your target audience is most active
            </p>
          </div>
        ) : (
          <div className="h-72 overflow-y-auto pr-1">
            <div className="space-y-2">
              {/* User-added + AI-accepted subreddits */}
              {addedSubs.map((sub) => (
                <div
                  key={sub.name}
                  className="w-full text-left rounded-xl border border-orange-500 bg-orange-500/5 ring-1 ring-orange-500/20 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">r/{sub.name}</span>
                        {sub.subscribers && (
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Users className="h-2.5 w-2.5" />
                            {formatSubscribers(sub.subscribers)}
                          </span>
                        )}
                        {sub.match && (
                          <Badge variant="outline" className={`text-[10px] h-5 ${matchColors[sub.match]}`}>
                            {matchLabels[sub.match]}
                          </Badge>
                        )}
                      </div>
                      {sub.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{sub.description}</p>
                      )}
                      {sub.reason && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{sub.reason}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveSub(sub.name)}
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}

              {/* AI suggestions section */}
              {aiLoading && (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
                  <p className="text-sm text-muted-foreground">Finding more subreddits...</p>
                </div>
              )}

              {aiError && !aiLoading && (
                <div className="flex flex-col items-center justify-center py-6 gap-2 text-center">
                  <AlertTriangle className="h-6 w-6 text-yellow-500" />
                  <p className="text-xs text-muted-foreground">Couldn&apos;t fetch AI suggestions.</p>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={fetchAiSuggestions}>
                    Retry
                  </Button>
                </div>
              )}

              {aiFetched && !aiLoading && aiSuggestions.length > 0 && (
                <>
                  <div className="flex items-center gap-2 pt-2 pb-1">
                    <Sparkles className="h-3 w-3 text-orange-500" />
                    <span className="text-xs font-medium text-muted-foreground">AI Suggestions</span>
                  </div>
                  {aiSuggestions.map((sub) => (
                    <button
                      key={sub.name}
                      onClick={() => handleAddAiSuggestion(sub)}
                      className="w-full text-left rounded-xl border border-border hover:border-muted-foreground/30 p-3 transition-all"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">r/{sub.name}</span>
                            <Badge variant="outline" className={`text-[10px] h-5 ${matchColors[sub.match]}`}>
                              {matchLabels[sub.match]}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{sub.reason}</p>
                          {sub.approach && (
                            <p className="text-xs text-muted-foreground/70 mt-0.5 italic">{sub.approach}</p>
                          )}
                        </div>
                        <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-muted-foreground/30 text-muted-foreground">
                          <span className="text-xs">+</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </>
              )}

              {/* Show AI suggestion button after user has added some subs */}
              {addedSubs.length > 0 && !aiFetched && !aiLoading && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2 text-xs"
                  onClick={fetchAiSuggestions}
                >
                  <Sparkles className="mr-1.5 h-3 w-3" />
                  Suggest more subreddits with AI
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{addedSubs.length} selected</span>
          <Button onClick={onNext} disabled={addedSubs.length === 0}>
            Continue <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
