'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MoveRight } from 'lucide-react';
import { useProject } from '@/contexts/project-context';
import { PageTransition } from '@/components/motion';
import { Header } from '@/components/layout/header';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DmDraftBuilder } from '@/components/outreach/DmDraftBuilder';
import { PostFilterRow } from '@/components/pipeline/PostFilterRow';
import { PipelineToolbar } from '@/components/pipeline/PipelineToolbar';
import type { SortOption } from '@/components/pipeline/PipelineToolbar';
import { KanbanColumn } from '@/components/pipeline/KanbanColumn';
import { KanbanLeadCard } from '@/components/pipeline/KanbanLeadCard';
import { ColumnExpandOverlay } from '@/components/pipeline/ColumnExpandOverlay';
import { RedditBridgeIndicator } from '@/components/pipeline/RedditBridgeIndicator';
import type { PostInfo } from '@/components/pipeline/PostFilterRow';
import { toast } from 'sonner';
import { useRedditBridge } from '@/hooks/useRedditBridge';
import type { OutreachDM, DmPipelineStage } from '@/types';

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
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [expandedColumn, setExpandedColumn] = useState<KanbanStage | null>(null);
  const [draftingDm, setDraftingDm] = useState<OutreachDM | null>(null);

  // Reddit Bridge
  const { status: bridgeStatus, reconciling, previews: chatPreviews, reconcile, checkYouSentTo, checkTheyReplied } = useRedditBridge();
  const reconcileRan = useRef(false);
  const allDmsRef = useRef<OutreachDM[]>([]);

  // Keep ref in sync so delayed reconciliation always has latest data
  allDmsRef.current = allDms;

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

  // Initial data load
  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([fetchDms(), fetchPosts()]);
      setLoading(false);
    }
    init();
  }, [fetchDms, fetchPosts]);

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
          reconcileRan.current = false;
        }
      } catch { /* silent */ }
    }
    autoScan();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  // Reddit Bridge reconciliation — polls extension data until stable, then reconciles.
  // The extension proactively scans in the background, so data is usually ready instantly.
  // If not (fresh install), we poll every 3s until counts stabilize.
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (
      loading ||
      reconcileRan.current ||
      !bridgeStatus.extensionInstalled ||
      !bridgeStatus.redditLoggedIn ||
      allDms.length === 0
    ) return;

    reconcileRan.current = true;

    const silentStageChange = (dmId: string, stage: string) => handleStageChange(dmId, stage, undefined, true);

    function showToast(sent: number, replied: number) {
      const parts: string[] = [];
      if (sent > 0) parts.push(`${sent} sent DM${sent !== 1 ? 's' : ''}`);
      if (replied > 0) parts.push(`${replied} repl${replied !== 1 ? 'ies' : 'y'}`);
      if (parts.length > 0) {
        toast.success(`Auto-detected from Reddit: ${parts.join(', ')}`);
      }
    }

    let cancelled = false;
    let prevSentCount = 0;
    let prevRepliedCount = 0;
    let stableChecks = 0;

    async function pollAndReconcile() {
      setSyncing(true);

      // Poll until data stabilizes (same counts for 2 consecutive checks)
      const MAX_POLLS = 8; // 8 × 3s = 24s max wait
      for (let i = 0; i < MAX_POLLS && !cancelled; i++) {
        const sent = await checkYouSentTo();
        const replied = await checkTheyReplied();
        const sentCount = sent.length;
        const repliedCount = replied.length;

        if (sentCount === prevSentCount && repliedCount === prevRepliedCount && (sentCount > 0 || repliedCount > 0)) {
          stableChecks++;
        } else {
          stableChecks = 0;
        }
        prevSentCount = sentCount;
        prevRepliedCount = repliedCount;

        // Data is stable (same for 2 checks) or we have data on first check
        if (stableChecks >= 1 || (i === 0 && (sentCount > 0 || repliedCount > 0))) {
          break;
        }

        // Wait 3s before next poll
        await new Promise((r) => setTimeout(r, 3000));
      }

      if (cancelled) return;

      // Reconcile with the stable data
      const currentDms = allDmsRef.current;
      if (currentDms.length > 0) {
        const { sent, replied } = await reconcile(currentDms, silentStageChange);
        showToast(sent, replied);
      }
      setSyncing(false);
    }

    pollAndReconcile();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, bridgeStatus.extensionInstalled, bridgeStatus.redditLoggedIn, allDms.length]);

  // Manual scan
  async function handleScan() {
    setScanning(true);
    try {
      const res = await fetch('/api/outreach/dms/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: project.id, force: true }),
      });
      const json = await res.json();
      if (json.error) {
        toast.error(json.error);
      } else if (json.scanned) {
        toast.success(`Found ${json.count} new DM lead${json.count !== 1 ? 's' : ''}`);
        await fetchDms();
        reconcileRan.current = false; // re-trigger reconciliation with fresh data
      } else if (json.message) {
        toast.info(json.message);
      } else {
        toast.info('Data is fresh — no scan needed');
      }
    } catch {
      toast.error('Failed to scan threads');
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

  // Derive post filter cards from DMs grouped by source signal
  const postInfos = useMemo<PostInfo[]>(() => {
    const signalMap = new Map<string, PostInfo>();

    // Build from DMs — each DM has a source_signal_id and signal data
    for (const dm of allDms) {
      if (!dm.source_signal_id || !dm.signal) continue;
      if (signalMap.has(dm.source_signal_id)) {
        // Already tracked, just update counts
        const existing = signalMap.get(dm.source_signal_id)!;
        existing.leadsCount++;
        if (['detected', 'dm_ready', 'draft_generated'].includes(dm.pipeline_stage)) existing.stages.ready++;
        else if (dm.pipeline_stage === 'dm_sent') existing.stages.sent++;
        else if (dm.pipeline_stage === 'responded') existing.stages.followup++;
        else if (dm.pipeline_stage === 'converted') existing.stages.converted++;
        continue;
      }

      const stages = {
        ready: ['detected', 'dm_ready', 'draft_generated'].includes(dm.pipeline_stage) ? 1 : 0,
        sent: dm.pipeline_stage === 'dm_sent' ? 1 : 0,
        followup: dm.pipeline_stage === 'responded' ? 1 : 0,
        converted: dm.pipeline_stage === 'converted' ? 1 : 0,
      };

      signalMap.set(dm.source_signal_id, {
        signalId: dm.source_signal_id,
        title: dm.signal.title,
        subreddit: dm.signal.subreddit,
        score: dm.signal.score || 0,
        numComments: dm.signal.num_comments || 0,
        body: null,
        leadsCount: 1,
        stages,
      });
    }

    // Also merge any outreach_replies that have linked signals
    for (const reply of posts) {
      if (!reply.signal_id || !reply.signal) continue;
      if (signalMap.has(reply.signal_id)) continue;

      const dmsForSignal = allDms.filter((d) => d.source_signal_id === reply.signal_id);
      const stages = {
        ready: dmsForSignal.filter((d) => ['detected', 'dm_ready', 'draft_generated'].includes(d.pipeline_stage)).length,
        sent: dmsForSignal.filter((d) => d.pipeline_stage === 'dm_sent').length,
        followup: dmsForSignal.filter((d) => d.pipeline_stage === 'responded').length,
        converted: dmsForSignal.filter((d) => d.pipeline_stage === 'converted').length,
      };

      signalMap.set(reply.signal_id, {
        signalId: reply.signal_id,
        title: reply.signal.title,
        subreddit: reply.signal.subreddit,
        score: reply.signal.score,
        numComments: reply.signal.num_comments,
        body: reply.signal.body,
        leadsCount: dmsForSignal.length,
        stages,
      });
    }

    // Sort by lead count descending
    return Array.from(signalMap.values()).sort((a, b) => b.leadsCount - a.leadsCount);
  }, [posts, allDms]);

  // Column mapping
  const columns = useMemo(() => {
    let filtered = allDms;

    // Filter by selected post
    if (selectedPostId) {
      filtered = filtered.filter((d) => d.source_signal_id === selectedPostId);
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
  }, [allDms, selectedPostId, searchQuery, sortBy]);

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
    // Draft the first selected DM
    const firstSelected = columns.ready.find((d) => selectedIds.has(d.id));
    if (firstSelected) setDraftingDm(firstSelected);
  }

  function handleMarkSentSelected() {
    for (const id of selectedIds) {
      handleStageChange(id, 'dm_sent');
    }
    toast.success(`Marked ${selectedIds.size} lead${selectedIds.size !== 1 ? 's' : ''} as sent`);
    setSelectedIds(new Set());
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
            <div className="mx-auto max-w-[1400px] p-6 space-y-6">
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
          <div className="mx-auto max-w-[1400px] p-6 space-y-5">
            {/* Post filter row */}
            <PostFilterRow
              posts={postInfos}
              allDms={allDms}
              selectedPostId={selectedPostId}
              onSelectPost={setSelectedPostId}
            />

            {/* Reddit Bridge status */}
            <RedditBridgeIndicator
              extensionInstalled={bridgeStatus.extensionInstalled}
              redditLoggedIn={bridgeStatus.redditLoggedIn}
              redditUsername={bridgeStatus.redditUsername}
              checking={bridgeStatus.checking}
              reconciling={reconciling}
              syncing={syncing}
              capturedCount={bridgeStatus.capturedCount}
              youSentToCount={bridgeStatus.youSentToCount}
              theyRepliedCount={bridgeStatus.theyRepliedCount}
            />

            {/* Toolbar */}
            <PipelineToolbar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              sortBy={sortBy}
              onSortChange={setSortBy}
              selectedCount={selectedIds.size}
              onSelectAll={handleSelectAll}
              onDismissSelected={handleDismissSelected}
              onDmSelected={handleDmSelected}
              onMarkSentSelected={handleMarkSentSelected}
              scanning={scanning}
              onScan={handleScan}
            />

            {/* Kanban board */}
            <div className="overflow-x-auto -mx-6 px-6">
            <div className="grid grid-cols-[minmax(260px,1fr)_32px_minmax(260px,1fr)_32px_minmax(260px,1fr)_32px_minmax(260px,1fr)] gap-0 items-stretch min-w-[1136px]">
              {/* Ready to DM */}
              <KanbanColumn
                title="Ready to DM"
                count={columns.ready.length}
                colorClass="text-blue-600"
                borderColor="rgb(59, 130, 246)"
                onExpandColumn={() => setExpandedColumn('ready')}
                emptyMessage="No leads ready for DM yet. Scan threads to find new leads."
              >
                {columns.ready.map((dm) => (
                  <KanbanLeadCard
                    key={dm.id}
                    dm={dm}
                    stage="ready"
                    selected={selectedIds.has(dm.id)}
                    onSelect={handleSelect}
                    onDraft={setDraftingDm}
                    onStageChange={handleStageChange}
                    onDismiss={handleDismiss}
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
                count={columns.followup.length}
                colorClass="text-yellow-600"
                borderColor="rgb(234, 179, 8)"
                onExpandColumn={() => setExpandedColumn('followup')}
                emptyMessage="No follow-ups needed. Leads that respond will appear here."
              >
                {columns.followup.map((dm) => (
                  <KanbanLeadCard
                    key={dm.id}
                    dm={dm}
                    stage="followup"
                    chatPreview={chatPreviews[dm.reddit_username.toLowerCase()]}
                    onDraft={setDraftingDm}
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

              {/* Converted */}
              <KanbanColumn
                title="Converted"
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
                    onStageChange={handleStageChange}
                  />
                ))}
              </KanbanColumn>
            </div>
            </div>
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
        onDraft={setDraftingDm}
        onStageChange={handleStageChange}
        onDismiss={handleDismiss}
      />

      {/* Draft DM dialog */}
      <Dialog open={!!draftingDm} onOpenChange={(open) => !open && setDraftingDm(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Draft DM to u/{draftingDm?.reddit_username}
            </DialogTitle>
          </DialogHeader>
          {draftingDm && (
            <DmDraftBuilder
              dmId={draftingDm.id}
              projectId={project.id}
              username={draftingDm.reddit_username}
              onSent={() => {
                handleStageChange(draftingDm.id, 'dm_sent');
                setDraftingDm(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
