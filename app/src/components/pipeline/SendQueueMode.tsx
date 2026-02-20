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
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
}

const permissionLabels: Record<PermissionType, { label: string; className: string }> = {
  explicit_dm_request: {
    label: 'DM Requested',
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  },
  positive_reply: {
    label: 'Positive Reply',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  },
  passive_commenter: {
    label: 'Commenter',
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
  },
};

export function SendQueueMode({
  dms,
  projectId,
  onClose,
  onStageChange,
  onDmSent,
  onDismiss,
  prepareDraft,
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

  // Count leads that need generation
  const needsGeneration = useMemo(
    () => queue.filter((d) => !drafts.has(d.id)).length,
    [queue, drafts]
  );

  // Get current draft
  const currentDraft = currentDm ? drafts.get(currentDm.id) : undefined;

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

  // Tell extension to not auto-send, then open Reddit compose with pre-filled fields
  const handleCopyAndOpen = useCallback(async () => {
    if (!currentDm) return;
    const draft = drafts.get(currentDm.id);
    if (!draft || (!draft.subject && !draft.body)) return;

    // Tell extension: don't auto-send on this compose page (suppresses auto-click)
    await prepareDraft();

    // Copy body to clipboard as fallback
    try {
      await navigator.clipboard.writeText(draft.body);
    } catch {
      // Clipboard may not be available
    }

    // Open Reddit compose in a new tab with pre-filled fields
    const composeUrl = `https://www.reddit.com/message/compose/?to=${encodeURIComponent(
      currentDm.reddit_username
    )}&subject=${encodeURIComponent(draft.subject)}&message=${encodeURIComponent(draft.body)}`;
    window.open(composeUrl, '_blank');

    // Show confirmation buttons
    setAwaitingConfirm(true);
  }, [currentDm, drafts, prepareDraft]);

  // Auto-show confirm when user returns to tab (in case they missed the buttons)
  useEffect(() => {
    if (!awaitingConfirm) return;
    function handleVisibility() {
      if (document.visibilityState === 'visible' && awaitingConfirm) {
        // User returned to our tab — buttons are already showing
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [awaitingConfirm]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sentFlashTimeoutRef.current) clearTimeout(sentFlashTimeoutRef.current);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (started && !isFinished) {
          if (confirm('Exit send queue? Your progress will be saved.')) {
            onClose();
          }
        } else {
          onClose();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (started && currentDm && !sentFlash && !awaitingConfirm) {
          const draft = drafts.get(currentDm.id);
          if (draft && (draft.subject || draft.body)) {
            handleCopyAndOpen();
          }
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [started, isFinished, currentDm, sentFlash, awaitingConfirm, drafts, onClose, handleCopyAndOpen]);

  // Skip handler
  function handleSkip() {
    if (!currentDm) return;
    setSkippedIds((prev) => new Set(prev).add(currentDm.id));
    setAwaitingConfirm(false);
    setCurrentIndex((i) => i + 1);
  }

  // Dismiss handler
  function handleDismissLead() {
    if (!currentDm) return;
    onDismiss(currentDm.id);
    setDismissedIds((prev) => new Set(prev).add(currentDm.id));
    setAwaitingConfirm(false);
  }

  // Progress percentage
  const progressPct = queue.length > 0 ? ((currentIndex) / queue.length) * 100 : 0;

  // Permission label
  const permInfo = currentDm
    ? permissionLabels[currentDm.permission_type] || permissionLabels.passive_commenter
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
              {/* Close button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="absolute top-4 right-4 h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>

              <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold">Send Queue</h1>
                <p className="text-muted-foreground">
                  {queue.length} lead{queue.length !== 1 ? 's' : ''} ready to go
                </p>
              </div>

              {/* Follow-up days */}
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

              {/* Generate all button */}
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

              {/* Start button */}
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
                  {skippedIds.size > 0 && ` · ${skippedIds.size} skipped`}
                  {dismissedIds.size > 0 && ` · ${dismissedIds.size} dismissed`}
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
            {/* Sent flash overlay */}
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

            {/* Header */}
            <div className="border-b px-6 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button variant="ghost" size="sm" onClick={() => {
                    if (confirm('Exit send queue? Your progress will be saved.')) onClose();
                  }} className="h-8 w-8 p-0">
                    <X className="h-4 w-4" />
                  </Button>
                  <span className="font-semibold">Send Queue</span>
                  <span className="text-sm text-muted-foreground">
                    Lead {currentIndex + 1} of {queue.length}
                  </span>
                  {sentCount > 0 && (
                    <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                      {sentCount} sent
                    </Badge>
                  )}
                </div>
              </div>
              {/* Progress bar */}
              <div className="mt-2 h-1 w-full bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>

            {/* Main content — split layout */}
            <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-0 overflow-hidden">
              {/* Left: Lead context */}
              <div className="border-r p-6 overflow-y-auto">
                <div className="max-w-lg mx-auto space-y-4">
                  {/* Username + avatar */}
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <span className="text-sm font-semibold text-muted-foreground">
                        {currentDm.reddit_username.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <a
                        href={`https://reddit.com/u/${currentDm.reddit_username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-base hover:underline"
                      >
                        u/{currentDm.reddit_username}
                      </a>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {currentDm.signal?.subreddit && (
                          <span>r/{currentDm.signal.subreddit}</span>
                        )}
                        <span>
                          <Clock className="inline h-3 w-3 mr-0.5" />
                          {timeAgo(currentDm.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Permission badge */}
                  {permInfo && (
                    <Badge
                      variant="secondary"
                      className={`text-xs ${permInfo.className}`}
                    >
                      {permInfo.label}
                    </Badge>
                  )}

                  {/* Thread link */}
                  {currentDm.signal && (
                    <a
                      href={`https://reddit.com${currentDm.signal.permalink}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 hover:bg-muted transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{currentDm.signal.title || 'View thread'}</span>
                    </a>
                  )}

                  {/* Original comment */}
                  {currentDm.comment_text && (
                    <blockquote className="border-l-2 border-muted-foreground/30 pl-4 py-2">
                      <p className="text-sm text-muted-foreground italic whitespace-pre-wrap">
                        {currentDm.comment_text}
                      </p>
                    </blockquote>
                  )}
                </div>
              </div>

              {/* Right: Draft editor */}
              <div className="p-6 overflow-y-auto">
                <div className="max-w-lg mx-auto space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-sm">Message Draft</h3>
                    {currentDraft ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
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
                    ) : null}
                  </div>

                  {/* Subject */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Subject</label>
                    <Input
                      value={currentDraft?.subject || ''}
                      onChange={(e) => updateDraft(currentDm.id, 'subject', e.target.value)}
                      placeholder="Subject line..."
                      className="text-sm"
                    />
                  </div>

                  {/* Body */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Message</label>
                    <Textarea
                      value={currentDraft?.body || ''}
                      onChange={(e) => updateDraft(currentDm.id, 'body', e.target.value)}
                      placeholder="Write your message or click Generate Draft..."
                      className="min-h-[200px] text-sm"
                    />
                  </div>

                  {/* Generate button (if no draft yet) */}
                  {!currentDraft && (
                    <Button
                      variant="outline"
                      className="w-full"
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
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t px-6 py-3">
              <div className="flex items-center justify-between max-w-5xl mx-auto">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSkip}
                    disabled={sentFlash}
                  >
                    <SkipForward className="mr-1 h-3.5 w-3.5" />
                    Skip
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={handleDismissLead}
                    disabled={sentFlash}
                  >
                    <X className="mr-1 h-3.5 w-3.5" />
                    Dismiss
                  </Button>
                </div>

                {awaitingConfirm ? (
                  /* User opened Reddit — confirm they sent it */
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3"
                  >
                    <span className="text-sm text-muted-foreground">
                      Did you send it on Reddit?
                    </span>
                    <Button
                      size="sm"
                      onClick={() => {
                        if (currentDm) {
                          const draft = drafts.get(currentDm.id);
                          markSentAndAdvance(currentDm.id, draft?.body || '');
                        }
                      }}
                    >
                      <Check className="mr-1 h-3.5 w-3.5" />
                      Yes, sent
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAwaitingConfirm(false)}
                    >
                      Not yet
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyAndOpen}
                    >
                      <Copy className="mr-1 h-3.5 w-3.5" />
                      Re-open
                    </Button>
                  </motion.div>
                ) : (
                  <Button
                    onClick={handleCopyAndOpen}
                    disabled={
                      !currentDraft ||
                      (!currentDraft.subject && !currentDraft.body) ||
                      sentFlash
                    }
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy & Open in Reddit
                    <span className="ml-2 text-xs opacity-70">
                      {typeof navigator !== 'undefined' && navigator.platform?.includes('Mac') ? '\u2318' : 'Ctrl'}+Enter
                    </span>
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
