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
  Send,
  MessageCircle,
} from 'lucide-react';
import { AnimatePresence, motion, useMotionValue, useTransform, animate } from 'motion/react';
import type { PanInfo } from 'motion/react';
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
import type { OutreachDM, PermissionType, DmRateLimit } from '@/types';

interface SendQueueModeProps {
  dms: OutreachDM[];
  projectId: string;
  onClose: () => void;
  onStageChange: (dmId: string, stage: string, outcome?: string) => void;
  onDmSent: (dmId: string, dmContent: string, followUpDays: number | null) => void;
  onDismiss: (dmId: string) => void;
  sendDm: (username: string, subject: string, body: string) => Promise<{
    success: boolean;
    error?: string;
    rateLimited?: boolean;
    retryAfterMs?: number;
  }>;
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
  sendDm,
}: SendQueueModeProps) {
  const [started, setStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [drafts, setDrafts] = useState<Map<string, { subject: string; body: string }>>(new Map());
  const [generating, setGenerating] = useState<Set<string>>(new Set());
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });
  const [followUpDays, setFollowUpDays] = useState<string>('3');
  const [sentFlash, setSentFlash] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [rateLimit, setRateLimit] = useState<DmRateLimit | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [pauseReason, setPauseReason] = useState<string | null>(null);

  const sentFlashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Swipe gesture state
  const swipeX = useMotionValue(0);
  const swipeRotate = useTransform(swipeX, [-200, 200], [-12, 12]);
  const leftOverlayOpacity = useTransform(swipeX, [-200, -50], [1, 0]);
  const rightOverlayOpacityRaw = useTransform(swipeX, [50, 200], [0, 1]);
  const swipeDisabled = sending || sentFlash || cooldownRemaining > 0 || !!pauseReason;

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

  // Fetch rate limit status
  const fetchRateLimit = useCallback(async () => {
    try {
      const res = await fetch(`/api/outreach/dms/rate-limit?project_id=${projectId}`);
      if (res.ok) {
        const rl: DmRateLimit = await res.json();
        setRateLimit(rl);
        return rl;
      }
    } catch { /* silent */ }
    return null;
  }, [projectId]);

  // Fetch on mount
  useEffect(() => { fetchRateLimit(); }, [fetchRateLimit]);

  // Start cooldown timer between sends
  const startCooldown = useCallback((seconds: number) => {
    setCooldownRemaining(seconds);
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    cooldownTimerRef.current = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
          cooldownTimerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const skipCooldown = useCallback(() => {
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    cooldownTimerRef.current = null;
    setCooldownRemaining(0);
  }, []);

  // Focus textarea when lead changes
  useEffect(() => {
    if (started && currentDm && textareaRef.current && cooldownRemaining === 0) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [started, currentIndex, currentDm, cooldownRemaining]);

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

  // Mark current DM as sent + show flash + start cooldown + advance
  const markSentAndAdvance = useCallback(
    (dmId: string, bodyText: string) => {
      const days = followUpDays === 'none' ? null : parseInt(followUpDays);
      onDmSent(dmId, bodyText, days);
      setSentCount((c) => c + 1);
      setSending(false);
      setSentFlash(true);

      // Optimistically update local rate limit counts
      setRateLimit((prev) => prev ? {
        ...prev,
        dailyCount: prev.dailyCount + 1,
        weeklyCount: prev.weeklyCount + 1,
        canSend: prev.dailyCount + 1 < prev.dailyLimit && prev.weeklyCount + 1 < prev.weeklyLimit,
      } : prev);

      sentFlashTimeoutRef.current = setTimeout(() => {
        setSentFlash(false);
        setCurrentIndex((i) => i + 1);

        // Start 2-minute cooldown before next lead
        startCooldown(120);
        // Refresh rate limit from server periodically
        fetchRateLimit().then((rl) => {
          if (rl && !rl.canSend) {
            const reason = rl.dailyCount >= rl.dailyLimit
              ? `Daily limit reached (${rl.dailyCount}/${rl.dailyLimit}). Resume tomorrow.`
              : `Weekly limit reached (${rl.weeklyCount}/${rl.weeklyLimit}).`;
            setPauseReason(reason);
          }
        });
      }, 1500);
    },
    [followUpDays, onDmSent, startCooldown, fetchRateLimit]
  );

  // Send DM directly via extension
  const handleSend = useCallback(async () => {
    if (!currentDm || cooldownRemaining > 0 || pauseReason) return;
    const draft = drafts.get(currentDm.id);
    if (!draft || (!draft.subject && !draft.body)) return;

    setSending(true);
    const subject = draft.subject || draft.body.slice(0, 60).split('\n')[0];

    const result = await sendDm(currentDm.reddit_username, subject, draft.body);

    if (result.rateLimited) {
      setSending(false);
      const retryMs = result.retryAfterMs || 5 * 60 * 1000;
      const retryMin = Math.ceil(retryMs / 1000 / 60);
      setPauseReason(`Reddit rate limited — retry in ${retryMin} minute${retryMin !== 1 ? 's' : ''}`);
      // Auto-resume after the cooldown
      setTimeout(() => {
        setPauseReason(null);
        fetchRateLimit();
      }, retryMs);
      return;
    }

    if (result.success) {
      markSentAndAdvance(currentDm.id, draft.body);
    } else {
      setSending(false);
      toast.error(result.error || 'Failed to send DM');
    }
  }, [currentDm, drafts, sendDm, markSentAndAdvance, cooldownRemaining, pauseReason, fetchRateLimit]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sentFlashTimeoutRef.current) clearTimeout(sentFlashTimeoutRef.current);
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
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
        if (started && currentDm && !sentFlash && !sending && hasDraftContent && cooldownRemaining === 0 && !pauseReason) {
          handleSend();
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [started, isFinished, currentDm, sentFlash, sending, hasDraftContent, onClose, handleSend, cooldownRemaining, pauseReason]);

  function handleSkip() {
    if (!currentDm) return;
    setSkippedIds((prev) => new Set(prev).add(currentDm.id));
    setSending(false);
    setCurrentIndex((i) => i + 1);
  }

  function handleDismissLead() {
    if (!currentDm) return;
    onDismiss(currentDm.id);
    setDismissedIds((prev) => new Set(prev).add(currentDm.id));
    setSending(false);
    // Reset swipe position for the next card
    swipeX.set(0);
  }

  function onSwipeDragEnd(_: any, info: PanInfo) {
    if (swipeDisabled) return;
    if (info.offset.x < -150) {
      // Swipe left → dismiss: animate off, then reset and advance
      animate(swipeX, -1000, { duration: 0.3 }).then(() => {
        swipeX.set(0);
        handleDismissLead();
      });
    } else if (info.offset.x > 150 && hasDraftContent) {
      // Swipe right → send: animate off, then reset and send
      animate(swipeX, 1000, { duration: 0.3 }).then(() => {
        swipeX.set(0);
        handleSend();
      });
    }
    // Otherwise springs back via dragConstraints
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
                {rateLimit && (
                  <p className="text-xs text-muted-foreground">
                    Daily: {rateLimit.dailyCount}/{rateLimit.dailyLimit} &middot; Weekly: {rateLimit.weeklyCount}/{rateLimit.weeklyLimit}
                  </p>
                )}
              </div>

              {rateLimit && (rateLimit.dailyLimit - rateLimit.dailyCount) < queue.length && (rateLimit.dailyLimit - rateLimit.dailyCount) > 0 && (
                <div className="rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-3 text-xs text-yellow-700 dark:text-yellow-300">
                  Reddit&apos;s messaging guidelines limit daily sends. You have {rateLimit.dailyLimit - rateLimit.dailyCount} sends remaining today — {queue.length - (rateLimit.dailyLimit - rateLimit.dailyCount)} lead{queue.length - (rateLimit.dailyLimit - rateLimit.dailyCount) !== 1 ? 's' : ''} will need to wait until tomorrow.
                </div>
              )}

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
                disabled={queue.length === 0 || (rateLimit !== null && !rateLimit.canSend)}
              >
                {rateLimit && !rateLimit.canSend ? (
                  <>
                    <Clock className="mr-2 h-4 w-4" />
                    {rateLimit.dailyCount >= rateLimit.dailyLimit
                      ? 'Daily limit reached'
                      : rateLimit.weeklyCount >= rateLimit.weeklyLimit
                        ? 'Weekly limit reached'
                        : `Wait ${Math.ceil(rateLimit.cooldownSeconds / 60)}m`}
                  </>
                ) : (
                  <>
                    Start Sending
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </>
                )}
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

        {/* ── Active lead view — Tinder-style ── */}
        {started && !isFinished && currentDm && (
          <div className="flex-1 flex flex-col items-center">
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

            {/* Minimal header */}
            <div className="w-full px-6 py-3 border-b">
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

            {/* Pause / Cooldown states */}
            {pauseReason && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
                <Clock className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm font-medium">{pauseReason}</p>
                <Button variant="outline" size="sm" onClick={() => { setPauseReason(null); fetchRateLimit(); }}>
                  Check Again
                </Button>
              </div>
            )}

            {!pauseReason && cooldownRemaining > 0 && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
                <div className="text-2xl font-mono font-bold tabular-nums">
                  {Math.floor(cooldownRemaining / 60)}:{String(cooldownRemaining % 60).padStart(2, '0')}
                </div>
                <p className="text-xs text-muted-foreground">Next lead in {Math.floor(cooldownRemaining / 60)}:{String(cooldownRemaining % 60).padStart(2, '0')}...</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={skipCooldown}
                >
                  <SkipForward className="mr-1 h-3 w-3" />
                  Skip timer (increases rate limit risk)
                </Button>
              </div>
            )}

            {/* Swipeable card area */}
            {!pauseReason && cooldownRemaining === 0 && (
              <div className="flex-1 w-full max-w-2xl mx-auto flex flex-col px-6 py-6">
                {/* Card container */}
                <div className="relative flex-1 min-h-0">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentDm.id}
                      className="absolute inset-0 cursor-grab active:cursor-grabbing"
                      style={{ x: swipeX, rotate: swipeRotate }}
                      drag={swipeDisabled ? false : 'x'}
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={0.8}
                      onDragEnd={onSwipeDragEnd}
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ opacity: 0, transition: { duration: 0.15 } }}
                      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    >
                      {/* Swipe indicators on card edges */}
                      <motion.div
                        className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/90 text-white shadow-lg"
                        style={{ opacity: leftOverlayOpacity }}
                      >
                        <X className="h-6 w-6" />
                      </motion.div>
                      <motion.div
                        className={`absolute -right-3 top-1/2 -translate-y-1/2 z-10 flex h-12 w-12 items-center justify-center rounded-full shadow-lg ${hasDraftContent ? 'bg-green-500/90 text-white' : 'bg-muted text-muted-foreground/50'}`}
                        style={{ opacity: rightOverlayOpacityRaw }}
                      >
                        <Check className="h-6 w-6" />
                      </motion.div>

                      {/* The card itself */}
                      <div className="h-full rounded-2xl border bg-card shadow-xl overflow-hidden flex flex-col">
                        {/* Card header — who + context */}
                        <div className="px-5 pt-5 pb-3 border-b">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                              <span className="text-[10px] font-bold text-muted-foreground">
                                {currentDm.reddit_username.slice(0, 2).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <span className="text-sm font-semibold">u/{currentDm.reddit_username}</span>
                              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                {permInfo && (
                                  <span className={`font-medium ${permInfo.color}`}>{permInfo.label}</span>
                                )}
                                <span>&middot;</span>
                                <span>
                                  {currentDm.signal
                                    ? `r/${currentDm.signal.subreddit}`
                                    : (() => {
                                        const match = currentDm.source_thread_permalink?.match(/\/r\/([^/]+)/);
                                        return match ? `r/${match[1]}` : '';
                                      })()}
                                </span>
                                <span>&middot;</span>
                                <span>{timeAgo(currentDm.created_at)}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Their comment — context for the DM */}
                        {commentDisplay && (
                          <div className="px-5 py-3 border-b bg-muted/30">
                            <p className="text-[11px] font-medium text-muted-foreground mb-1">Their comment</p>
                            <p className="text-sm text-foreground/80 whitespace-pre-wrap break-words leading-relaxed">{commentDisplay}</p>
                          </div>
                        )}

                        {/* Card body — draft message */}
                        <div className="flex-1 p-5 overflow-y-auto">
                          {currentDraft && currentDraft.body ? (
                            <div className="space-y-3">
                              <p className="text-sm whitespace-pre-wrap leading-relaxed">{currentDraft.body}</p>
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
                          ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center gap-3">
                              <MessageCircle className="h-8 w-8 text-muted-foreground/30" />
                              <p className="text-sm text-muted-foreground">No draft yet</p>
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
                          )}
                        </div>

                        {/* Card footer — edit area */}
                        <div className="border-t p-3">
                          <div className="flex items-end gap-2">
                            <Textarea
                              ref={textareaRef}
                              value={currentDraft?.body || ''}
                              onChange={(e) => updateDraft(currentDm.id, 'body', e.target.value)}
                              placeholder={`Edit message to u/${currentDm.reddit_username}...`}
                              className="min-h-[44px] max-h-[120px] text-sm resize-none rounded-xl"
                              rows={2}
                            />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Tinder-style action buttons */}
                <div className="flex items-center justify-center gap-6 pt-5 pb-2">
                  <button
                    onClick={handleDismissLead}
                    disabled={sentFlash || swipeDisabled}
                    className="flex flex-col items-center gap-1.5 group disabled:opacity-40"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-muted-foreground/20 text-muted-foreground transition-colors group-hover:border-red-500/50 group-hover:text-red-500">
                      <X className="h-6 w-6" />
                    </div>
                    <span className="text-xs text-muted-foreground group-hover:text-red-500 transition-colors">Dismiss</span>
                  </button>
                  <button
                    onClick={handleSkip}
                    disabled={sentFlash || swipeDisabled}
                    className="flex flex-col items-center gap-1.5 group disabled:opacity-40"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-muted-foreground/20 text-muted-foreground transition-colors group-hover:border-blue-500/50 group-hover:text-blue-500">
                      <SkipForward className="h-4 w-4" />
                    </div>
                    <span className="text-xs text-muted-foreground group-hover:text-blue-500 transition-colors">Skip</span>
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={!hasDraftContent || sentFlash || sending || swipeDisabled}
                    className="flex flex-col items-center gap-1.5 group disabled:opacity-40"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-white transition-transform group-hover:scale-105 group-disabled:bg-green-500/50">
                      {sending ? (
                        <Loader2 className="h-6 w-6 animate-spin" />
                      ) : (
                        <Check className="h-6 w-6" />
                      )}
                    </div>
                    <span className="text-xs text-green-500 font-medium">Send</span>
                  </button>
                </div>

                {/* "Write a message" notice */}
                {!hasDraftContent && (
                  <p className="text-center text-xs text-yellow-600 dark:text-yellow-400 font-medium pt-1">
                    Write or generate a message before sending
                  </p>
                )}

                {/* Hint text */}
                <p className="text-center text-[10px] text-muted-foreground">
                  Swipe right to send &middot; Swipe left to dismiss &middot; {typeof navigator !== 'undefined' && navigator.platform?.includes('Mac') ? '\u2318' : 'Ctrl'}+Enter to send
                  {rateLimit && (
                    <span className="ml-1">&middot; {rateLimit.dailyCount}/{rateLimit.dailyLimit} today</span>
                  )}
                </p>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
