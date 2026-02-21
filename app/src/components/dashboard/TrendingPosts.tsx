'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, ArrowUpRight, MessageSquare, Clock, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { RedditPost } from '@/types';

interface TrendingPostsProps {
  projectId: string;
}

function formatNumber(n: number) {
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

function TrendingPostCard({ post }: { post: RedditPost }) {
  return (
    <a
      href={`https://reddit.com${post.permalink}`}
      target="_blank"
      rel="noopener noreferrer"
      className="block break-inside-avoid mb-3"
    >
      <div className="group rounded-xl border border-border bg-card p-4 space-y-3 transition-colors hover:border-orange-500/40 hover:bg-accent/30">
        {/* Subreddit badge */}
        <span className="inline-flex items-center gap-1 rounded-full bg-muted/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          <svg className="h-2.5 w-2.5 shrink-0 fill-orange-500" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <circle cx="10" cy="10" r="10" />
          </svg>
          r/{post.subreddit}
        </span>

        {/* Score + Title */}
        <div className="flex gap-3">
          <div className="flex flex-col items-center shrink-0 pt-0.5">
            <ArrowUpRight className="h-3.5 w-3.5 text-orange-500" />
            <span className="text-xs font-bold text-orange-500">{formatNumber(post.score)}</span>
          </div>
          <h3 className="text-sm font-medium leading-snug">{post.title}</h3>
        </div>

        {/* Preview image */}
        {post.preview_url && (
          <div className="overflow-hidden rounded-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.preview_url}
              alt=""
              className="w-full object-cover rounded-lg transition-transform duration-300 group-hover:scale-[1.02]"
              loading="lazy"
            />
          </div>
        )}

        {/* Body text */}
        {post.selftext && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
            {post.selftext}
          </p>
        )}

        {/* Flair */}
        {post.link_flair_text && (
          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium">
            {post.link_flair_text}
          </span>
        )}

        {/* Metadata row */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {formatNumber(post.num_comments)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {timeAgo(post.created_utc)}
          </span>
          <span className="truncate">u/{post.author}</span>
          <ExternalLink className="ml-auto h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
      </div>
    </a>
  );
}

export function TrendingPosts({ projectId }: TrendingPostsProps) {
  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/reddit/trending?projectId=${projectId}`);
        const data = await res.json();
        if (data.empty) {
          setEmpty(true);
        } else {
          setPosts(data.posts ?? []);
        }
      } catch {
        // silently fail — section is non-critical
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Trending in Your Subreddits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="columns-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton
                key={i}
                className="mb-3 break-inside-avoid rounded-xl"
                style={{ height: `${120 + (i % 3) * 60}px` }}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (empty) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Trending in Your Subreddits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No subreddits tracked yet.{' '}
            <Link href={`/projects/${projectId}/create`} className="text-primary underline">
              Go to Create
            </Link>{' '}
            to add subreddits and see trending posts here.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (posts.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4" />
          Trending in Your Subreddits
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="columns-3 gap-3">
          {posts.map((post) => (
            <TrendingPostCard key={post.id} post={post} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
