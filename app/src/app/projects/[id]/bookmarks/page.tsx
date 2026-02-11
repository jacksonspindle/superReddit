'use client';

import { useEffect, useState, useMemo } from 'react';
import { Bookmark, Search, ExternalLink, Trash2, ArrowUpRight, MessageSquare } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageTransition } from '@/components/motion';
import { StaggerList, StaggerItem } from '@/components/motion';
import { useBookmarkStore } from '@/stores/bookmark-store';
import { toast } from 'sonner';

type SortOption = 'newest' | 'oldest' | 'highest' | 'lowest';

export default function ProjectBookmarksPage() {
  const { bookmarks, loading, fetchBookmarks, removeBookmark } = useBookmarkStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [subredditFilter, setSubredditFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  useEffect(() => {
    fetchBookmarks();
  }, []);

  const subreddits = useMemo(() => {
    const subs = new Set(bookmarks.map((b) => b.subreddit));
    return Array.from(subs).sort();
  }, [bookmarks]);

  const filteredBookmarks = useMemo(() => {
    let result = [...bookmarks];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          (b.body && b.body.toLowerCase().includes(q)) ||
          b.author.toLowerCase().includes(q)
      );
    }

    if (subredditFilter !== 'all') {
      result = result.filter((b) => b.subreddit === subredditFilter);
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'newest': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'highest': return b.score - a.score;
        case 'lowest': return a.score - b.score;
      }
    });

    return result;
  }, [bookmarks, searchQuery, subredditFilter, sortBy]);

  async function handleRemove(redditId: string) {
    await removeBookmark(redditId);
    toast.success('Bookmark removed');
  }

  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  return (
    <PageTransition>
      <div className="flex h-full flex-col">
        <Header title="Bookmarks" />
        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-4xl p-6 space-y-6">
            {/* Filters row */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search bookmarks..."
                  className="pl-9"
                />
              </div>

              <Select value={subredditFilter} onValueChange={setSubredditFilter}>
                <SelectTrigger className="h-9 w-44 text-xs">
                  <SelectValue placeholder="All subreddits" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All subreddits</SelectItem>
                  {subreddits.map((sub) => (
                    <SelectItem key={sub} value={sub}>r/{sub}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger className="h-9 w-36 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                  <SelectItem value="highest">Highest score</SelectItem>
                  <SelectItem value="lowest">Lowest score</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Count */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {filteredBookmarks.length} bookmark{filteredBookmarks.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Bookmark list */}
            {loading ? (
              <div className="py-12 text-center text-muted-foreground">Loading bookmarks...</div>
            ) : filteredBookmarks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 mb-4">
                  <Bookmark className="h-6 w-6" />
                </div>
                <p className="font-medium">No bookmarks yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {bookmarks.length === 0
                    ? 'Browse the Inspiration page and bookmark posts to save them for later.'
                    : 'No bookmarks match your current filters.'}
                </p>
              </div>
            ) : (
              <StaggerList className="space-y-2">
                {filteredBookmarks.map((bookmark) => (
                  <StaggerItem key={bookmark.id}>
                    <Card className="transition-shadow hover:shadow-md">
                      <CardContent className="p-4">
                        <div className="flex gap-3">
                          {/* Score column */}
                          <div className="flex flex-col items-center justify-start min-w-[48px] py-1">
                            <ArrowUpRight className="h-4 w-4 text-orange-500" />
                            <span className="text-sm font-semibold">{formatNumber(bookmark.score)}</span>
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <h3 className="font-medium text-sm leading-snug">{bookmark.title}</h3>

                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
                                r/{bookmark.subreddit}
                              </span>
                              <span className="flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                {formatNumber(bookmark.num_comments)}
                              </span>
                              <span>u/{bookmark.author}</span>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 pt-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-destructive hover:text-destructive"
                                onClick={() => handleRemove(bookmark.reddit_id)}
                              >
                                <Trash2 className="mr-1 h-3 w-3" />
                                Remove
                              </Button>
                              <a
                                href={`https://reddit.com${bookmark.permalink}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Button variant="ghost" size="sm" className="h-7 text-xs">
                                  <ExternalLink className="mr-1 h-3 w-3" />
                                  Reddit
                                </Button>
                              </a>
                            </div>
                          </div>
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
