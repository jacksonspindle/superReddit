'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import type { PostInfo } from '@/components/pipeline/PostFilterRow';
import { toast } from 'sonner';
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
          fetchDms();
        }
      } catch { /* silent */ }
    }
    autoScan();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

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
        fetchDms();
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

  // Stage change handler
  async function handleStageChange(dmId: string, stage: string, outcome?: string) {
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
      } else {
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

  // Derive post filter cards from replies
  const postInfos = useMemo<PostInfo[]>(() => {
    const signalMap = new Map<string, PostInfo>();

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

    return Array.from(signalMap.values());
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
              scanning={scanning}
              onScan={handleScan}
            />

            {/* Kanban board */}
            <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] gap-0 items-stretch">
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
              <div className="flex items-center justify-center w-12">
                <div className="rounded-full bg-muted/60 border border-border/40 p-2 shadow-sm">
                  <MoveRight className="h-4 w-4 text-muted-foreground/60" />
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
                    onStageChange={handleStageChange}
                  />
                ))}
              </KanbanColumn>

              {/* Arrow */}
              <div className="flex items-center justify-center w-12">
                <div className="rounded-full bg-muted/60 border border-border/40 p-2 shadow-sm">
                  <MoveRight className="h-4 w-4 text-muted-foreground/60" />
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
                    onDraft={setDraftingDm}
                    onStageChange={handleStageChange}
                  />
                ))}
              </KanbanColumn>

              {/* Arrow */}
              <div className="flex items-center justify-center w-12">
                <div className="rounded-full bg-muted/60 border border-border/40 p-2 shadow-sm">
                  <MoveRight className="h-4 w-4 text-muted-foreground/60" />
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
