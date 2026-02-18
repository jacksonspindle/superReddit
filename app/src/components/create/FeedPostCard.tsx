'use client';

import { ArrowUpRight, MessageSquare, Clock, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { RedditPost } from '@/types';

interface FeedPostCardProps {
  post: RedditPost;
  onUse: (post: RedditPost) => void;
  isUsed?: boolean;
}

function timeAgo(timestamp: number) {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(timestamp * 1000).toLocaleDateString();
}

function formatNumber(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

function isValidThumbnail(url: string | null): boolean {
  if (!url) return false;
  return url.startsWith('http') && !['self', 'default', 'nsfw', 'spoiler', 'image'].includes(url);
}

export function FeedPostCard({ post, onUse, isUsed }: FeedPostCardProps) {
  const showPreview = post.preview_url;
  const showThumbnail = !showPreview && isValidThumbnail(post.thumbnail);

  return (
    <div className="border-b border-border/50 last:border-b-0">
      <div className="px-3 py-3 space-y-2">
        {/* Subreddit + author header */}
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="font-semibold text-foreground">r/{post.subreddit}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">u/{post.author}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5" />
            {timeAgo(post.created_utc)}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold leading-snug">{post.title}</h3>

        {post.link_flair_text && (
          <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
            {post.link_flair_text}
          </span>
        )}

        {/* Body text */}
        {post.selftext && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">
            {post.selftext}
          </p>
        )}

        {/* Preview image with blurred backdrop */}
        {showPreview && (
          <div className="relative w-full max-h-56 overflow-hidden rounded-lg">
            {/* Blurred background fill */}
            <div
              className="absolute inset-0 scale-110 blur-xl brightness-50"
              style={{ backgroundImage: `url(${post.preview_url!})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
            />
            {/* Actual image centered on top */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.preview_url!}
              alt=""
              className="relative w-full max-h-56 object-contain"
              loading="lazy"
            />
          </div>
        )}

        {/* Thumbnail fallback for link posts */}
        {showThumbnail && (
          <div className="flex gap-2 items-start">
            <div className="relative shrink-0 overflow-hidden rounded-md bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.thumbnail!}
                alt=""
                className="h-16 w-24 object-cover rounded-md"
                loading="lazy"
              />
            </div>
            {!post.is_self && post.url && (
              <span className="text-[10px] text-muted-foreground truncate flex-1">
                {post.url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 50)}
              </span>
            )}
          </div>
        )}

        {/* Actions row */}
        <div className="flex items-center gap-3 pt-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <ArrowUpRight className="h-3.5 w-3.5 text-orange-500" />
            <span className="font-medium">{formatNumber(post.score)}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5" />
            <span>{formatNumber(post.num_comments)}</span>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <a
              href={`https://reddit.com${post.permalink}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5 gap-1">
                <ExternalLink className="h-3 w-3" />
              </Button>
            </a>
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
      </div>
    </div>
  );
}
