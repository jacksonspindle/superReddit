'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Send, Sparkles, Loader2, Check } from 'lucide-react';
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
import type { ChatPreview, ConversationMessage } from '@/hooks/useRedditBridge';

interface ConversationDrawerProps {
  dm: OutreachDM | null;
  chatPreview?: ChatPreview;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDraft?: (dm: OutreachDM) => void;
  prepareDraft?: () => Promise<boolean>;
  checkLastSend?: () => Promise<{ success: boolean; username: string | null; error: string | null } | null>;
  onSent?: () => void;
  fetchConversation?: (username: string) => Promise<ConversationMessage[]>;
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

/**
 * Post-process scraped DOM messages to remove duplicates caused by
 * parent/child CSS selector overlap in the DOM scraper.
 */
function deduplicateMessages(
  messages: ConversationMessage[],
  otherUsername: string
): ConversationMessage[] {
  if (messages.length === 0) return messages;

  const otherLower = otherUsername.toLowerCase();
  // Matches "9:36 AM" or "4:30 PM" as the ENTIRE message text
  const timestampOnly = /^\d{1,2}:\d{2}\s*(AM|PM)?$/i;
  // Matches "9:36 AM " at the START of message text (timestamp prefix from parent element)
  const timestampPrefix = /^\d{1,2}:\d{2}\s*(AM|PM)\s+/i;

  // Reddit chat UI strings the scraper picks up as messages
  const uiChrome = new Set([
    'send message', 'type a message', 'send', 'message',
    'start a conversation', 'say something nice',
  ]);

  const processed = messages
    // Step 1a: Remove pure timestamp messages ("9:36 AM", "4:30 PM")
    .filter((msg) => !timestampOnly.test(msg.text.trim()))
    // Step 1b: Remove Reddit UI chrome text ("Send message", etc.)
    .filter((msg) => !uiChrome.has(msg.text.trim().toLowerCase()))
    // Step 2: Normalize — strip leading timestamp prefix, fix "them" author, fix isFromYou
    .map((msg) => {
      const author = msg.author === 'them' ? otherLower : msg.author;
      const isOtherUser = author.toLowerCase() === otherLower;
      return {
        ...msg,
        text: msg.text.replace(timestampPrefix, '').trim(),
        author,
        isFromYou: msg.isFromYou || !isOtherUser,
      };
    })
    // Step 3: Remove messages that became empty after timestamp strip
    .filter((msg) => msg.text.length > 0);

  // Step 4: Deduplicate by lowercase text only — in 1:1 DMs identical text is
  // always a scraper artifact (parent/child overlap), not two people saying the same thing
  const seen = new Set<string>();
  return processed.filter((msg) => {
    const key = msg.text.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getInitials(username: string): string {
  return username.slice(0, 2).toUpperCase();
}

export function ConversationDrawer({
  dm,
  chatPreview,
  open,
  onOpenChange,
  onDraft,
  prepareDraft,
  checkLastSend,
  onSent,
  fetchConversation,
}: ConversationDrawerProps) {
  const [replyBody, setReplyBody] = useState('');
  const [fullMessages, setFullMessages] = useState<ConversationMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [awaitingSend, setAwaitingSend] = useState(false);
  const [sentFlash, setSentFlash] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch full conversation from extension when drawer opens
  useEffect(() => {
    if (!open || !dm || !fetchConversation) {
      setFullMessages([]);
      return;
    }
    let cancelled = false;
    setLoadingMessages(true);
    fetchConversation(dm.reddit_username).then((msgs) => {
      if (!cancelled) {
        setFullMessages(deduplicateMessages(msgs, dm.reddit_username));
        setLoadingMessages(false);
      }
    });
    return () => { cancelled = true; };
  }, [open, dm?.reddit_username, fetchConversation]);

  // Clean up poll on unmount or drawer close
  useEffect(() => {
    if (!open) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      setAwaitingSend(false);
      setSentFlash(false);
    }
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [open]);

  const startSendPolling = useCallback((targetUsername: string, messageText: string) => {
    if (!checkLastSend) return;
    if (pollRef.current) clearInterval(pollRef.current);

    let polls = 0;
    const MAX_POLLS = 40; // 40 × 1.5s = 60s

    pollRef.current = setInterval(async () => {
      polls++;
      if (polls > MAX_POLLS) {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        setAwaitingSend(false);
        return;
      }
      const result = await checkLastSend();
      if (result && result.success && result.username === targetUsername.toLowerCase()) {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        // Success! Focus back + flash + notify
        window.focus();
        setAwaitingSend(false);
        setSentFlash(true);
        toast.success(`DM sent to u/${targetUsername}`);

        // Optimistically add sent message to timeline
        setFullMessages((prev) => [
          ...prev,
          {
            id: `optimistic_${Date.now()}`,
            text: messageText,
            author: 'you',
            isFromYou: true,
            timestamp: Date.now(),
          },
        ]);

        setReplyBody('');
        onSent?.();
        setTimeout(() => setSentFlash(false), 2000);
      }
    }, 1500);
  }, [checkLastSend, onSent]);

  if (!dm) return null;

  const stage = stageConfig[dm.pipeline_stage] || stageConfig.detected;

  async function handleSendOnReddit() {
    if (!dm || !replyBody.trim()) return;

    // Tell extension not to auto-send on the compose page
    if (prepareDraft) await prepareDraft();

    try {
      await navigator.clipboard.writeText(replyBody);
    } catch { /* silent */ }

    const subject = dm.dm_subject?.trim() || replyBody.slice(0, 60).split('\n')[0];
    const url = `https://www.reddit.com/message/compose/?to=${encodeURIComponent(dm.reddit_username)}&subject=${encodeURIComponent(subject)}&message=${encodeURIComponent(replyBody)}`;
    window.open(url, '_blank');

    setAwaitingSend(true);
    startSendPolling(dm.reddit_username, replyBody);
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
        <ScrollArea className="flex-1 min-h-0 px-5">
          {loadingMessages ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading conversation...</span>
            </div>
          ) : (
            <ConversationTimeline dm={dm} chatPreview={chatPreview} fullMessages={fullMessages} />
          )}
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
                handleSendOnReddit();
              }
            }}
          />

          <div className="flex items-center gap-2">
            {sentFlash ? (
              <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-600 text-white" disabled>
                <Check className="mr-1 h-3 w-3" />
                Sent!
              </Button>
            ) : awaitingSend ? (
              <Button size="sm" className="h-8 text-xs" disabled>
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                Waiting for send...
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={handleSendOnReddit}
                disabled={!replyBody.trim()}
              >
                <Send className="mr-1 h-3 w-3" />
                Send on Reddit
              </Button>
            )}
            <span className="text-[10px] text-muted-foreground ml-auto">
              {'\u2318'}+Enter to send
            </span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
