'use client';

import { useEffect, useRef } from 'react';
import { MessageSquare, Clock, ArrowUpRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { timeAgo } from '@/lib/time';
import type { OutreachDM } from '@/types';
import type { ChatPreview, ConversationMessage } from '@/hooks/useRedditBridge';

interface ConversationTimelineProps {
  dm: OutreachDM;
  chatPreview?: ChatPreview;
  fullMessages?: ConversationMessage[];
}

export function ConversationTimeline({ dm, chatPreview, fullMessages }: ConversationTimelineProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  const hasComment = !!dm.comment_text;
  const hasSentDm = !!(dm.dm_body || dm.dm_subject);
  const hasReply = !!dm.last_reply_text;
  const hasFullMessages = fullMessages && fullMessages.length > 0;

  // Check if live preview adds new info beyond what DB already shows
  const previewIsNew =
    chatPreview?.text &&
    chatPreview.text !== dm.dm_body &&
    chatPreview.text !== dm.last_reply_text;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [hasComment, hasSentDm, hasReply, previewIsNew, hasFullMessages]);

  const isEmpty = !hasComment && !hasSentDm && !hasReply && !previewIsNew && !hasFullMessages;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <MessageSquare className="h-8 w-8 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">No conversation data yet.</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Send a DM to start the conversation.
        </p>
      </div>
    );
  }

  // If we have full messages from the extension, render the complete thread
  if (hasFullMessages) {
    return (
      <div className="space-y-3 py-4">
        {/* Context: their original comment (always show if available) */}
        {hasComment && (
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
              <span className="text-[11px] font-medium text-muted-foreground">
                u/{dm.reddit_username} commented
              </span>
              {dm.signal?.subreddit && (
                <span className="text-[10px] text-muted-foreground/60">
                  in r/{dm.signal.subreddit}
                </span>
              )}
            </div>
            <p className="text-sm text-foreground/80 italic">&ldquo;{dm.comment_text}&rdquo;</p>
            {dm.created_at && (
              <span className="text-[10px] text-muted-foreground/60 mt-1.5 flex items-center gap-0.5">
                <Clock className="h-2.5 w-2.5" />
                {timeAgo(dm.created_at)}
              </span>
            )}
          </div>
        )}

        {/* Full message thread from extension */}
        <div className="flex items-center gap-2 py-1">
          <div className="flex-1 border-t border-border/40" />
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
            {fullMessages!.length} message{fullMessages!.length !== 1 ? 's' : ''} from Reddit Chat
          </Badge>
          <div className="flex-1 border-t border-border/40" />
        </div>

        {fullMessages!.map((msg, i) => (
          <div key={msg.id || i} className={`flex ${msg.isFromYou ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-lg p-3 ${
                msg.isFromYou
                  ? 'bg-primary/10 border border-primary/20'
                  : 'bg-blue-50 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-800/30'
              }`}
            >
              <span
                className={`text-[11px] font-medium block mb-1 ${
                  msg.isFromYou ? 'text-primary/70' : 'text-blue-600 dark:text-blue-400'
                }`}
              >
                {msg.isFromYou ? 'You' : `u/${msg.author}`}
              </span>
              <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
              {msg.timestamp > 0 && (
                <span className={`text-[10px] text-muted-foreground/60 mt-1.5 flex items-center gap-0.5 ${msg.isFromYou ? 'justify-end' : ''}`}>
                  <Clock className="h-2.5 w-2.5" />
                  {timeAgo(new Date(msg.timestamp).toISOString())}
                </span>
              )}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>
    );
  }

  // Fallback: render from DB data points (comment, sent DM, reply, live preview)
  return (
    <div className="space-y-3 py-4">
      {/* Their original comment */}
      {hasComment && (
        <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
            <span className="text-[11px] font-medium text-muted-foreground">
              u/{dm.reddit_username} commented
            </span>
            {dm.signal?.subreddit && (
              <span className="text-[10px] text-muted-foreground/60">
                in r/{dm.signal.subreddit}
              </span>
            )}
          </div>
          <p className="text-sm text-foreground/80 italic">&ldquo;{dm.comment_text}&rdquo;</p>
          {dm.created_at && (
            <span className="text-[10px] text-muted-foreground/60 mt-1.5 flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" />
              {timeAgo(dm.created_at)}
            </span>
          )}
        </div>
      )}

      {/* Your sent DM */}
      {hasSentDm && (
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-lg bg-primary/10 border border-primary/20 p-3">
            <span className="text-[11px] font-medium text-primary/70 block mb-1">You sent a DM</span>
            {dm.dm_subject && (
              <span className="text-[10px] text-muted-foreground block mb-1">
                Subject: {dm.dm_subject}
              </span>
            )}
            {dm.dm_body && (
              <p className="text-sm whitespace-pre-wrap break-words">{dm.dm_body}</p>
            )}
            {dm.dm_sent_at && (
              <span className="text-[10px] text-muted-foreground/60 mt-1.5 flex items-center gap-0.5 justify-end">
                <Clock className="h-2.5 w-2.5" />
                {timeAgo(dm.dm_sent_at)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Empty state: no DM sent yet */}
      {!hasSentDm && hasComment && (
        <div className="text-center py-3">
          <p className="text-xs text-muted-foreground/60">No DM sent yet</p>
        </div>
      )}

      {/* Their reply from DB */}
      {hasReply && (
        <div className="flex justify-start">
          <div className="max-w-[85%] rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-800/30 p-3">
            <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 block mb-1">
              u/{dm.reddit_username} replied
            </span>
            <p className="text-sm whitespace-pre-wrap break-words">{dm.last_reply_text}</p>
          </div>
        </div>
      )}

      {/* Empty state: waiting for reply */}
      {hasSentDm && !hasReply && !chatPreview?.theirText && (
        <div className="text-center py-3">
          <p className="text-xs text-muted-foreground/60 flex items-center justify-center gap-1">
            <Clock className="h-3 w-3" />
            Waiting for reply...
          </p>
        </div>
      )}

      {/* Live preview from extension */}
      {previewIsNew && chatPreview && (
        <div className={`flex ${chatPreview.fromYou ? 'justify-end' : 'justify-start'}`}>
          <div
            className={`max-w-[85%] rounded-lg p-3 border border-dashed ${
              chatPreview.fromYou
                ? 'bg-primary/5 border-primary/20'
                : 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/50 dark:border-blue-800/30'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[11px] font-medium text-muted-foreground">
                {chatPreview.fromYou ? 'You (latest)' : `u/${dm.reddit_username} (latest)`}
              </span>
              <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5">
                Live
              </Badge>
            </div>
            <p className="text-sm whitespace-pre-wrap break-words">{chatPreview.text}</p>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
