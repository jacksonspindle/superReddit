'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Search, Flame, Sun, Eye, Radio, Settings2 } from 'lucide-react';
import { useProject } from '@/contexts/project-context';
import { PageTransition, StaggerList, StaggerItem } from '@/components/motion';
import { Header } from '@/components/layout/header';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SignalCard } from '@/components/outreach/SignalCard';
import { ScanParametersModal } from '@/components/outreach/ScanParametersModal';
import { ScanWizard } from '@/components/outreach/ScanWizard';
import { toast } from 'sonner';
import type { OutreachSignal } from '@/types';

interface Analytics {
  hotCount: number;
  warmCount: number;
  unseenCount: number;
  totalCount: number;
  topSubreddits: { name: string; count: number }[];
}

export default function OutreachSignalsPage() {
  const { project } = useProject();
  const [signals, setSignals] = useState<OutreachSignal[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);

  const [subFilter, setSubFilter] = useState<string | null>(null);

  // Wizard & modal state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [paramsOpen, setParamsOpen] = useState(false);
  const [wizardChecked, setWizardChecked] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch(`/api/outreach/signals/analytics?project_id=${project.id}`);
      const json = await res.json();
      if (!json.error) {
        setAnalytics(json);
      }
    } catch {
      // Silently fail analytics
    }
  }, [project.id]);

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ project_id: project.id });

      if (subFilter) params.set('subreddit', subFilter);

      // Default to showing non-dismissed signals
      params.set('status', 'new');

      const res = await fetch(`/api/outreach/signals?${params}`);
      const json = await res.json();

      if (json.error) {
        toast.error(json.error);
        setSignals([]);
      } else {
        setSignals(json.signals || []);
        if (json.signals?.length) {
          setLastScanned(json.signals[0]?.fetched_at || null);
        }
      }
    } catch {
      toast.error('Failed to load signals');
      setSignals([]);
    }
    setLoading(false);
  }, [project.id, subFilter]);

  useEffect(() => {
    fetchSignals();
    fetchAnalytics();
  }, [fetchSignals, fetchAnalytics]);

  // Check wizard completion status on mount
  useEffect(() => {
    async function checkWizard() {
      try {
        const res = await fetch(`/api/outreach/config?project_id=${project.id}`);
        const json = await res.json();
        if (!json.config?.scan_wizard_completed) {
          setWizardOpen(true);
        }
      } catch {
        // Config may not exist — show wizard
        setWizardOpen(true);
      }
      setWizardChecked(true);
    }
    checkWizard();
  }, [project.id]);

  async function handleScanNow() {
    setScanning(true);
    try {
      // Fetch current config to get scan params
      let scanParams = '';
      try {
        const configRes = await fetch(`/api/outreach/config?project_id=${project.id}`);
        const configJson = await configRes.json();
        if (configJson.config) {
          const c = configJson.config;
          const p = new URLSearchParams();
          if (c.time_filter) p.set('time_filter', c.time_filter);
          if (c.max_results) p.set('max_results', String(c.max_results));
          if (c.include_comments !== undefined) p.set('include_comments', String(c.include_comments));
          scanParams = p.toString();
        }
      } catch {
        // Use defaults
      }

      const url = `/api/outreach/signals?project_id=${project.id}&force=true${scanParams ? `&${scanParams}` : ''}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.error) {
        toast.error(json.error);
      } else {
        toast.success(`Found ${json.signals?.length || 0} signals`);
        setSignals(json.signals || []);
        setLastScanned(new Date().toISOString());
        fetchAnalytics();
      }
    } catch {
      toast.error('Scan failed');
    }
    setScanning(false);
  }

  async function handleStatusChange(signalId: string, status: string) {
    setSignals((prev) =>
      prev.map((s) => (s.id === signalId ? { ...s, status: status as OutreachSignal['status'] } : s))
    );

    try {
      const res = await fetch('/api/outreach/signals/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signal_id: signalId, status }),
      });
      const json = await res.json();
      if (json.error) {
        toast.error(json.error);
        fetchSignals();
      }
    } catch {
      toast.error('Failed to update signal');
      fetchSignals();
    }
  }

  async function handleFavoriteToggle(signalId: string, isFavorited: boolean) {
    setSignals((prev) =>
      prev.map((s) => (s.id === signalId ? { ...s, is_favorited: isFavorited } : s))
    );

    try {
      await fetch('/api/outreach/signals/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signal_id: signalId, is_favorited: isFavorited }),
      });
    } catch {
      toast.error('Failed to update favorite');
      fetchSignals();
    }
  }

  async function handleMarkSeen(signalId: string) {
    setSignals((prev) =>
      prev.map((s) => (s.id === signalId ? { ...s, is_unseen: false } : s))
    );

    try {
      await fetch('/api/outreach/signals/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signal_id: signalId, is_unseen: false }),
      });
    } catch {
      // Silent fail for mark-seen
    }
  }

  function formatLastScanned(): string {
    if (!lastScanned) return '';
    const seconds = Math.floor((Date.now() - new Date(lastScanned).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  }

  const maxSubCount = analytics?.topSubreddits?.[0]?.count || 1;

  return (
    <PageTransition>
      <div className="flex h-full flex-col">
        <Header title="Signals" />
        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-[1280px] p-6 space-y-6">

            {/* Analytics Row */}
            <div className="grid grid-cols-4 gap-3">
              <Card className="p-4 flex flex-col gap-1">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Hot Leads</span>
                <span className="text-3xl font-bold text-red-500">{analytics?.hotCount ?? '-'}</span>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Flame className="h-3 w-3 text-red-500" /> high conversion
                </span>
              </Card>
              <Card className="p-4 flex flex-col gap-1">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Warm Leads</span>
                <span className="text-3xl font-bold text-amber-500">{analytics?.warmCount ?? '-'}</span>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Sun className="h-3 w-3 text-amber-500" /> potential leads
                </span>
              </Card>
              <Card className="p-4 flex flex-col gap-1">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Unseen</span>
                <span className="text-3xl font-bold text-blue-500">{analytics?.unseenCount ?? '-'}</span>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Eye className="h-3 w-3 text-blue-500" /> needs review
                </span>
              </Card>
              <Card className="p-4 flex flex-col gap-1">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Total Signals</span>
                <span className="text-3xl font-bold">{analytics?.totalCount ?? '-'}</span>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Radio className="h-3 w-3" /> across {analytics?.topSubreddits?.length || 0} subreddits
                </span>
              </Card>
            </div>

            {/* Top Subreddits */}
            {analytics?.topSubreddits && analytics.topSubreddits.length > 0 && (
              <div>
                <h3 className="text-[13px] font-semibold text-muted-foreground mb-2.5">Top Subreddits</h3>
                <div className="flex gap-2 flex-wrap">
                  {analytics.topSubreddits.map((sub) => (
                    <button
                      key={sub.name}
                      onClick={() => setSubFilter(subFilter === sub.name ? null : sub.name)}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        subFilter === sub.name
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-card hover:bg-accent text-foreground'
                      }`}
                    >
                      <span>r/{sub.name}</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-semibold">
                        {sub.count}
                      </Badge>
                      <div className="w-8 h-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-indigo-500"
                          style={{ width: `${(sub.count / maxSubCount) * 100}%` }}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Scan button row */}
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  className="h-14 px-6 rounded-xl"
                  onClick={() => setParamsOpen(true)}
                >
                  <Settings2 className="mr-2 h-5 w-5" />
                  Parameters
                </Button>
                <Button
                  variant="default"
                  size="lg"
                  className="h-14 px-10 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-shadow"
                  onClick={handleScanNow}
                  disabled={scanning}
                >
                  {scanning ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-5 w-5" />
                  )}
                  Scan Now
                </Button>
              </div>
                {lastScanned && (
                  <span className="text-xs text-muted-foreground">
                    Last scanned {formatLastScanned()}
                  </span>
                )}
              </div>

            {/* Section label */}
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-semibold">Leads</h2>
              <span className="text-xs text-muted-foreground">
                {loading ? '...' : `${signals.length} signals`}
              </span>
            </div>

            {/* Signal cards grid */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-72 rounded-xl" />
                ))}
              </div>
            ) : signals.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                No signals found. Try adjusting filters or use &quot;Scan Now&quot; to find new leads.
              </div>
            ) : (
              <StaggerList className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {signals.map((signal) => (
                  <StaggerItem key={signal.id}>
                    <SignalCard
                      signal={signal}
                      projectId={project.id}
                      onStatusChange={handleStatusChange}
                      onFavoriteToggle={handleFavoriteToggle}
                      onMarkSeen={handleMarkSeen}
                    />
                  </StaggerItem>
                ))}
              </StaggerList>
            )}
          </div>
        </div>
      </div>

      {/* Scan Parameters Modal */}
      <ScanParametersModal
        open={paramsOpen}
        onOpenChange={setParamsOpen}
        projectId={project.id}
        onScanRequested={handleScanNow}
      />

      {/* Scan Wizard (first visit) */}
      {wizardChecked && (
        <ScanWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          projectId={project.id}
          onComplete={handleScanNow}
        />
      )}
    </PageTransition>
  );
}
