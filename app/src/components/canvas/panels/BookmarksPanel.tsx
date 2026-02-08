'use client';

import { useEffect, useState } from 'react';
import { Bookmark, Search, Plus, Check } from 'lucide-react';
import { useBookmarkStore } from '@/stores/bookmark-store';
import { useCanvasStore } from '@/stores/canvas-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Bookmark as BookmarkType } from '@/types';

export function BookmarksPanel() {
  const { bookmarks, fetchBookmarks } = useBookmarkStore();
  const { nodes, addNode } = useCanvasStore();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchBookmarks();
  }, []);

  const filtered = searchQuery
    ? bookmarks.filter(
        (b) =>
          b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          b.subreddit.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : bookmarks;

  function isOnCanvas(bookmark: BookmarkType) {
    return nodes.some((n) => n.id === `example-${bookmark.reddit_id}`);
  }

  function handleAddToCanvas(bookmark: BookmarkType) {
    const nodeId = `example-${bookmark.reddit_id}`;
    if (nodes.some((n) => n.id === nodeId)) return;

    const exampleCount = nodes.filter((n) => n.data.type === 'example-post').length;

    addNode({
      id: nodeId,
      type: 'example-post',
      position: { x: 800, y: 50 + exampleCount * 220 },
      data: {
        type: 'example-post',
        redditId: bookmark.reddit_id,
        title: bookmark.title,
        body: bookmark.body || null,
        author: bookmark.author,
        score: bookmark.score,
        numComments: bookmark.num_comments,
        subreddit: bookmark.subreddit,
        permalink: bookmark.permalink,
        selected: false,
      },
    });
  }

  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  if (bookmarks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 mb-3">
          <Bookmark className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium">No bookmarks yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Browse Inspiration and bookmark posts to add them here
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-2">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search bookmarks..."
            className="h-8 pl-8 text-xs"
          />
        </div>

        <div className="flex items-center justify-between px-1 mb-1">
          <span className="text-xs font-medium text-muted-foreground">
            {filtered.length} bookmark{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {filtered.map((bookmark) => {
          const onCanvas = isOnCanvas(bookmark);
          return (
            <div key={bookmark.id} className="rounded-lg border bg-card p-3 space-y-1.5">
              <p className="text-xs font-medium leading-tight line-clamp-2">{bookmark.title}</p>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="inline-flex rounded-full bg-muted px-1.5 py-0.5 font-medium">
                  r/{bookmark.subreddit}
                </span>
                <span>{formatNumber(bookmark.score)} pts</span>
                <span>{formatNumber(bookmark.num_comments)} comments</span>
              </div>
              <Button
                variant={onCanvas ? 'ghost' : 'outline'}
                size="sm"
                className="h-7 text-xs w-full mt-1"
                disabled={onCanvas}
                onClick={() => handleAddToCanvas(bookmark)}
              >
                {onCanvas ? (
                  <><Check className="mr-1 h-3 w-3" /> On Canvas</>
                ) : (
                  <><Plus className="mr-1 h-3 w-3" /> Add to Canvas</>
                )}
              </Button>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
