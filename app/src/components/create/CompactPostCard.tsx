'use client';

import { ArrowUpRight, MessageSquare, Clock, Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useBookmarkStore } from '@/stores/bookmark-store';
import type { RedditPost } from '@/types';

interface CompactPostCardProps {
  post: RedditPost;
  onUse: (post: RedditPost) => void;
  isUsed?: boolean;
}

function timeAgo(timestamp: number) {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return new Date(timestamp * 1000).toLocaleDateString();
}

function formatNumber(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

export function CompactPostCard({ post, onUse, isUsed }: CompactPostCardProps) {
  const { isBookmarked, addBookmark, removeBookmark } = useBookmarkStore();
  const bookmarked = isBookmarked(post.id);

  return (
    <Card className="transition-shadow hover:shadow-sm">
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <div className="flex items-center gap-1 text-orange-500 shrink-0 pt-0.5">
            <ArrowUpRight className="h-3 w-3" />
            <span className="text-xs font-semibold">{formatNumber(post.score)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-medium leading-snug line-clamp-2">{post.title}</h4>
            {post.selftext && (
              <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                {post.selftext}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
              <span>r/{post.subreddit}</span>
              <span className="flex items-center gap-0.5">
                <Clock className="h-2.5 w-2.5" />
                {timeAgo(post.created_utc)}
              </span>
              <span className="flex items-center gap-0.5">
                <MessageSquare className="h-2.5 w-2.5" />
                {formatNumber(post.num_comments)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className={`h-6 px-1.5 ${bookmarked ? 'text-primary' : ''}`}
              onClick={() => bookmarked ? removeBookmark(post.id) : addBookmark(post)}
            >
              <Bookmark className={`h-3 w-3 ${bookmarked ? 'fill-current' : ''}`} />
            </Button>
            <Button
              variant={isUsed ? 'secondary' : 'outline'}
              size="sm"
              className="h-6 text-[10px] px-2"
              disabled={isUsed}
              onClick={() => onUse(post)}
            >
              {isUsed ? 'Used' : 'Use'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
