'use client';

import { useEffect } from 'react';
import { Bookmark } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { CompactPostCard } from '@/components/create/CompactPostCard';
import { useBookmarkStore } from '@/stores/bookmark-store';
import { useCreateStore } from '@/stores/create-store';
import type { RedditPost } from '@/types';

export function BookmarksPanel() {
  const { bookmarks, loading, fetchBookmarks } = useBookmarkStore();
  const { usePost, referencePosts } = useCreateStore();
  const usedIds = new Set(referencePosts.map((r) => r.id));

  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);

  // Convert Bookmark type to RedditPost for CompactPostCard
  function toRedditPost(b: typeof bookmarks[number]): RedditPost {
    return {
      id: b.reddit_id,
      title: b.title,
      selftext: b.body || '',
      author: b.author,
      score: b.score,
      num_comments: b.num_comments,
      url: b.url,
      permalink: b.permalink,
      created_utc: b.created_utc,
      subreddit: b.subreddit,
      link_flair_text: b.link_flair_text,
      is_self: true,
      thumbnail: b.thumbnail,
      preview_url: null,
      post_hint: null,
    };
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-2 space-y-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))
        ) : bookmarks.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center px-4">
            <Bookmark className="h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="text-xs font-medium text-muted-foreground">No bookmarks yet</p>
            <p className="text-[10px] text-muted-foreground/70 mt-1">
              Bookmark posts from Inspiration or Feed to save them here
            </p>
          </div>
        ) : (
          bookmarks.map((bookmark) => (
            <CompactPostCard
              key={bookmark.id}
              post={toRedditPost(bookmark)}
              onUse={usePost}
              isUsed={usedIds.has(bookmark.reddit_id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
