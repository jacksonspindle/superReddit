'use client';

import { useState } from 'react';
import { ExternalLink, Send, Copy, Sparkles } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ConversationTimeline } from './ConversationTimeline';
import { toast } from 'sonner';
import type { OutreachDM } from '@/types';
import type { ChatPreview } from '@/hooks/useRedditBridge';

interface ConversationDrawerProps {
  dm: OutreachDM | null;
  chatPreview?: ChatPreview;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDraft?: (dm: OutreachDM) => void;
  sendDm?: (
    username: string,
    subject: string,
    body: string
  ) => Promise<{
    success: boolean;
    error?: string;
    rateLimited?: boolean;
    retryAfterMs?: number;
  }>;
  extensionReady?: boolean;
  onSent?: () => void;
}

const stageConfig: Record<string, { label: string; className: string }> = {
  detected: { label: 'Detected', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  dm_ready: { label: 'Ready', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  draft_generated: { label: 'Draft', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  dm_sent: { label: 'Sent', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
  responded: { label: 'Replied', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
  converted: { label: 'Converted', className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  closed: { label: 'Closed', className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
};

function getInitials(username: string): string {
  return username.slice(0, 2).toUpperCase();
}

export function ConversationDrawer({
  dm,
  chatPreview,
  open,
  onOpenChange,
  onDraft,
  sendDm,
  extensionReady,
  onSent,
}: ConversationDrawerProps) {
  const [replyBody, setReplyBody] = useState('');
  const [sending, setSending] = useState(false);

  if (!dm) return null;

  const stage = stageConfig[dm.pipeline_stage] || stageConfig.detected;

  async function handleSendReply() {
    if (!dm || !replyBody.trim() || !sendDm) return;
    setSending(true);
    try {
      const result = await sendDm(dm.reddit_username, dm.dm_subject || '', replyBody);
      if (result.success) {
        await fetch('/api/outreach/dms/sent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dm_id: dm.id, dm_content: replyBody }),
        });
        toast.success(`Reply sent to u/${dm.reddit_username}`);
        setReplyBody('');
        onSent?.();
      } else if (result.rateLimited) {
        const secs = result.retryAfterMs ? Math.ceil(result.retryAfterMs / 1000) : 8;
        toast.error(`Rate limited — wait ${secs}s`);
      } else {
        toast.error(result.error || 'Failed to send');
      }
    } catch {
      toast.error('Failed to send reply');
    }
    setSending(false);
  }

  function handleCopyAndOpen() {
    if (!dm) return;
    navigator.clipboard
      .writeText(replyBody)
      .then(() => toast.success('Copied to clipboard'))
      .catch(() => {});
    const url = `https://www.reddit.com/message/compose/?to=${encodeURIComponent(dm.reddit_username)}&subject=${encodeURIComponent(dm.dm_subject || '')}&message=${encodeURIComponent(replyBody)}`;
    window.open(url, '_blank');
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[480px] flex flex-col p-0 gap-0"
        showCloseButton
      >
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-3 border-b space-y-3">
          <div className="flex items-center gap-3 pr-8">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
              <span className="text-sm font-semibold text-muted-foreground">
                {getInitials(dm.reddit_username)}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base">u/{dm.reddit_username}</SheetTitle>
              <SheetDescription className="flex items-center gap-2 mt-0.5">
                {dm.signal?.subreddit && (
                  <span className="text-xs">r/{dm.signal.subreddit}</span>
                )}
                <Badge
                  variant="secondary"
                  className={`text-[10px] px-1.5 py-0 ${stage.className}`}
                >
                  {stage.label}
                </Badge>
              </SheetDescription>
            </div>
          </div>
          {dm.signal && (
            <a
              href={`https://reddit.com${dm.signal.permalink}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3 w-3 shrink-0" />
              <span className="truncate">{dm.signal.title}</span>
            </a>
          )}
        </SheetHeader>

        {/* Timeline */}
        <ScrollArea className="flex-1 px-5">
          <ConversationTimeline dm={dm} chatPreview={chatPreview} />
        </ScrollArea>

        {/* Footer — reply area */}
        <div className="border-t px-5 py-4 space-y-3">
          {onDraft && (
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs text-primary hover:underline cursor-pointer"
              onClick={() => onDraft(dm)}
            >
              <Sparkles className="h-3 w-3" />
              Draft with AI
            </button>
          )}

          <Textarea
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            placeholder="Type your reply..."
            className="min-h-[80px] text-sm resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && replyBody.trim()) {
                e.preventDefault();
                if (extensionReady && sendDm) handleSendReply();
                else handleCopyAndOpen();
              }
            }}
          />

          <div className="flex items-center gap-2">
            {extensionReady && sendDm ? (
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={handleSendReply}
                disabled={sending || !replyBody.trim()}
              >
                <Send className="mr-1 h-3 w-3" />
                {sending ? 'Sending...' : 'Send Reply'}
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={handleCopyAndOpen}
                disabled={!replyBody.trim()}
              >
                <Copy className="mr-1 h-3 w-3" />
                Copy & Open Reddit
              </Button>
            )}
            <span className="text-[10px] text-muted-foreground ml-auto">
              {extensionReady ? '\u2318+Enter to send' : '\u2318+Enter to copy & open'}
            </span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
