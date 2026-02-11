'use client';

import { ArrowUpRight, MessageSquare, ExternalLink, Clock, Bookmark, BookmarkCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cardHover, cardTap } from '@/lib/motion';
import type { RedditPost } from '@/types';

interface PostCardProps {
  post: RedditPost;
  onUsePost?: (post: RedditPost) => void;
  isBookmarked?: boolean;
  onToggleBookmark?: (post: RedditPost) => void;
}

export function PostCard({ post, onUsePost, isBookmarked, onToggleBookmark }: PostCardProps) {
  const timeAgo = (timestamp: number) => {
    const seconds = Math.floor(Date.now() / 1000 - timestamp);
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  return (
    <motion.div whileHover={cardHover} whileTap={cardTap}>
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="p-4">
          <div className="flex gap-3">
            {/* Score column */}
            <div className="flex flex-col items-center justify-start min-w-[48px] py-1">
              <ArrowUpRight className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-semibold">{formatNumber(post.score)}</span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-2">
              <h3 className="font-medium text-sm leading-snug">{post.title}</h3>

              {post.preview_url && (
                <div className="relative w-full overflow-hidden rounded-md">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={post.preview_url}
                    alt=""
                    className="w-full max-h-48 object-cover rounded-md"
                    loading="lazy"
                  />
                </div>
              )}

              {post.selftext && (
                <p className="text-xs text-muted-foreground line-clamp-3">
                  {post.selftext}
                </p>
              )}

              {post.link_flair_text && (
                <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
                  {post.link_flair_text}
                </span>
              )}

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {formatNumber(post.num_comments)} comments
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {timeAgo(post.created_utc)}
                </span>
                <span>u/{post.author}</span>
              </div>

              <div className="flex items-center gap-2 pt-1">
                {onToggleBookmark && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 p-0"
                    onClick={() => onToggleBookmark(post)}
                  >
                    {isBookmarked ? (
                      <BookmarkCheck className="h-4 w-4 text-orange-500 fill-orange-500" />
                    ) : (
                      <Bookmark className="h-4 w-4" />
                    )}
                  </Button>
                )}
                {onUsePost && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => onUsePost(post)}
                  >
                    Use as Example
                  </Button>
                )}
                <a
                  href={`https://reddit.com${post.permalink}`}
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
    </motion.div>
  );
}
