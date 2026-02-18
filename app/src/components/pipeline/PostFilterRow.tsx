'use client';

import { MessageSquare, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import type { OutreachDM } from '@/types';

interface PostInfo {
  signalId: string;
  title: string;
  subreddit: string;
  score: number;
  numComments: number;
  body: string | null;
  leadsCount: number;
  stages: { ready: number; sent: number; followup: number; converted: number };
}

interface PostFilterRowProps {
  posts: PostInfo[];
  allDms: OutreachDM[];
  selectedPostId: string | null;
  onSelectPost: (postId: string | null) => void;
}

function getSubredditColor(sub: string): string {
  const colors = [
    'bg-purple-500', 'bg-orange-500', 'bg-cyan-500', 'bg-blue-500',
    'bg-pink-500', 'bg-green-500', 'bg-red-500', 'bg-yellow-500',
  ];
  let hash = 0;
  for (let i = 0; i < sub.length; i++) hash = sub.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function PipelineStrip({ stages }: { stages: PostInfo['stages'] }) {
  const total = stages.ready + stages.sent + stages.followup + stages.converted;
  if (total === 0) return null;
  return (
    <div className="flex h-[3px] w-full rounded-full overflow-hidden">
      {stages.ready > 0 && (
        <div className="bg-blue-500 h-full" style={{ width: `${(stages.ready / total) * 100}%` }} />
      )}
      {stages.sent > 0 && (
        <div className="bg-orange-500 h-full" style={{ width: `${(stages.sent / total) * 100}%` }} />
      )}
      {stages.followup > 0 && (
        <div className="bg-yellow-500 h-full" style={{ width: `${(stages.followup / total) * 100}%` }} />
      )}
      {stages.converted > 0 && (
        <div className="bg-green-500 h-full" style={{ width: `${(stages.converted / total) * 100}%` }} />
      )}
    </div>
  );
}

export function PostFilterRow({ posts, allDms, selectedPostId, onSelectPost }: PostFilterRowProps) {
  const totalLeads = allDms.length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Your Posts
        </span>
        <span className="text-[11px] text-muted-foreground">
          Click a post to filter the board
        </span>
      </div>

      <ScrollArea className="w-full overflow-visible">
        <div className="flex gap-2.5 py-2">
          {/* All Posts card */}
          <button
            onClick={() => onSelectPost(null)}
            className={cn(
              'min-w-[100px] shrink-0 rounded-xl border bg-card p-3 flex flex-col items-center justify-center text-center transition-all hover:-translate-y-0.5',
              selectedPostId === null
                ? 'ring-2 ring-primary border-primary shadow-md'
                : 'hover:border-muted-foreground/30'
            )}
          >
            <span className="text-lg opacity-60 mb-1">&#9783;</span>
            <span className="text-xs font-bold">All Posts</span>
            <span className="text-xl font-extrabold text-primary mt-0.5">{totalLeads}</span>
            <span className="text-[10px] text-muted-foreground">total leads</span>
          </button>

          {/* Empty state hint */}
          {posts.length === 0 && (
            <div className="min-w-[280px] shrink-0 rounded-xl border border-dashed bg-card/50 p-4 flex items-center justify-center text-center">
              <p className="text-xs text-muted-foreground">
                Post replies to signals and your threads will appear here for filtering.
              </p>
            </div>
          )}

          {/* Individual post cards */}
          {posts.map((post) => (
            <button
              key={post.signalId}
              onClick={() => onSelectPost(post.signalId)}
              className={cn(
                'min-w-[280px] max-w-[310px] shrink-0 rounded-xl border bg-card overflow-hidden transition-all hover:-translate-y-0.5 text-left relative',
                selectedPostId === post.signalId
                  ? 'ring-2 ring-primary border-primary shadow-md'
                  : 'hover:border-muted-foreground/30'
              )}
            >
              <div className="flex">
                {/* Vote column */}
                <div className="w-10 shrink-0 bg-muted/50 flex flex-col items-center justify-center gap-0.5 py-2 border-r">
                  <ArrowUp className="h-3 w-3 text-orange-500" />
                  <span className="text-xs font-extrabold">{post.score}</span>
                </div>

                {/* Content */}
                <div className="flex-1 p-2.5 min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <div className={cn('w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0', getSubredditColor(post.subreddit))}>
                      {post.subreddit.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-[11px] font-bold">r/{post.subreddit}</span>
                  </div>
                  <p className="text-xs font-semibold line-clamp-1">{post.title}</p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-0.5">
                      <MessageSquare className="h-2.5 w-2.5" />
                      {post.numComments}
                    </span>
                  </div>
                </div>
              </div>

              {/* Leads badge */}
              <div className={cn(
                'absolute bottom-5 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full text-white shadow',
                selectedPostId === post.signalId ? 'bg-green-500' : 'bg-primary'
              )}>
                {post.leadsCount} leads
              </div>

              {/* Pipeline strip at bottom */}
              <PipelineStrip stages={post.stages} />
            </button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

export type { PostInfo };
