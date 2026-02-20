'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  ExternalLink,
  Sparkles,
  Loader2,
  SkipForward,
  Check,
  ChevronRight,
  RefreshCw,
  Clock,
  Copy,
  Send,
  MessageCircle,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { timeAgo } from '@/lib/time';
import type { OutreachDM, PermissionType } from '@/types';

interface SendQueueModeProps {
  dms: OutreachDM[];
  projectId: string;
  onClose: () => void;
  onStageChange: (dmId: string, stage: string, outcome?: string) => void;
  onDmSent: (dmId: string, dmContent: string, followUpDays: number | null) => void;
  onDismiss: (dmId: string) => void;
  prepareDraft: () => Promise<boolean>;
  checkLastSend: () => Promise<{ success: boolean; username: string | null; error: string | null } | null>;
}

const permissionLabels: Record<PermissionType, { label: string; color: string }> = {
  explicit_dm_request: { label: 'DM Requested', color: 'text-green-600 dark:text-green-400' },
  positive_reply: { label: 'Positive Reply', color: 'text-blue-600 dark:text-blue-400' },
  passive_commenter: { label: 'Commenter', color: 'text-muted-foreground' },
};

// Check if text looks like a raw URL (not useful as a comment)
function isRawUrl(text: string): boolean {
  const trimmed = text.trim();
  return /^https?:\/\/\S+$/i.test(trimmed);
}

export function SendQueueMode({
  dms,
  projectId,
  onClose,
  onStageChange,
  onDmSent,
  onDismiss,
  prepareDraft,
  checkLastSend,
}: SendQueueModeProps) {
  const [started, setStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [drafts, setDrafts] = useState<Map<string, { subject: string; body: string }>>(new Map());
  const [generating, setGenerating] = useState<Set<string>>(new Set());
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });
  const [followUpDays, setFollowUpDays] = useState<string>('3');
  const [sentFlash, setSentFlash] = useState(false);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const sentFlashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Active queue (excluding dismissed leads)
  const queue = useMemo(
    () => dms.filter((d) => !dismissedIds.has(d.id)),
    [dms, dismissedIds]
  );

  const currentDm = queue[currentIndex] ?? null;
  const isFinished = started && currentIndex >= queue.length;

  // Load existing drafts on mount
  useEffect(() => {
    const initial = new Map<string, { subject: string; body: string }>();
    for (const dm of dms) {
      if (dm.dm_subject || dm.dm_body) {
        initial.set(dm.id, { subject: dm.dm_subject || '', body: dm.dm_body || '' });
      }
    }
    setDrafts(initial);
  }, [dms]);

  // Focus textarea when lead changes
  useEffect(() => {
    if (started && currentDm && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [started, currentIndex, currentDm]);

  // Count leads that need generation
  const needsGeneration = useMemo(
    () => queue.filter((d) => !drafts.has(d.id)).length,
    [queue, drafts]
  );

  // Get current draft
  const currentDraft = currentDm ? drafts.get(currentDm.id) : undefined;
  const hasDraftContent = !!(currentDraft && (currentDraft.subject || currentDraft.body));

  // Update draft fields
  const updateDraft = useCallback(
    (dmId: string, field: 'subject' | 'body', value: string) => {
      setDrafts((prev) => {
        const next = new Map(prev);
        const existing = next.get(dmId) || { subject: '', body: '' };
        next.set(dmId, { ...existing, [field]: value });
        return next;
      });
    },
    []
  );

  // Generate draft for a single DM
  const generateDraft = useCallback(
    async (dmId: string) => {
      setGenerating((prev) => new Set(prev).add(dmId));
      try {
        const res = await fetch('/api/ai/dm-draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dm_id: dmId, project_id: projectId }),
        });
        const json = await res.json();
        if (json.error) {
          toast.error(json.error);
        } else {
          setDrafts((prev) => {
            const next = new Map(prev);
            next.set(dmId, { subject: json.subject || '', body: json.body || '' });
            return next;
          });
        }
      } catch {
        toast.error('Failed to generate draft');
      }
      setGenerating((prev) => {
        const next = new Set(prev);
        next.delete(dmId);
        return next;
      });
    },
    [projectId]
  );

  // Batch generate all missing drafts
  const generateAll = useCallback(async () => {
    const toGenerate = queue.filter((d) => !drafts.has(d.id));
    if (toGenerate.length === 0) return;

    setBatchGenerating(true);
    setBatchProgress({ done: 0, total: toGenerate.length });

    const BATCH_SIZE = 5;
    for (let i = 0; i < toGenerate.length; i += BATCH_SIZE) {
      const batch = toGenerate.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (dm) => {
          await generateDraft(dm.id);
          setBatchProgress((prev) => ({ ...prev, done: prev.done + 1 }));
        })
      );
      if (i + BATCH_SIZE < toGenerate.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    setBatchGenerating(false);
  }, [queue, drafts, generateDraft]);

  // Mark current DM as sent + show flash + advance
  const markSentAndAdvance = useCallback(
    (dmId: string, bodyText: string) => {
      const days = followUpDays === 'none' ? null : parseInt(followUpDays);
      onDmSent(dmId, bodyText, days);
      setSentCount((c) => c + 1);
      setAwaitingConfirm(false);
      setSentFlash(true);

      sentFlashTimeoutRef.current = setTimeout(() => {
        setSentFlash(false);
        setCurrentIndex((i) => i + 1);
      }, 1500);
    },
    [followUpDays, onDmSent]
  );

  // Start polling for send detection after opening compose
  const startSendPolling = useCallback((targetUsername: string, dmId: string, bodyText: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    let polls = 0;
    const MAX_POLLS = 40; // 40 × 1.5s = 60s

    pollRef.current = setInterval(async () => {
      polls++;
      if (polls > MAX_POLLS) {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        // Timed out — leave in "confirm" state for manual confirmation
        return;
      }
      const result = await checkLastSend();
      if (result && result.success && result.username === targetUsername.toLowerCase()) {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        // Auto-detected send! Focus back + advance
        window.focus();
        markSentAndAdvance(dmId, bodyText);
      }
    }, 1500);
  }, [checkLastSend, markSentAndAdvance]);

  // Tell extension to not auto-send, then open Reddit compose with pre-filled fields
  const handleCopyAndOpen = useCallback(async () => {
    if (!currentDm) return;
    const draft = drafts.get(currentDm.id);
    if (!draft || (!draft.subject && !draft.body)) return;

    await prepareDraft();

    try {
      await navigator.clipboard.writeText(draft.body);
    } catch { /* silent */ }

    // Use subject from draft, or generate a short one from body
    const subject = draft.subject || draft.body.slice(0, 60).split('\n')[0];

    const composeUrl = `https://www.reddit.com/message/compose/?to=${encodeURIComponent(
      currentDm.reddit_username
    )}&subject=${encodeURIComponent(subject)}&message=${encodeURIComponent(draft.body)}`;
    window.open(composeUrl, '_blank');

    setAwaitingConfirm(true);
    startSendPolling(currentDm.reddit_username, currentDm.id, draft.body);
  }, [currentDm, drafts, prepareDraft, startSendPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sentFlashTimeoutRef.current) clearTimeout(sentFlashTimeoutRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (started && !isFinished) {
          if (confirm('Exit send queue? Your progress will be saved.')) onClose();
        } else {
          onClose();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (started && currentDm && !sentFlash && !awaitingConfirm && hasDraftContent) {
          handleCopyAndOpen();
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [started, isFinished, currentDm, sentFlash, awaitingConfirm, hasDraftContent, onClose, handleCopyAndOpen]);

  function handleSkip() {
    if (!currentDm) return;
    setSkippedIds((prev) => new Set(prev).add(currentDm.id));
    setAwaitingConfirm(false);
    setCurrentIndex((i) => i + 1);
  }

  function handleDismissLead() {
    if (!currentDm) return;
    onDismiss(currentDm.id);
    setDismissedIds((prev) => new Set(prev).add(currentDm.id));
    setAwaitingConfirm(false);
  }

  const progressPct = queue.length > 0 ? (currentIndex / queue.length) * 100 : 0;
  const permInfo = currentDm
    ? permissionLabels[currentDm.permission_type] || permissionLabels.passive_commenter
    : null;

  // Derive useful display text for the comment
  const commentDisplay = currentDm?.comment_text && !isRawUrl(currentDm.comment_text)
    ? currentDm.comment_text
    : null;

  return (
    <AnimatePresence>
      <motion.div
        key="send-queue-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background flex flex-col"
      >
        {/* ── Entry screen ── */}
        {!started && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex items-center justify-center"
          >
            <div className="w-full max-w-md mx-auto p-8 space-y-6">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="absolute top-4 right-4 h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>

              <div className="text-center space-y-2">
                <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <Send className="h-5 w-5 text-primary" />
                </div>
                <h1 className="text-2xl font-bold">Send Queue</h1>
                <p className="text-muted-foreground">
                  {queue.length} lead{queue.length !== 1 ? 's' : ''} ready to message
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Follow-up reminder</label>
                <Select value={followUpDays} onValueChange={setFollowUpDays}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 day</SelectItem>
                    <SelectItem value="3">3 days</SelectItem>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="none">No follow-up</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Applies to all DMs sent in this session
                </p>
              </div>

              {needsGeneration > 0 && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={generateAll}
                  disabled={batchGenerating}
                >
                  {batchGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating {batchProgress.done} of {batchProgress.total}...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate All Drafts ({needsGeneration})
                    </>
                  )}
                </Button>
              )}

              <Button
                className="w-full"
                size="lg"
                onClick={() => setStarted(true)}
                disabled={queue.length === 0}
              >
                Start Sending
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* ── Finished screen ── */}
        {started && isFinished && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex items-center justify-center"
          >
            <div className="text-center space-y-6 max-w-sm mx-auto p-8">
              <div className="mx-auto h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold mb-2">All done!</h2>
                <p className="text-muted-foreground">
                  Sent {sentCount} of {queue.length} lead{queue.length !== 1 ? 's' : ''}
                  {skippedIds.size > 0 && ` \u00b7 ${skippedIds.size} skipped`}
                  {dismissedIds.size > 0 && ` \u00b7 ${dismissedIds.size} dismissed`}
                </p>
              </div>
              <Button onClick={onClose} size="lg">
                Close
              </Button>
            </div>
          </motion.div>
        )}

        {/* ── Active lead view ── */}
        {started && !isFinished && currentDm && (
          <>
            {/* Sent flash */}
            <AnimatePresence>
              {sentFlash && (
                <motion.div
                  key="sent-flash"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-[60] bg-green-500/10 flex items-center justify-center pointer-events-none"
                >
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 1.2, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="h-20 w-20 rounded-full bg-green-500 flex items-center justify-center"
                  >
                    <Check className="h-10 w-10 text-white" />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Header bar */}
            <div className="border-b px-6 py-3">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={() => {
                  if (confirm('Exit send queue? Your progress will be saved.')) onClose();
                }} className="h-8 w-8 p-0">
                  <X className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="font-semibold text-sm">Send Queue</span>
                  <span className="text-xs text-muted-foreground">
                    {currentIndex + 1} / {queue.length}
                  </span>
                  {sentCount > 0 && (
                    <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                      {sentCount} sent
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={handleSkip} disabled={sentFlash} className="text-xs h-7">
                    <SkipForward className="mr-1 h-3 w-3" />
                    Skip
                  </Button>
                  <Button variant="ghost" size="sm" className="text-xs h-7 text-destructive hover:text-destructive" onClick={handleDismissLead} disabled={sentFlash}>
                    <X className="mr-1 h-3 w-3" />
                    Dismiss
                  </Button>
                </div>
              </div>
              <div className="mt-2 h-0.5 w-full bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>

            {/* Main content */}
            <div className="flex-1 min-h-0 flex overflow-hidden">
              {/* Left: Post/Thread context */}
              <div className="w-[420px] shrink-0 border-r bg-muted/20 p-5 overflow-y-auto">
                <div className="space-y-4">
                  {/* Thread card */}
                  {currentDm.signal && (
                    <div className="rounded-xl border bg-card p-4 space-y-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium">r/{currentDm.signal.subreddit}</span>
                        <span>&middot;</span>
                        <span>{currentDm.signal.score} pts</span>
                        <span>&middot;</span>
                        <span>{currentDm.signal.num_comments} comments</span>
                      </div>
                      <a
                        href={`https://reddit.com${currentDm.signal.permalink}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block font-semibold text-sm leading-snug hover:underline"
                      >
                        {currentDm.signal.title}
                      </a>
                      <a
                        href={`https://reddit.com${currentDm.signal.permalink}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View thread
                      </a>
                    </div>
                  )}

                  {/* User's comment */}
                  <div className="rounded-xl border bg-card p-4 space-y-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-muted-foreground">
                          {currentDm.reddit_username.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <a
                          href={`https://reddit.com/u/${currentDm.reddit_username}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-sm hover:underline"
                        >
                          u/{currentDm.reddit_username}
                        </a>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          {permInfo && (
                            <span className={`font-medium ${permInfo.color}`}>
                              {permInfo.label}
                            </span>
                          )}
                          <span>
                            <Clock className="inline h-2.5 w-2.5 mr-0.5" />
                            {timeAgo(currentDm.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {commentDisplay && (
                      <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
                        &ldquo;{commentDisplay}&rdquo;
                      </p>
                    )}

                    {!commentDisplay && !currentDm.signal && (
                      <p className="text-sm text-muted-foreground italic">
                        No comment text available
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: DM composer — chat-like layout */}
              <div className="flex-1 flex flex-col min-w-0">
                {/* DM header — who you're messaging */}
                <div className="px-5 py-3 border-b flex items-center gap-3">
                  <MessageCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    New message to{' '}
                    <span className="font-semibold">u/{currentDm.reddit_username}</span>
                  </span>
                </div>

                {/* Message area */}
                <div className="flex-1 min-h-0 p-5 overflow-y-auto flex flex-col justify-end">
                  {currentDraft && currentDraft.body ? (
                    /* Show draft as a message bubble */
                    <div className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary text-primary-foreground px-4 py-3">
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{currentDraft.body}</p>
                      </div>
                    </div>
                  ) : (
                    /* Empty state */
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-center space-y-3">
                        <MessageCircle className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                        <p className="text-sm text-muted-foreground">
                          Write a message or generate a draft
                        </p>
                        <Button
                          variant="outline"
                          onClick={() => generateDraft(currentDm.id)}
                          disabled={generating.has(currentDm.id)}
                        >
                          {generating.has(currentDm.id) ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="mr-2 h-4 w-4" />
                              Generate Draft
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Compose bar — always at bottom */}
                <div className="border-t p-3 space-y-2">
                  {/* Regenerate button row */}
                  {currentDraft && currentDraft.body && (
                    <div className="flex items-center gap-2 px-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[11px] text-muted-foreground"
                        onClick={() => generateDraft(currentDm.id)}
                        disabled={generating.has(currentDm.id)}
                      >
                        {generating.has(currentDm.id) ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-1 h-3 w-3" />
                        )}
                        Regenerate
                      </Button>
                    </div>
                  )}

                  {/* Input + send */}
                  <div className="flex items-end gap-2">
                    <Textarea
                      ref={textareaRef}
                      value={currentDraft?.body || ''}
                      onChange={(e) => updateDraft(currentDm.id, 'body', e.target.value)}
                      placeholder={`Message u/${currentDm.reddit_username}...`}
                      className="min-h-[44px] max-h-[160px] text-sm resize-none rounded-xl"
                      rows={2}
                    />
                    {awaitingConfirm ? (
                      <div className="flex flex-col gap-1 shrink-0">
                        <Button
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => {
                            const draft = drafts.get(currentDm.id);
                            markSentAndAdvance(currentDm.id, draft?.body || '');
                          }}
                        >
                          <Check className="mr-1 h-3 w-3" />
                          Sent
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px]"
                          onClick={() => setAwaitingConfirm(false)}
                        >
                          Not yet
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="icon"
                        className="h-[44px] w-[44px] shrink-0 rounded-xl"
                        onClick={handleCopyAndOpen}
                        disabled={!hasDraftContent || sentFlash}
                        title={`Open in Reddit (${typeof navigator !== 'undefined' && navigator.platform?.includes('Mac') ? '\u2318' : 'Ctrl'}+Enter)`}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {!awaitingConfirm && (
                    <p className="text-[10px] text-muted-foreground px-1">
                      Opens Reddit with your message pre-filled &middot;{' '}
                      {typeof navigator !== 'undefined' && navigator.platform?.includes('Mac') ? '\u2318' : 'Ctrl'}+Enter
                    </p>
                  )}
                  {awaitingConfirm && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-[10px] text-muted-foreground px-1"
                    >
                      Confirm you sent it on Reddit &middot;{' '}
                      <button className="underline hover:text-foreground" onClick={handleCopyAndOpen}>
                        Re-open Reddit
                      </button>
                    </motion.p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
