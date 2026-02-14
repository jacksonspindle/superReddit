'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Scan, AlertCircle } from 'lucide-react';
import { useProject } from '@/contexts/project-context';
import { PageTransition, StaggerList, StaggerItem } from '@/components/motion';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { DmCard } from '@/components/outreach/DmCard';
import { toast } from 'sonner';
import type { OutreachDM, DmPipelineStage } from '@/types';

type DmFilter = 'all' | 'dm_ready' | 'draft_generated' | 'dm_sent' | 'responded';

export default function OutreachDmsPage() {
  const { project } = useProject();
  const [dms, setDms] = useState<OutreachDM[]>([]);
  const [allDms, setAllDms] = useState<OutreachDM[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [filter, setFilter] = useState<DmFilter>('all');

  const fetchDms = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ project_id: project.id });
      if (filter !== 'all') params.set('pipeline_stage', filter);

      const res = await fetch(`/api/outreach/dms?${params}`);
      const json = await res.json();

      if (json.error) {
        toast.error(json.error);
        setDms([]);
      } else {
        setDms(json.dms || []);
      }
    } catch {
      toast.error('Failed to load DMs');
      setDms([]);
    }
    setLoading(false);
  }, [project.id, filter]);

  // Fetch all DMs for stats
  useEffect(() => {
    async function fetchAll() {
      try {
        const res = await fetch(`/api/outreach/dms?project_id=${project.id}`);
        const json = await res.json();
        if (json.dms) setAllDms(json.dms);
      } catch { /* stats will show 0 */ }
    }
    fetchAll();
  }, [project.id]);

  useEffect(() => {
    fetchDms();
  }, [fetchDms]);

  // Auto-scan on mount if stale
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
          // Refresh stats
          const allRes = await fetch(`/api/outreach/dms?project_id=${project.id}`);
          const allJson = await allRes.json();
          if (allJson.dms) setAllDms(allJson.dms);
        }
      } catch { /* silent failure for auto-scan */ }
    }
    autoScan();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

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
        // Refresh stats
        const allRes = await fetch(`/api/outreach/dms?project_id=${project.id}`);
        const allJson = await allRes.json();
        if (allJson.dms) setAllDms(allJson.dms);
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

  async function handleStageChange(dmId: string, stage: string, outcome?: string) {
    // Optimistic update
    setDms((prev) =>
      prev.map((d) => (d.id === dmId ? { ...d, pipeline_stage: stage as DmPipelineStage, outcome: outcome || d.outcome } : d))
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
        toast.success(`Updated to ${stage.replace('_', ' ')}`);
      }
    } catch {
      toast.error('Failed to update stage');
      fetchDms();
    }
  }

  // Stats
  const totalDetected = allDms.length;
  const readyCount = allDms.filter((d) => d.pipeline_stage === 'dm_ready' || d.pipeline_stage === 'draft_generated').length;
  const sentCount = allDms.filter((d) => d.pipeline_stage === 'dm_sent').length;
  const convertedCount = allDms.filter((d) => d.pipeline_stage === 'converted').length;
  const followUpsDue = allDms.filter(
    (d) => d.follow_up_due && new Date(d.follow_up_due).getTime() <= Date.now()
  ).length;

  return (
    <PageTransition>
      <div className="flex h-full flex-col">
        <Header title="DM Leads" />
        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-6xl p-6 space-y-6">
            {/* Stats row */}
            <div className="grid grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{totalDetected}</p>
                  <p className="text-xs text-muted-foreground">Total Detected</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{readyCount}</p>
                  <p className="text-xs text-muted-foreground">Ready for DM</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{sentCount}</p>
                  <p className="text-xs text-muted-foreground">Sent</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{convertedCount}</p>
                  <p className="text-xs text-muted-foreground">Converted</p>
                </CardContent>
              </Card>
            </div>

            {/* Follow-up banner */}
            {followUpsDue > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950 p-3">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
                  {followUpsDue} follow-up{followUpsDue !== 1 ? 's' : ''} due
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto h-7 text-xs"
                  onClick={() => setFilter('dm_sent')}
                >
                  View sent DMs
                </Button>
              </div>
            )}

            {/* Filter + scan */}
            <div className="flex items-center gap-2 flex-wrap">
              <Tabs value={filter} onValueChange={(v) => setFilter(v as DmFilter)}>
                <TabsList className="h-8">
                  <TabsTrigger value="all" className="text-xs px-3 h-6">All</TabsTrigger>
                  <TabsTrigger value="dm_ready" className="text-xs px-3 h-6">Ready</TabsTrigger>
                  <TabsTrigger value="draft_generated" className="text-xs px-3 h-6">Drafted</TabsTrigger>
                  <TabsTrigger value="dm_sent" className="text-xs px-3 h-6">Sent</TabsTrigger>
                  <TabsTrigger value="responded" className="text-xs px-3 h-6">Responded</TabsTrigger>
                </TabsList>
              </Tabs>

              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs ml-auto"
                onClick={handleScan}
                disabled={scanning}
              >
                {scanning ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Scan className="mr-1 h-3 w-3" />
                )}
                {scanning ? 'Scanning...' : 'Scan Threads'}
              </Button>
            </div>

            {/* DM cards — 3-column grid */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-56 rounded-xl" />
                ))}
              </div>
            ) : dms.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                No DM leads yet. Post replies to signals and we&apos;ll monitor the threads for interested commenters.
              </div>
            ) : (
              <StaggerList className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {dms.map((dm) => (
                  <StaggerItem key={dm.id}>
                    <DmCard
                      dm={dm}
                      projectId={project.id}
                      onStageChange={handleStageChange}
                    />
                  </StaggerItem>
                ))}
              </StaggerList>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
