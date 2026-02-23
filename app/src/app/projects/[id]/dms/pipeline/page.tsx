'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { MoveRight } from 'lucide-react';
import { useProject } from '@/contexts/project-context';
import { PageTransition } from '@/components/motion';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PostFilterRow } from '@/components/pipeline/PostFilterRow';
import { PipelineToolbar } from '@/components/pipeline/PipelineToolbar';
import type { SortOption } from '@/components/pipeline/PipelineToolbar';
import { KanbanColumn } from '@/components/pipeline/KanbanColumn';
import { KanbanLeadCard } from '@/components/pipeline/KanbanLeadCard';
import { ColumnExpandOverlay } from '@/components/pipeline/ColumnExpandOverlay';
import { SendQueueMode } from '@/components/pipeline/SendQueueMode';
import { RedditBridgeIndicator } from '@/components/pipeline/RedditBridgeIndicator';
import type { PostInfo } from '@/components/pipeline/PostFilterRow';
import { toast } from 'sonner';
import { useRedditBridge } from '@/hooks/useRedditBridge';
import type { ChatPreview } from '@/hooks/useRedditBridge';
import type { OutreachDM, DmPipelineStage, MonitoredPost } from '@/types';
import { deduplicateMessages } from '@/lib/outreach/deduplicateMessages';

type KanbanStage = 'ready' | 'sent' | 'followup' | 'converted';

interface ReplySignal {
  id: string;
  title: string;
  subreddit: string;
  permalink: string;
  score: number;
  num_comments: number;
  body: string | null;
}

interface OutreachReplyRow {
  id: string;
  signal_id: string | null;
  status: string;
  signal?: ReplySignal | null;
}

export default function DmPipelinePage() {
  const { project } = useProject();
  const [allDms, setAllDms] = useState<OutreachDM[]>([]);
  const [posts, setPosts] = useState<OutreachReplyRow[]>([]);
  const [monitoredPosts, setMonitoredPosts] = useState<MonitoredPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Subreddit filter state
  const [trackedSubreddits, setTrackedSubreddits] = useState<string[]>([]);
  const [selectedSubreddits, setSelectedSubreddits] = useState<Set<string>>(new Set());
  const subredditPersistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [configRedditUsername, setConfigRedditUsername] = useState<string | undefined>();
  const [expandedColumn, setExpandedColumn] = useState<KanbanStage | null>(null);
  const [sendQueueActive, setSendQueueActive] = useState(false);
  const [followUpQueueActive, setFollowUpQueueActive] = useState(false);
  const [sendQueueStartId, setSendQueueStartId] = useState<string | null>(null);
  const [followUpQueueStartId, setFollowUpQueueStartId] = useState<string | null>(null);
  const previewAutoAdvancedRef = useRef<Map<string, string>>(new Map());
  const convoFallbackRef = useRef<Map<string, { stage: string; checkedAt: number }>>(new Map());

  // Drag-and-drop state
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const columnToStage: Record<string, string> = {
    ready: 'dm_ready',
    sent: 'dm_sent',
    followup: 'responded',
    converted: 'converted',
  };

  function onDragStart(event: DragStartEvent) {
    setActiveDragId(event.active.id as string);
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;

    const dmId = active.id as string;
    const targetColumn = over.id as string;
    const targetStage = columnToStage[targetColumn];
    if (!targetStage) return;

    // Find which column the card currently lives in
    const currentColumn = Object.entries(columns).find(([, dms]) =>
      dms.some((d) => d.id === dmId)
    )?.[0];
    if (currentColumn === targetColumn) return;

    handleStageChange(dmId, targetStage);
  }

  // Open send queue starting at a specific DM (for Ready column card clicks)
  const handleOpenReadyQueue = useCallback((dm: OutreachDM) => {
    setSendQueueStartId(dm.id);
    setSendQueueActive(true);
  }, []);

  // Open follow-up queue starting at a specific DM (for followup column card clicks)
  const handleOpenFollowUpQueue = useCallback((dm: OutreachDM) => {
    setFollowUpQueueStartId(dm.id);
    setFollowUpQueueActive(true);
  }, []);

  // General card click handler for ColumnExpandOverlay — routes to the right queue
  const handleCardClick = useCallback((dm: OutreachDM) => {
    if (['detected', 'dm_ready', 'draft_generated'].includes(dm.pipeline_stage)) {
      setExpandedColumn(null);
      setSendQueueStartId(dm.id);
      setSendQueueActive(true);
    } else if (dm.pipeline_stage === 'responded') {
      setExpandedColumn(null);
      setFollowUpQueueStartId(dm.id);
      setFollowUpQueueActive(true);
    }
  }, []);

  // Reddit Bridge
  const { status: bridgeStatus, reconciling, previews: chatPreviews, fetchPreviews, checkYouSentTo, checkTheyReplied, youSentToList, theyRepliedList, sendDm, fetchConversation } = useRedditBridge();
  const bridgeSyncKeyRef = useRef('');

  // Detect account mismatch: extension Reddit user vs project config user
  // Also blocks sync when config username isn't set (prevents cross-account pollution)
  const accountMismatch = useMemo(() => {
    // Extension not reporting a username — can't validate, allow existing data to show
    if (!bridgeStatus.redditUsername) return false;
    // No config username set — block sync until auto-link completes
    if (!configRedditUsername) return true;
    // Both present — compare
    const extUser = bridgeStatus.redditUsername.replace(/^\/?u\//, '').trim().toLowerCase();
    const cfgUser = configRedditUsername.replace(/^\/?u\//, '').trim().toLowerCase();
    return extUser !== cfgUser;
  }, [bridgeStatus.redditUsername, configRedditUsername]);

  // Auto-link: when no config username is set but extension reports one, save it
  useEffect(() => {
    if (!bridgeStatus.redditUsername || configRedditUsername) return;
    const username = bridgeStatus.redditUsername.replace(/^\/?u\//, '').trim();
    if (!username) return;

    (async () => {
      try {
        const res = await fetch('/api/outreach/config', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_id: project.id, reddit_username: username }),
        });
        if (res.ok) {
          setConfigRedditUsername(username);
          toast.success(`Linked Reddit account u/${username} to this project`);
        }
      } catch { /* silent */ }
    })();
  }, [bridgeStatus.redditUsername, configRedditUsername, project.id]);

  // Fetch all DMs
  const fetchDms = useCallback(async () => {
    try {
      const res = await fetch(`/api/outreach/dms?project_id=${project.id}`);
      const json = await res.json();
      if (json.error) {
        toast.error(json.error);
      } else {
        setAllDms(json.dms || []);
      }
    } catch {
      toast.error('Failed to load DMs');
    }
  }, [project.id]);

  // Persist chat previews to DB as dm_body (so they survive even when extension doesn't return them)
  const persistPreviews = useCallback(async (previewData: Record<string, ChatPreview>) => {
    if (!previewData || Object.keys(previewData).length === 0) return;
    try {
      await fetch('/api/outreach/dms/persist-previews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: project.id,
          previews: previewData,
          sender_username: bridgeStatus.redditUsername ?? undefined,
        }),
      });
    } catch { /* silent */ }
  }, [project.id, bridgeStatus.redditUsername]);

  // Wrapper: fetch previews from extension and persist to DB
  const fetchAndPersistPreviews = useCallback(async () => {
    if (accountMismatch) return {};
    const p = await fetchPreviews();
    if (Object.keys(p).length > 0) {
      await persistPreviews(p);
      await fetchDms();
    }
    return p;
  }, [fetchPreviews, persistPreviews, fetchDms, accountMismatch]);

  // Fetch replies (posts the user has replied to)
  const fetchPosts = useCallback(async () => {
    try {
      const res = await fetch(`/api/outreach/replies?project_id=${project.id}`);
      const json = await res.json();
      if (json.replies) {
        const active = (json.replies as OutreachReplyRow[]).filter(
          (r) => ['copied', 'posted', 'tracking'].includes(r.status)
        );
        setPosts(active);
      }
    } catch { /* silent */ }
  }, [project.id]);

  // Fetch monitored posts from DB
  const fetchMonitoredPosts = useCallback(async () => {
    try {
      const res = await fetch(`/api/outreach/posts?project_id=${project.id}`);
      const json = await res.json();
      if (json.posts) setMonitoredPosts(json.posts);
    } catch { /* silent */ }
  }, [project.id]);

  // Sync user posts from Reddit → DB (fire-and-forget on mount, await on scan)
  const syncPosts = useCallback(async () => {
    try {
      await fetch('/api/outreach/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: project.id }),
      });
      await fetchMonitoredPosts();
    } catch { /* silent */ }
  }, [project.id, fetchMonitoredPosts]);

  // Fetch filter preferences + reddit username from config
  const fetchFilterPreferences = useCallback(async () => {
    try {
      const res = await fetch(`/api/outreach/config?project_id=${project.id}`);
      const json = await res.json();
      const cfg = json.config;
      if (cfg?.reddit_username) {
        setConfigRedditUsername(cfg.reddit_username.replace(/^u\//, ''));
      }
      return (cfg?.pipeline_subreddit_filters as string[] | null) ?? null;
    } catch {
      return null;
    }
  }, [project.id]);

  // Derive tracked subreddits from monitored posts + monitored subs, apply saved prefs
  useEffect(() => {
    if (loading) return;

    // Derive unique subreddits from monitoredPosts (these are what actually show in pipeline)
    const fromPosts = new Set(monitoredPosts.map((mp) => mp.subreddit.toLowerCase()));

    // Also fetch from monitored_subs table as additional source
    (async () => {
      try {
        const subsRes = await fetch(`/api/outreach/monitored-subs?project_id=${project.id}`);
        const subsJson = await subsRes.json();
        const fromSubs: string[] = (subsJson.subs || [])
          .filter((s: { is_active?: boolean | null }) => s.is_active !== false)
          .map((s: { name: string }) => s.name.toLowerCase());
        for (const s of fromSubs) fromPosts.add(s);
      } catch { /* silent */ }

      const allTracked = Array.from(fromPosts).sort();
      if (allTracked.length === 0) return;

      setTrackedSubreddits(allTracked);

      // Apply saved filter preferences
      const saved = await fetchFilterPreferences();
      if (saved && Array.isArray(saved)) {
        const valid = new Set(saved.filter((s) => allTracked.includes(s.toLowerCase())).map((s) => s.toLowerCase()));
        setSelectedSubreddits(valid.size > 0 ? valid : new Set(allTracked));
      } else {
        setSelectedSubreddits(new Set(allTracked));
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, monitoredPosts, project.id, fetchFilterPreferences]);

  // Persist subreddit filter selections (debounced)
  const persistSubredditFilters = useCallback((selected: Set<string>, tracked: string[]) => {
    if (subredditPersistTimer.current) clearTimeout(subredditPersistTimer.current);
    subredditPersistTimer.current = setTimeout(async () => {
      const value = selected.size === tracked.length ? null : Array.from(selected);
      try {
        await fetch('/api/outreach/config', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_id: project.id, pipeline_subreddit_filters: value }),
        });
      } catch { /* silent */ }
    }, 500);
  }, [project.id]);

  const handleToggleSubreddit = useCallback((sub: string) => {
    setSelectedSubreddits((prev) => {
      const next = new Set(prev);
      if (next.has(sub)) next.delete(sub);
      else next.add(sub);
      persistSubredditFilters(next, trackedSubreddits);
      return next;
    });
  }, [trackedSubreddits, persistSubredditFilters]);

  const handleSelectAllSubreddits = useCallback(() => {
    const all = new Set(trackedSubreddits);
    setSelectedSubreddits(all);
    persistSubredditFilters(all, trackedSubreddits);
  }, [trackedSubreddits, persistSubredditFilters]);

  const handleDeselectAllSubreddits = useCallback(() => {
    const none = new Set<string>();
    setSelectedSubreddits(none);
    persistSubredditFilters(none, trackedSubreddits);
  }, [trackedSubreddits, persistSubredditFilters]);

  // Initial data load
  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([fetchDms(), fetchPosts(), fetchMonitoredPosts()]);
      setLoading(false);
      // Fire post sync in background after initial render
      syncPosts();
      // Fetch chat previews from extension and persist to DB
      fetchAndPersistPreviews();
      setTimeout(() => fetchAndPersistPreviews(), 5000);
      setTimeout(() => fetchAndPersistPreviews(), 15000);
    }
    init();

    // Poll for preview updates every 30s so data stays fresh as conversations happen
    const previewPoll = setInterval(() => fetchAndPersistPreviews(), 30_000);
    return () => clearInterval(previewPoll);
  }, [fetchDms, fetchPosts, fetchMonitoredPosts, syncPosts, fetchAndPersistPreviews]);

  // Auto-scan on mount
  useEffect(() => {
    async function autoScan() {
      try {
        const res = await fetch('/api/outreach/dms/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_id: project.id }),
        });
        const json = await res.json();
        if (json.scanned && json.count > 0) {
          toast.success(`Found ${json.count} new DM lead${json.count !== 1 ? 's' : ''}`);
          await fetchDms();
        }
      } catch { /* silent */ }
    }
    autoScan();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  // Reddit Bridge creation sync — server-side sync for NEW entries only.
  // Stage transitions are handled exclusively by the unified effect below.
  useEffect(() => {
    if (loading) return;
    if (accountMismatch) return; // Block sync when Reddit account doesn't match project
    const hasCounts = bridgeStatus.youSentToCount > 0 || bridgeStatus.theyRepliedCount > 0;
    const hasArrays = youSentToList.length > 0 || theyRepliedList.length > 0;
    if (!hasCounts && !hasArrays) return;

    async function sync() {
      let sentList = youSentToList;
      let repliedList = theyRepliedList;

      if (sentList.length === 0 && bridgeStatus.youSentToCount > 0) {
        try {
          sentList = await checkYouSentTo();
        } catch { /* silent */ }
      }
      if (repliedList.length === 0 && bridgeStatus.theyRepliedCount > 0) {
        try {
          repliedList = await checkTheyReplied();
        } catch { /* silent */ }
      }

      if (sentList.length === 0 && repliedList.length === 0) return;

      const sortedSent = [...sentList].sort().join(',');
      const sortedReplied = [...repliedList].sort().join(',');
      const key = `${sortedSent}|${sortedReplied}`;
      if (key === bridgeSyncKeyRef.current) return;
      bridgeSyncKeyRef.current = key;

      try {
        const currentPreviews = await fetchPreviews();
        const res = await fetch('/api/outreach/dms/bridge-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: project.id,
            youSentTo: sentList,
            theyReplied: repliedList,
            previews: currentPreviews,
            sender_username: bridgeStatus.redditUsername ?? undefined,
          }),
        });
        const json = await res.json();
        if (json.created > 0 || json.advanced > 0 || json.reconciled > 0) {
          toast.success(`Reddit sync: ${json.created} new, ${json.advanced + (json.reconciled || 0)} updated`);
        }
        // NOTE: no fetchDms() here — the unified effect handles stage sync
      } catch (err) {
        console.error('[Bridge Sync] failed:', err);
      }
    }
    sync();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, accountMismatch, bridgeStatus.youSentToCount, bridgeStatus.theyRepliedCount, youSentToList, theyRepliedList]);

  /** Single source of truth for DM stage — pure function, no side effects */
  function computeDesiredStage(
    currentStage: string,
    preview: { fromYou: boolean } | undefined,
    conversationLastFromYou: boolean | undefined,
  ): string {
    // Priority 1: Conversation data (most reliable)
    if (conversationLastFromYou !== undefined) {
      return conversationLastFromYou ? 'dm_sent' : 'responded';
    }
    // Priority 2: Preview data (reliable for sidebar-visible chats)
    if (preview && typeof preview.fromYou === 'boolean') {
      return preview.fromYou ? 'dm_sent' : 'responded';
    }
    // Priority 3: No data → no change (safe default)
    return currentStage;
  }

  // Unified stage-sync effect — ONE effect, ONE timer, ONE decision function.
  // Replaces 4 competing effects (bridge-sync advancement, reply scan,
  // preview auto-advance, conversation fallback) with a single source of truth.
  useEffect(() => {
    if (loading) return;
    if (accountMismatch) return; // Block stage sync when Reddit account doesn't match project
    if (!bridgeStatus.extensionInstalled || bridgeStatus.checking) return;

    const redditUser = bridgeStatus.redditUsername ?? configRedditUsername;
    const skipStages = new Set(['converted', 'closed']);

    async function runStageSync() {
      // 1. Fetch fresh previews
      let freshPreviews: Record<string, ChatPreview> = {};
      try {
        freshPreviews = await fetchPreviews();
        if (Object.keys(freshPreviews).length > 0) {
          persistPreviews(freshPreviews);
        }
      } catch { /* silent */ }

      // 2. Re-fetch DMs to get latest state from DB
      let currentDms: OutreachDM[] = [];
      try {
        const res = await fetch(`/api/outreach/dms?project_id=${project.id}`);
        const json = await res.json();
        currentDms = json.dms || [];
        setAllDms(currentDms);
      } catch { return; }

      const activeDms = currentDms.filter(
        (d) => (d.pipeline_stage === 'dm_sent' || d.pipeline_stage === 'responded') && !skipStages.has(d.pipeline_stage)
      );
      if (activeDms.length === 0) return;

      let advancedCount = 0;

      for (const dm of activeDms) {
        const username = dm.reddit_username.toLowerCase();
        const preview = freshPreviews[username];

        // Try conversation fetch for DMs without preview (throttled)
        let conversationLastFromYou: boolean | undefined;
        if (!preview && fetchConversation) {
          const now = Date.now();
          const cached = convoFallbackRef.current.get(dm.id);
          if (!cached || now - cached.checkedAt >= 30_000) {
            try {
              const rawMessages = await fetchConversation(dm.reddit_username);
              if (rawMessages && rawMessages.length > 0) {
                const processed = deduplicateMessages(
                  rawMessages,
                  dm.reddit_username,
                  redditUser,
                  dm.dm_body ?? undefined,
                );

                const lastMsg = processed[processed.length - 1];
                let lastFromYou = lastMsg?.isFromYou;

                if (lastFromYou === undefined && rawMessages.length > 0) {
                  const lastRaw = rawMessages[rawMessages.length - 1];
                  if (typeof lastRaw.isFromYou === 'boolean') {
                    lastFromYou = lastRaw.isFromYou;
                  }
                }

                conversationLastFromYou = lastFromYou;

                // Persist reply text snippet
                const theirLastMsg = [...processed].reverse().find((m) => m.isFromYou === false);
                if (theirLastMsg?.text && theirLastMsg.text !== dm.last_reply_text) {
                  fetch('/api/outreach/dms/stage', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dm_id: dm.id, last_reply_text: theirLastMsg.text }),
                  }).catch(() => {});
                }
              }
              convoFallbackRef.current.set(dm.id, {
                stage: conversationLastFromYou !== undefined
                  ? (conversationLastFromYou ? 'dm_sent' : 'responded')
                  : dm.pipeline_stage,
                checkedAt: now,
              });
            } catch {
              // silent — no conversation data available
            }
          }
        }

        const desiredStage = computeDesiredStage(dm.pipeline_stage, preview, conversationLastFromYou);

        // Skip if already correct
        if (desiredStage === dm.pipeline_stage) {
          previewAutoAdvancedRef.current.set(dm.id, desiredStage);
          continue;
        }

        // Skip if we already processed this exact transition
        if (previewAutoAdvancedRef.current.get(dm.id) === desiredStage) continue;

        previewAutoAdvancedRef.current.set(dm.id, desiredStage);
        await handleStageChange(dm.id, desiredStage, undefined, true);
        if (desiredStage === 'responded') advancedCount++;
      }

      if (advancedCount > 0) {
        toast.success(`Found ${advancedCount} new repl${advancedCount !== 1 ? 'ies' : 'y'}`);
      }
    }

    // Run once immediately on mount
    runStageSync();

    // Then every 30s
    const interval = setInterval(runStageSync, 30_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, accountMismatch]);

  // Manual scan
  async function handleScan() {
    setScanning(true);
    try {
      // Sync posts first (picks up any new Reddit posts) — with 30s timeout
      const syncController = new AbortController();
      const syncTimeout = setTimeout(() => syncController.abort(), 30_000);
      try {
        await fetch('/api/outreach/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_id: project.id }),
          signal: syncController.signal,
        });
        await fetchMonitoredPosts();
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') {
          console.warn('Post sync timed out after 30s — continuing with scan');
        }
        // Don't block scan if post sync fails
      } finally {
        clearTimeout(syncTimeout);
      }

      // Scan threads — with 60s timeout
      const scanController = new AbortController();
      const scanTimeout = setTimeout(() => scanController.abort(), 60_000);
      try {
        const res = await fetch('/api/outreach/dms/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_id: project.id, force: true }),
          signal: scanController.signal,
        });
        const json = await res.json();
        if (json.error) {
          toast.error(json.error);
        } else if (json.scanned) {
          toast.success(`Found ${json.count} new DM lead${json.count !== 1 ? 's' : ''}`);
          await fetchDms();
        } else if (json.message) {
          toast.info(json.message);
        } else {
          toast.info('Data is fresh — no scan needed');
        }
      } finally {
        clearTimeout(scanTimeout);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        toast.error('Scan timed out — try again');
      } else {
        toast.error('Failed to scan threads');
      }
    }
    setScanning(false);
  }

  // Stage change handler — silent flag suppresses individual toasts during bulk reconciliation
  async function handleStageChange(dmId: string, stage: string, outcome?: string, silent?: boolean) {
    setAllDms((prev) =>
      prev.map((d) =>
        d.id === dmId
          ? { ...d, pipeline_stage: stage as DmPipelineStage, outcome: outcome || d.outcome }
          : d
      )
    );

    try {
      const res = await fetch('/api/outreach/dms/stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dm_id: dmId, pipeline_stage: stage, outcome }),
      });
      const json = await res.json();
      if (json.error) {
        toast.error(json.error);
        fetchDms();
      } else if (!silent) {
        toast.success(`Updated to ${stage.replace(/_/g, ' ')}`);
      }
    } catch {
      toast.error('Failed to update stage');
      fetchDms();
    }
  }

  // Dismiss handler
  async function handleDismiss(dmId: string) {
    handleStageChange(dmId, 'closed', 'dismissed');
  }

  // Send queue: mark DM as sent via API
  async function handleDmSent(dmId: string, dmContent: string, followUpDays: number | null) {
    try {
      await fetch('/api/outreach/dms/sent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dm_id: dmId, dm_content: dmContent, follow_up_days: followUpDays }),
      });
      handleStageChange(dmId, 'dm_sent', undefined, true);
    } catch {
      toast.error('Failed to mark DM as sent');
    }
  }

  // Helper: normalize permalink for comparison
  const normalizePermalink = (p: string) => p.replace(/\/$/, '');

  // Derive post filter cards from monitored posts + DM permalink matching
  const postInfos = useMemo<PostInfo[]>(() => {
    // Build Map<normalizedPermalink, DM[]> for O(N+M) lookup
    const dmsByPermalink = new Map<string, OutreachDM[]>();
    for (const dm of allDms) {
      const key = normalizePermalink(dm.source_thread_permalink);
      // Skip chat:// DMs — they don't belong to any post
      if (key.startsWith('chat://')) continue;
      const arr = dmsByPermalink.get(key) || [];
      arr.push(dm);
      dmsByPermalink.set(key, arr);
    }

    // Filter to only tracked subreddits (if any tracked)
    const filteredMonitoredPosts = trackedSubreddits.length > 0
      ? monitoredPosts.filter((mp) => trackedSubreddits.includes(mp.subreddit.toLowerCase()))
      : monitoredPosts;

    // Map monitored posts → PostInfo (even 0-lead posts)
    return filteredMonitoredPosts.map((mp) => {
      const key = normalizePermalink(mp.permalink);
      const dms = dmsByPermalink.get(key) || [];

      const stages = { ready: 0, sent: 0, followup: 0, converted: 0 };
      for (const dm of dms) {
        if (['detected', 'dm_ready', 'draft_generated'].includes(dm.pipeline_stage)) stages.ready++;
        else if (dm.pipeline_stage === 'dm_sent') stages.sent++;
        else if (dm.pipeline_stage === 'responded') stages.followup++;
        else if (dm.pipeline_stage === 'converted') stages.converted++;
      }

      // Only use high-res preview_url (thumbnail is 140px and blurry when scaled)
      const imageUrl = mp.preview_url || null;

      return {
        postId: mp.id,
        permalink: mp.permalink,
        title: mp.title,
        subreddit: mp.subreddit,
        score: mp.score,
        numComments: mp.num_comments,
        selftext: mp.selftext,
        imageUrl,
        leadsCount: dms.length,
        stages,
      };
    }).sort((a, b) => b.leadsCount - a.leadsCount);
  }, [monitoredPosts, allDms, trackedSubreddits]);

  // Column mapping
  const columns = useMemo(() => {
    let filtered = allDms;

    // Filter by selected post (permalink match)
    if (selectedPostId) {
      // When a specific post is selected, show all leads from that post (no subreddit filter)
      const selectedPost = postInfos.find((p) => p.postId === selectedPostId);
      if (selectedPost) {
        const selectedPermalink = normalizePermalink(selectedPost.permalink);
        filtered = filtered.filter(
          (d) => normalizePermalink(d.source_thread_permalink) === selectedPermalink
        );
      }
    } else if (trackedSubreddits.length > 0) {
      // "All Posts" mode — filter by selected subreddits
      filtered = filtered.filter((d) => {
        const permalink = d.source_thread_permalink;
        const match = permalink.match(/\/r\/([^/]+)\//);
        if (!match) return false; // chat:// or malformed — filter out
        return selectedSubreddits.has(match[1].toLowerCase());
      });
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((d) => d.reddit_username.toLowerCase().includes(q));
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortBy === 'highest_intent') return b.permission_score - a.permission_score;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return {
      ready: sorted.filter((d) => ['detected', 'dm_ready', 'draft_generated'].includes(d.pipeline_stage)),
      sent: sorted.filter((d) => d.pipeline_stage === 'dm_sent'),
      followup: sorted.filter((d) => d.pipeline_stage === 'responded'),
      converted: sorted.filter((d) => d.pipeline_stage === 'converted'),
    };
  }, [allDms, selectedPostId, searchQuery, sortBy, postInfos, trackedSubreddits, selectedSubreddits]);

  // Lead count for filtered "All Posts" view
  const filteredLeadCount = useMemo(() => {
    if (trackedSubreddits.length === 0) return allDms.length;
    return allDms.filter((d) => {
      const match = d.source_thread_permalink.match(/\/r\/([^/]+)\//);
      if (!match) return false;
      return selectedSubreddits.has(match[1].toLowerCase());
    }).length;
  }, [allDms, trackedSubreddits, selectedSubreddits]);

  // Selection handlers
  function handleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSelectAll() {
    if (selectedIds.size === columns.ready.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(columns.ready.map((d) => d.id)));
    }
  }

  function handleDismissSelected() {
    for (const id of selectedIds) {
      handleDismiss(id);
    }
    setSelectedIds(new Set());
  }

  function handleDmSelected() {
    const firstSelected = columns.ready.find((d) => selectedIds.has(d.id));
    if (firstSelected) {
      setSendQueueStartId(firstSelected.id);
      setSendQueueActive(true);
    }
  }

  function handleMarkSentSelected() {
    for (const id of selectedIds) {
      handleStageChange(id, 'dm_sent');
    }
    toast.success(`Marked ${selectedIds.size} lead${selectedIds.size !== 1 ? 's' : ''} as sent`);
    setSelectedIds(new Set());
  }

  // Reorder DM array so a specific DM comes first (rest follow in original order)
  function reorderFromId(dms: OutreachDM[], startId: string): OutreachDM[] {
    const idx = dms.findIndex((d) => d.id === startId);
    if (idx <= 0) return dms;
    return [dms[idx], ...dms.slice(0, idx), ...dms.slice(idx + 1)];
  }

  // Get overlay data
  const expandedTitle = expandedColumn
    ? { ready: 'Ready to DM', sent: 'DM Sent', followup: 'Follow Up', converted: 'Converted' }[expandedColumn]
    : '';
  const expandedColor = expandedColumn
    ? { ready: 'text-blue-600', sent: 'text-orange-600', followup: 'text-yellow-600', converted: 'text-green-600' }[expandedColumn]
    : '';
  const expandedDms = expandedColumn ? columns[expandedColumn] : [];

  if (loading) {
    return (
      <PageTransition>
        <div className="flex h-full flex-col">
          <Header title="DM Pipeline" />
          <div className="flex-1 overflow-auto">
            <div className="mx-auto max-w-[1800px] p-6 space-y-6">
              <div className="grid grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-[500px] rounded-xl" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="flex h-full flex-col">
        <Header title="DM Pipeline" />
        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-[1800px] p-6 space-y-5">
            {/* Post filter row */}
            <PostFilterRow
              posts={postInfos}
              allDms={allDms}
              selectedPostId={selectedPostId}
              onSelectPost={setSelectedPostId}
              trackedSubreddits={trackedSubreddits}
              selectedSubreddits={selectedSubreddits}
              onToggleSubreddit={handleToggleSubreddit}
              onSelectAllSubreddits={handleSelectAllSubreddits}
              onDeselectAllSubreddits={handleDeselectAllSubreddits}
              filteredLeadCount={filteredLeadCount}
            />

            {/* Reddit Bridge status */}
            <RedditBridgeIndicator
              extensionInstalled={bridgeStatus.extensionInstalled}
              redditLoggedIn={bridgeStatus.redditLoggedIn}
              redditUsername={bridgeStatus.redditUsername}
              checking={bridgeStatus.checking}
              reconciling={reconciling}
              capturedCount={bridgeStatus.capturedCount}
              youSentToCount={bridgeStatus.youSentToCount}
              theyRepliedCount={bridgeStatus.theyRepliedCount}
              configRedditUsername={configRedditUsername}
            />

            {/* Toolbar */}
            <PipelineToolbar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              sortBy={sortBy}
              onSortChange={setSortBy}
              scanning={scanning}
              onScan={handleScan}
            />

            {/* Kanban board */}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
            <div className="overflow-x-auto -mx-6 px-6">
            <div className="grid grid-cols-[minmax(320px,1fr)_32px_minmax(320px,1fr)_32px_minmax(320px,1fr)_32px_minmax(320px,1fr)] gap-0 items-stretch min-w-[1376px]">
              {/* Ready to DM */}
              <KanbanColumn
                title="Ready to DM"
                columnId="ready"
                count={columns.ready.length}
                colorClass="text-blue-600"
                borderColor="rgb(59, 130, 246)"
                onExpandColumn={() => setExpandedColumn('ready')}
                emptyMessage="No leads ready for DM yet. Scan threads to find new leads."
                headerAction={columns.ready.length > 0 ? (
                  <Button
                    size="sm"
                    className="w-full text-xs font-semibold"
                    onClick={() => setSendQueueActive(true)}
                  >
                    <MoveRight className="mr-1.5 h-3.5 w-3.5" />
                    Start Sending ({columns.ready.length})
                  </Button>
                ) : undefined}
              >
                {columns.ready.map((dm) => (
                  <KanbanLeadCard
                    key={dm.id}
                    dm={dm}
                    stage="ready"
                    isDragging={dm.id === activeDragId}
                    selected={selectedIds.has(dm.id)}
                    onSelect={handleSelect}
                    onDraft={handleOpenReadyQueue}
                    onStageChange={handleStageChange}
                    onDismiss={handleDismiss}
                    onOpenConversation={handleOpenReadyQueue}
                  />
                ))}
              </KanbanColumn>

              {/* Arrow */}
              <div className="flex items-start justify-center w-8 shrink-0">
                <div className="sticky top-1/2 -translate-y-1/2">
                  <MoveRight className="h-4 w-4 text-muted-foreground/40" />
                </div>
              </div>

              {/* DM Sent */}
              <KanbanColumn
                title="DM Sent"
                columnId="sent"
                count={columns.sent.length}
                colorClass="text-orange-600"
                borderColor="rgb(249, 115, 22)"
                onExpandColumn={() => setExpandedColumn('sent')}
                emptyMessage="No DMs sent yet. Draft and send DMs from the Ready column."
              >
                {columns.sent.map((dm) => (
                  <KanbanLeadCard
                    key={dm.id}
                    dm={dm}
                    stage="sent"
                    isDragging={dm.id === activeDragId}
                    chatPreview={chatPreviews[dm.reddit_username.toLowerCase()]}
                    onStageChange={handleStageChange}
                  />
                ))}
              </KanbanColumn>

              {/* Arrow */}
              <div className="flex items-start justify-center w-8 shrink-0">
                <div className="sticky top-1/2 -translate-y-1/2">
                  <MoveRight className="h-4 w-4 text-muted-foreground/40" />
                </div>
              </div>

              {/* Follow Up */}
              <KanbanColumn
                title="Follow Up"
                columnId="followup"
                count={columns.followup.length}
                colorClass="text-yellow-600"
                borderColor="rgb(234, 179, 8)"
                onExpandColumn={() => setExpandedColumn('followup')}
                emptyMessage="No follow-ups needed. Leads that respond will appear here."
                headerAction={columns.followup.length > 0 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs font-semibold"
                    onClick={() => setFollowUpQueueActive(true)}
                  >
                    <MoveRight className="mr-1.5 h-3.5 w-3.5" />
                    Follow Up ({columns.followup.length})
                  </Button>
                ) : undefined}
              >
                {columns.followup.map((dm) => (
                  <KanbanLeadCard
                    key={dm.id}
                    dm={dm}
                    stage="followup"
                    isDragging={dm.id === activeDragId}
                    chatPreview={chatPreviews[dm.reddit_username.toLowerCase()]}
                    onDraft={handleOpenFollowUpQueue}
                    onStageChange={handleStageChange}
                    onOpenConversation={handleOpenFollowUpQueue}
                  />
                ))}
              </KanbanColumn>

              {/* Arrow */}
              <div className="flex items-start justify-center w-8 shrink-0">
                <div className="sticky top-1/2 -translate-y-1/2">
                  <MoveRight className="h-4 w-4 text-muted-foreground/40" />
                </div>
              </div>

              {/* Converted */}
              <KanbanColumn
                title="Converted"
                columnId="converted"
                count={columns.converted.length}
                colorClass="text-green-600"
                borderColor="rgb(34, 197, 94)"
                onExpandColumn={() => setExpandedColumn('converted')}
                emptyMessage="No conversions yet. Keep building relationships!"
              >
                {columns.converted.map((dm) => (
                  <KanbanLeadCard
                    key={dm.id}
                    dm={dm}
                    stage="converted"
                    isDragging={dm.id === activeDragId}
                    onStageChange={handleStageChange}
                  />
                ))}
              </KanbanColumn>
            </div>
            </div>

            {/* Ghost card overlay while dragging */}
            <DragOverlay dropAnimation={null}>
              {activeDragId ? (() => {
                const dragDm = allDms.find((d) => d.id === activeDragId);
                if (!dragDm) return null;
                const dragStage: KanbanStage =
                  ['detected', 'dm_ready', 'draft_generated'].includes(dragDm.pipeline_stage) ? 'ready'
                  : dragDm.pipeline_stage === 'dm_sent' ? 'sent'
                  : dragDm.pipeline_stage === 'responded' ? 'followup'
                  : 'converted';
                return (
                  <div className="opacity-80 rotate-2 w-[320px]">
                    <KanbanLeadCard
                      dm={dragDm}
                      stage={dragStage}
                      chatPreview={chatPreviews[dragDm.reddit_username.toLowerCase()]}
                      onStageChange={() => {}}
                    />
                  </div>
                );
              })() : null}
            </DragOverlay>
            </DndContext>
          </div>
        </div>
      </div>

      {/* Column expand overlay */}
      <ColumnExpandOverlay
        stage={expandedColumn}
        title={expandedTitle}
        colorClass={expandedColor}
        dms={expandedDms}
        onClose={() => setExpandedColumn(null)}
        onDraft={handleCardClick}
        onStageChange={handleStageChange}
        onDismiss={handleDismiss}
        onOpenConversation={handleCardClick}
      />

      {/* Send queue mode (Ready to DM cards) */}
      {sendQueueActive && (() => {
        const list = sendQueueStartId
          ? reorderFromId(columns.ready, sendQueueStartId)
          : columns.ready;
        return (
          <SendQueueMode
            dms={list}
            projectId={project.id}
            onClose={() => { setSendQueueActive(false); setSendQueueStartId(null); fetchDms(); }}
            onStageChange={handleStageChange}
            onDmSent={handleDmSent}
            onDismiss={handleDismiss}
            sendDm={sendDm}
            fetchConversation={fetchConversation}
            chatPreviews={chatPreviews}
            redditUsername={bridgeStatus.redditUsername ?? configRedditUsername}
          />
        );
      })()}

      {/* Follow-up queue mode */}
      {followUpQueueActive && (() => {
        const list = followUpQueueStartId
          ? reorderFromId(columns.followup, followUpQueueStartId)
          : columns.followup;
        return (
          <SendQueueMode
            dms={list}
            projectId={project.id}
            onClose={() => { setFollowUpQueueActive(false); setFollowUpQueueStartId(null); fetchDms(); }}
            onStageChange={handleStageChange}
            onDmSent={handleDmSent}
            onDismiss={handleDismiss}
            sendDm={sendDm}
            fetchConversation={fetchConversation}
            chatPreviews={chatPreviews}
            redditUsername={bridgeStatus.redditUsername ?? configRedditUsername}
          />
        );
      })()}

    </PageTransition>
  );
}
