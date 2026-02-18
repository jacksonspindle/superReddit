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
import type { ChatPreview } from '@/hooks/useRedditBridge';
import type { OutreachDM, DmPipelineStage, MonitoredPost } from '@/types';

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

  const [expandedColumn, setExpandedColumn] = useState<KanbanStage | null>(null);
  const [draftingDm, setDraftingDm] = useState<OutreachDM | null>(null);

  // Reddit Bridge
  const { status: bridgeStatus, reconciling, previews: chatPreviews, fetchPreviews, checkYouSentTo, checkTheyReplied, youSentToList, theyRepliedList } = useRedditBridge();
  const bridgeSyncKeyRef = useRef('');

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
        body: JSON.stringify({ project_id: project.id, previews: previewData }),
      });
    } catch { /* silent */ }
  }, [project.id]);

  // Wrapper: fetch previews from extension and persist to DB
  const fetchAndPersistPreviews = useCallback(async () => {
    const p = await fetchPreviews();
    if (Object.keys(p).length > 0) {
      await persistPreviews(p);
      await fetchDms();
    }
    return p;
  }, [fetchPreviews, persistPreviews, fetchDms]);

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

  // Initial data load
  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([fetchDms(), fetchPosts(), fetchMonitoredPosts()]);
      setLoading(false);
      // Fire post sync in background after initial render
      syncPosts();
      // Fetch chat previews from extension and persist to DB
      // Retry after delays since extension may need time to scan chats
      fetchAndPersistPreviews();
      setTimeout(() => fetchAndPersistPreviews(), 5000);
      setTimeout(() => fetchAndPersistPreviews(), 15000);
    }
    init();
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

  // Reddit Bridge reconciliation — server-side sync.
  // Triggers off counts (reliable from extension) and fetches arrays explicitly if needed.
  useEffect(() => {
    if (loading) return;
    // Need at least counts OR arrays to proceed
    const hasCounts = bridgeStatus.youSentToCount > 0 || bridgeStatus.theyRepliedCount > 0;
    const hasArrays = youSentToList.length > 0 || theyRepliedList.length > 0;
    if (!hasCounts && !hasArrays) return;

    async function sync() {
      // Use state arrays if available, otherwise fetch directly from extension
      let sentList = youSentToList;
      let repliedList = theyRepliedList;

      if (sentList.length === 0 && bridgeStatus.youSentToCount > 0) {
        try {
          sentList = await checkYouSentTo();
          console.log('[SR Reconcile] Fetched sentTo arrays explicitly:', sentList.length);
        } catch { /* silent */ }
      }
      if (repliedList.length === 0 && bridgeStatus.theyRepliedCount > 0) {
        try {
          repliedList = await checkTheyReplied();
          console.log('[SR Reconcile] Fetched replied arrays explicitly:', repliedList.length);
        } catch { /* silent */ }
      }

      if (sentList.length === 0 && repliedList.length === 0) return;

      // Content-based dedupe to avoid re-syncing identical data
      const sortedSent = [...sentList].sort().join(',');
      const sortedReplied = [...repliedList].sort().join(',');
      const key = `${sortedSent}|${sortedReplied}`;
      if (key === bridgeSyncKeyRef.current) return;
      bridgeSyncKeyRef.current = key;

      console.log('[SR Reconcile] Bridge sync: youSentTo=' + sentList.length + ' theyReplied=' + repliedList.length);

      try {
        // Fetch previews first so we can pass them to bridge-sync for dm_body persistence
        const currentPreviews = await fetchPreviews();

        const res = await fetch('/api/outreach/dms/bridge-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: project.id,
            youSentTo: sentList,
            theyReplied: repliedList,
            previews: currentPreviews,
          }),
        });
        const json = await res.json();
        console.log('[SR Reconcile] Bridge sync result:', json);
        if (json.error) {
          console.error('[SR Reconcile] Bridge sync API error:', json.error);
        } else if (json.created > 0 || json.advanced > 0 || json.reconciled > 0) {
          toast.success(`Reddit sync: ${json.created} new, ${json.advanced} advanced, ${json.reconciled || 0} reconciled`);
        } else {
          console.log('[SR Reconcile] Bridge sync: no changes needed (created=0, advanced=0, reconciled=0)');
        }
        await fetchDms();
      } catch (err) {
        console.error('[SR Reconcile] Bridge sync failed:', err);
      }
    }
    sync();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, bridgeStatus.youSentToCount, bridgeStatus.theyRepliedCount, youSentToList, theyRepliedList]);

  // Manual scan
  async function handleScan() {
    setScanning(true);
    try {
      // Sync posts first (picks up any new Reddit posts)
      await syncPosts();

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

    // Map monitored posts → PostInfo (even 0-lead posts)
    return monitoredPosts.map((mp) => {
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
  }, [monitoredPosts, allDms]);

  // Column mapping
  const columns = useMemo(() => {
    let filtered = allDms;

    // Filter by selected post (permalink match)
    if (selectedPostId) {
      const selectedPost = postInfos.find((p) => p.postId === selectedPostId);
      if (selectedPost) {
        const selectedPermalink = normalizePermalink(selectedPost.permalink);
        filtered = filtered.filter(
          (d) => normalizePermalink(d.source_thread_permalink) === selectedPermalink
        );
      }
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
  }, [allDms, selectedPostId, searchQuery, sortBy, postInfos]);

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
            <div className="overflow-x-auto -mx-6 px-6">
            <div className="grid grid-cols-[minmax(320px,1fr)_32px_minmax(320px,1fr)_32px_minmax(320px,1fr)_32px_minmax(320px,1fr)] gap-0 items-stretch min-w-[1376px]">
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
