'use client';

import { MessageSquare, ArrowUp, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { SubredditFilterPopover } from './SubredditFilterPopover';
import type { OutreachDM } from '@/types';

interface PostInfo {
  postId: string;
  permalink: string;
  title: string;
  subreddit: string;
  score: number;
  numComments: number;
  selftext: string | null;
  imageUrl: string | null;
  leadsCount: number;
  stages: { ready: number; sent: number; followup: number; converted: number };
}

interface PostFilterRowProps {
  posts: PostInfo[];
  allDms: OutreachDM[];
  selectedPostId: string | null;
  onSelectPost: (postId: string | null) => void;
  trackedSubreddits: string[];
  selectedSubreddits: Set<string>;
  onToggleSubreddit: (sub: string) => void;
  onSelectAllSubreddits: () => void;
  onDeselectAllSubreddits: () => void;
  filteredLeadCount: number;
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

export function PostFilterRow({
  posts,
  allDms,
  selectedPostId,
  onSelectPost,
  trackedSubreddits,
  selectedSubreddits,
  onToggleSubreddit,
  onSelectAllSubreddits,
  onDeselectAllSubreddits,
  filteredLeadCount,
}: PostFilterRowProps) {
  const totalLeads = allDms.length;
  const hasSubredditFilter = trackedSubreddits.length > 0;
  const isFiltered = hasSubredditFilter && selectedSubreddits.size < trackedSubreddits.length;

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
        <div className="flex gap-2.5 py-2 items-stretch">
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
            <span className="text-xl font-extrabold text-primary mt-0.5">
              {isFiltered ? filteredLeadCount : totalLeads}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {isFiltered ? `of ${totalLeads} leads` : 'total leads'}
            </span>
            {hasSubredditFilter && (
              <div className="mt-1">
                <SubredditFilterPopover
                  trackedSubreddits={trackedSubreddits}
                  selectedSubreddits={selectedSubreddits}
                  onToggle={onToggleSubreddit}
                  onSelectAll={onSelectAllSubreddits}
                  onDeselectAll={onDeselectAllSubreddits}
                />
              </div>
            )}
          </button>

          {/* Empty state hint */}
          {posts.length === 0 && (
            <div className="min-w-[280px] shrink-0 rounded-xl border border-dashed bg-card/50 p-4 flex items-center justify-center text-center">
              <p className="text-xs text-muted-foreground">
                Set your Reddit username in Context &gt; Profile to sync your posts here.
              </p>
            </div>
          )}

          {/* Individual post cards (filtered by selected subreddits) */}
          {posts.filter((post) => !hasSubredditFilter || selectedSubreddits.has(post.subreddit.toLowerCase())).map((post) => (
            <button
              key={post.postId}
              onClick={() => onSelectPost(post.postId)}
              className={cn(
                'min-w-[280px] max-w-[310px] shrink-0 rounded-xl border bg-card overflow-hidden transition-all hover:-translate-y-0.5 text-left relative flex flex-col',
                selectedPostId === post.postId
                  ? 'ring-2 ring-primary border-primary shadow-md'
                  : 'hover:border-muted-foreground/30'
              )}
            >
              {/* Image banner */}
              {post.imageUrl ? (
                <div className="w-full h-[120px] bg-muted/30 overflow-hidden">
                  <img
                    src={post.imageUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-full h-[120px] bg-gradient-to-b from-muted/20 to-transparent flex items-center justify-center">
                  <ImageIcon className="h-6 w-6 text-muted-foreground/10" />
                </div>
              )}

              <div className="flex flex-1">
                {/* Vote + Comments column */}
                <div className="w-10 shrink-0 bg-muted/50 flex flex-col items-center justify-center gap-2 py-2 border-r">
                  <div className="flex flex-col items-center gap-0.5">
                    <ArrowUp className="h-3 w-3 text-orange-500" />
                    <span className="text-xs font-extrabold">{post.score}</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <MessageSquare className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] font-bold text-muted-foreground">{post.numComments}</span>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 p-2.5 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className={cn('w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0', getSubredditColor(post.subreddit))}>
                      {post.subreddit.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-[11px] font-bold">r/{post.subreddit}</span>
                  </div>
                  <p className="text-xs font-semibold line-clamp-2 leading-snug">{post.title}</p>
                </div>
              </div>

              {/* Leads badge */}
              <div className={cn(
                'absolute top-2 right-2 text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm z-10',
                selectedPostId === post.postId
                  ? 'bg-green-500 text-white'
                  : 'bg-green-500/15 text-green-500 ring-1 ring-green-500/30 backdrop-blur-sm'
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
