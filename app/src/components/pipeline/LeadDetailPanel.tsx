'use client';

import { useEffect, useState, useRef } from 'react';
import { X, ExternalLink, Clock, ArrowRight, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConversationTimeline } from './ConversationTimeline';
import { timeAgo } from '@/lib/time';
import { deduplicateMessages } from '@/lib/outreach/deduplicateMessages';
import type { OutreachDM } from '@/types';
import type { ChatPreview, ConversationMessage } from '@/hooks/useRedditBridge';

interface LeadDetailPanelProps {
  dm: OutreachDM;
  chatPreview?: ChatPreview;
  redditUsername?: string;
  fetchConversation?: (username: string) => Promise<ConversationMessage[]>;
  onClose: () => void;
  onOpenQueue?: (dm: OutreachDM) => void;
}

export function LeadDetailPanel({
  dm,
  chatPreview,
  redditUsername,
  fetchConversation,
  onClose,
  onOpenQueue,
}: LeadDetailPanelProps) {
  const [fullMessages, setFullMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const prevUsernameRef = useRef<string>('');

  // Fetch conversation when DM changes
  useEffect(() => {
    const username = dm.reddit_username?.toLowerCase();
    if (!username || !fetchConversation) return;
    if (username === prevUsernameRef.current) return;
    prevUsernameRef.current = username;

    setFullMessages([]);
    setLoading(true);
    fetchConversation(username)
      .then((msgs) => {
        // Filter to only messages involving this user
        const filtered = msgs.filter(
          (m) =>
            m.author?.toLowerCase() === username ||
            m.author?.toLowerCase() === redditUsername?.toLowerCase() ||
            m.isFromYou
        );
        setFullMessages(deduplicateMessages(filtered, username, redditUsername));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dm.reddit_username, fetchConversation, redditUsername]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const subreddit = dm.signal?.subreddit || '';
  const threadTitle = dm.signal?.title || '';
  const stage = dm.pipeline_stage;
  const isFollowUp = stage === 'responded';
  const isSent = stage === 'dm_sent';
  const isReady = ['detected', 'dm_ready', 'draft_generated'].includes(stage);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-background border-l border-border z-50 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
          <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-muted-foreground">
              {dm.reddit_username.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">u/{dm.reddit_username}</h3>
            {subreddit && (
              <p className="text-xs text-muted-foreground truncate">r/{subreddit}</p>
            )}
          </div>
          <Badge
            variant="secondary"
            className={`text-[10px] px-1.5 py-0 shrink-0 ${
              isReady
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                : isSent
                  ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                  : isFollowUp
                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                    : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
            }`}
          >
            {isReady ? 'Ready to DM' : isSent ? 'DM Sent' : isFollowUp ? 'Follow Up' : 'Converted'}
          </Badge>
          <button
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Thread link */}
        {dm.signal && (
          <div className="px-4 py-2 border-b border-border/50">
            <a
              href={`https://reddit.com${dm.signal.permalink}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3 w-3 shrink-0" />
              <span className="truncate">{threadTitle || 'View thread'}</span>
            </a>
          </div>
        )}

        {/* Touch info */}
        {dm.touch_number > 0 && (
          <div className="px-4 py-2 border-b border-border/50 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {dm.touch_number} touch{dm.touch_number !== 1 ? 'es' : ''}
            </span>
            {dm.dm_sent_at && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Last sent {timeAgo(dm.dm_sent_at)}
              </span>
            )}
          </div>
        )}

        {/* Conversation timeline */}
        <div className="flex-1 overflow-y-auto px-4">
          <ConversationTimeline
            dm={dm}
            chatPreview={chatPreview}
            fullMessages={fullMessages}
            loading={loading}
          />
        </div>

        {/* Footer action */}
        {onOpenQueue && (isReady || isFollowUp) && (
          <div className="px-4 py-3 border-t border-border shrink-0">
            <Button
              size="sm"
              className="w-full text-xs font-semibold"
              onClick={() => {
                onClose();
                onOpenQueue(dm);
              }}
            >
              {isFollowUp ? 'Send Follow-up' : 'Draft & Send DM'}
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
