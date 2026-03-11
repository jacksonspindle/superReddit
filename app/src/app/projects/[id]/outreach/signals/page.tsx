'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Search, Flame, Sun, MessageCircle, Radio, Settings2, Star, X } from 'lucide-react';
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
import { TooltipProvider } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import type { OutreachSignal, BuyerIntent } from '@/types';

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
  const [tierFilter, setTierFilter] = useState<'hot' | 'warm' | 'engagement' | 'favorites' | null>(null);
  const [intentFilter, setIntentFilter] = useState<BuyerIntent | null>(null);

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

  // Check wizard completion status on mount — only show on first visit
  useEffect(() => {
    const localKey = `sr_wizard_done_${project.id}`;
    if (localStorage.getItem(localKey)) {
      setWizardChecked(true);
      return;
    }

    async function checkWizard() {
      try {
        const res = await fetch(`/api/outreach/config?project_id=${project.id}`);
        const json = await res.json();
        if (!json.config?.scan_wizard_completed) {
          setWizardOpen(true);
        } else {
          localStorage.setItem(localKey, '1');
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
    const beforeCount = signals.length;
    try {
      // Get scan params from config
      let scanBody: Record<string, unknown> = { project_id: project.id };
      try {
        const configRes = await fetch(`/api/outreach/config?project_id=${project.id}`);
        const configJson = await configRes.json();
        if (configJson.config) {
          const c = configJson.config;
          if (c.time_filter) scanBody.time_filter = c.time_filter;
          if (c.max_results) scanBody.max_results = c.max_results;
          if (c.include_comments !== undefined) scanBody.include_comments = c.include_comments;
        }
      } catch {
        // Use defaults
      }

      // Fire off scan — server uses PullPush instead of Reddit (bypasses IP blocks)
      const res = await fetch('/api/outreach/signals/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scanBody),
      });
      const json = await res.json();
      if (json.error) {
        toast.error(json.error);
        setScanning(false);
        return;
      }

      toast('Scanning in background...', { duration: 3000 });

      // Poll for new results every 3s for up to 2 minutes
      let polls = 0;
      const maxPolls = 40;
      const pollInterval = setInterval(async () => {
        polls++;
        try {
          const params = new URLSearchParams({ project_id: project.id, status: 'new' });
          if (subFilter) params.set('subreddit', subFilter);
          const pollRes = await fetch(`/api/outreach/signals?${params}`);
          const pollJson = await pollRes.json();
          const newSignals = pollJson.signals || [];

          if (newSignals.length > beforeCount) {
            setSignals(newSignals);
            setLastScanned(new Date().toISOString());
            fetchAnalytics();
            toast.success(`Found ${newSignals.length} signals`);
            clearInterval(pollInterval);
            setScanning(false);
          } else if (polls >= maxPolls) {
            // Timed out — show whatever we have
            setSignals(newSignals);
            fetchAnalytics();
            clearInterval(pollInterval);
            setScanning(false);
            if (newSignals.length === beforeCount) {
              toast('No new signals found', { duration: 3000 });
            }
          }
        } catch {
          // Keep polling
        }
      }, 3000);
    } catch {
      toast.error('Scan failed');
      setScanning(false);
    }
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

  // Client-side filtering (tier + buyer intent) + sort by tier (hot → warm → cold)
  const tierRank: Record<string, number> = { hot: 0, warm: 1, cold: 2 };
  const filteredSignals = signals.filter((s) => {
    // Tier filter
    if (tierFilter) {
      if (tierFilter === 'favorites') {
        if (!s.is_favorited) return false;
      } else if (tierFilter === 'engagement') {
        const score = s.combined_score ?? 0;
        const tier = s.lead_tier || (score >= 0.7 ? 'hot' : score >= 0.4 ? 'warm' : 'cold');
        if (tier === 'cold') return false;
      } else {
        let tier = s.lead_tier;
        if (!tier) {
          const score = s.combined_score ?? 0;
          if (score >= 0.7) tier = 'hot';
          else if (score >= 0.4) tier = 'warm';
          else tier = 'cold';
        }
        if (tier !== tierFilter) return false;
      }
    }
    // Buyer intent filter
    if (intentFilter && s.buyer_intent !== intentFilter) return false;
    return true;
  }).sort((a, b) => {
    const getTier = (s: typeof a) => {
      if (s.lead_tier) return s.lead_tier;
      const score = s.combined_score ?? 0;
      if (score >= 0.7) return 'hot';
      if (score >= 0.4) return 'warm';
      return 'cold';
    };
    const rankA = tierRank[getTier(a)] ?? 2;
    const rankB = tierRank[getTier(b)] ?? 2;
    if (rankA !== rankB) return rankA - rankB;
    // Within same tier, sort by most recent first
    return (b.created_utc ?? 0) - (a.created_utc ?? 0);
  });

  return (
    <PageTransition>
      <div className="flex h-full flex-col">
        <Header title="Signals" />
        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-[1280px] p-6 space-y-6">

            {/* Live Monitoring Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Lead Intelligence</h2>
                  <p className="text-xs text-muted-foreground">Click on a box to filter</p>
                </div>
              </div>
              <button
                className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"
              >
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                Live Monitoring: ON
              </button>
            </div>

            {/* Analytics Row */}
            <div className="grid grid-cols-5 gap-3">
              <Card
                className={`p-4 flex flex-col gap-1 cursor-pointer transition-colors ${
                  tierFilter === 'hot' ? 'ring-2 ring-red-500 bg-red-500/5' : 'hover:bg-accent/50'
                }`}
                onClick={() => setTierFilter(tierFilter === 'hot' ? null : 'hot')}
              >
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Hot Leads</span>
                <span className="text-3xl font-bold text-red-500">{analytics?.hotCount ?? '-'}</span>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Flame className="h-3 w-3 text-red-500" /> high conversion
                </span>
              </Card>
              <Card
                className={`p-4 flex flex-col gap-1 cursor-pointer transition-colors ${
                  tierFilter === 'warm' ? 'ring-2 ring-amber-500 bg-amber-500/5' : 'hover:bg-accent/50'
                }`}
                onClick={() => setTierFilter(tierFilter === 'warm' ? null : 'warm')}
              >
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Warm Leads</span>
                <span className="text-3xl font-bold text-amber-500">{analytics?.warmCount ?? '-'}</span>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Sun className="h-3 w-3 text-amber-500" /> potential leads
                </span>
              </Card>
              <Card
                className={`p-4 flex flex-col gap-1 cursor-pointer transition-colors ${
                  tierFilter === 'engagement' ? 'ring-2 ring-blue-500 bg-blue-500/5' : 'hover:bg-accent/50'
                }`}
                onClick={() => setTierFilter(tierFilter === 'engagement' ? null : 'engagement')}
              >
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Engagement</span>
                <span className="text-3xl font-bold text-blue-500">{analytics ? (analytics.hotCount + analytics.warmCount) : '-'}</span>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <MessageCircle className="h-3 w-3 text-blue-500" /> opportunities
                </span>
              </Card>
              <Card
                className={`p-4 flex flex-col gap-1 cursor-pointer transition-colors ${
                  tierFilter === 'favorites' ? 'ring-2 ring-yellow-500 bg-yellow-500/5' : 'hover:bg-accent/50'
                }`}
                onClick={() => setTierFilter(tierFilter === 'favorites' ? null : 'favorites')}
              >
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Favorites</span>
                <span className="text-3xl font-bold text-yellow-500">{signals.filter((s) => s.is_favorited).length}</span>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Star className="h-3 w-3 text-yellow-500" /> starred leads
                </span>
              </Card>
              <Card
                className={`p-4 flex flex-col gap-1 cursor-pointer transition-colors ${
                  tierFilter === null ? 'ring-2 ring-border' : 'hover:bg-accent/50'
                }`}
                onClick={() => setTierFilter(null)}
              >
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Total Signals</span>
                <span className="text-3xl font-bold">{analytics?.totalCount ?? '-'}</span>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Radio className="h-3 w-3" /> across {analytics?.topSubreddits?.length || 0} subreddits
                </span>
              </Card>
            </div>

            {/* Top Subreddits */}
            {analytics?.topSubreddits && analytics.topSubreddits.length > 0 && (
              <Card className="px-3 py-2">
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Top Subreddits</h3>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {analytics.topSubreddits.slice(0, 6).map((sub, i) => {
                    const isActive = subFilter === sub.name;
                    const pct = analytics.totalCount > 0
                      ? ((sub.count / analytics.totalCount) * 100).toFixed(1)
                      : '0';
                    const rankColors = ['text-rose-400', 'text-amber-400', 'text-emerald-400'];
                    return (
                      <button
                        key={sub.name}
                        onClick={() => setSubFilter(isActive ? null : sub.name)}
                        className={`relative shrink-0 rounded-lg border px-3 py-2 text-left transition-colors ${
                          isActive
                            ? 'border-primary bg-primary/5'
                            : 'border-border bg-card hover:bg-accent/50'
                        }`}
                      >
                        <span className={`absolute top-1 right-2 text-[9px] font-bold ${rankColors[i] || 'text-muted-foreground/50'}`}>
                          #{i + 1}
                        </span>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-lg font-bold tabular-nums">{sub.count}</span>
                          <span className="text-xs font-semibold truncate">r/{sub.name}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          leads &bull; <span className="font-semibold text-emerald-500">{pct}%</span>
                        </p>
                      </button>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Buyer Intent Filter Pills */}
            {analytics && (analytics as Analytics & { intentDistribution?: Record<string, number> }).intentDistribution && Object.keys((analytics as Analytics & { intentDistribution?: Record<string, number> }).intentDistribution!).length > 0 && (
              <div>
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Buyer Journey</h3>
                <div className="flex gap-2 flex-wrap">
                  {([
                    { key: 'problem_aware' as BuyerIntent, label: 'Problem Aware', color: 'slate' },
                    { key: 'solution_seeking' as BuyerIntent, label: 'Solution Seeking', color: 'blue' },
                    { key: 'comparing' as BuyerIntent, label: 'Comparing', color: 'purple' },
                    { key: 'ready_to_buy' as BuyerIntent, label: 'Ready to Buy', color: 'green' },
                  ] as const).map(({ key, label, color }) => {
                    const count = ((analytics as Analytics & { intentDistribution?: Record<string, number> }).intentDistribution ?? {})[key] || 0;
                    if (count === 0) return null;
                    const isActive = intentFilter === key;
                    const colorClasses: Record<string, string> = {
                      slate: isActive ? 'ring-2 ring-slate-500 bg-slate-500/5' : 'hover:bg-accent/50',
                      blue: isActive ? 'ring-2 ring-blue-500 bg-blue-500/5' : 'hover:bg-accent/50',
                      purple: isActive ? 'ring-2 ring-purple-500 bg-purple-500/5' : 'hover:bg-accent/50',
                      green: isActive ? 'ring-2 ring-green-500 bg-green-500/5' : 'hover:bg-accent/50',
                    };
                    return (
                      <button
                        key={key}
                        onClick={() => setIntentFilter(isActive ? null : key)}
                        className={`rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors ${colorClasses[color]}`}
                      >
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-lg font-bold tabular-nums">{count}</span>
                          <span className="text-xs font-semibold">{label}</span>
                        </div>
                      </button>
                    );
                  })}
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
                  Settings
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
              </div>

            {/* Section label + active filters */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-semibold">Leads</h2>
                <span className="text-xs text-muted-foreground">
                  {loading ? '...' : `${filteredSignals.length} signals`}
                </span>
              </div>
              {(tierFilter || intentFilter || subFilter) && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">Filtered by:</span>
                  {tierFilter && (
                    <button
                      onClick={() => setTierFilter(null)}
                      className="flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium transition-colors hover:bg-accent/70"
                    >
                      {tierFilter === 'hot' && <Flame className="h-3 w-3 text-red-500" />}
                      {tierFilter === 'warm' && <Sun className="h-3 w-3 text-amber-500" />}
                      {tierFilter === 'engagement' && <MessageCircle className="h-3 w-3 text-blue-500" />}
                      {tierFilter === 'favorites' && <Star className="h-3 w-3 text-yellow-500" />}
                      {tierFilter.charAt(0).toUpperCase() + tierFilter.slice(1)}
                      <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                  )}
                  {intentFilter && (
                    <button
                      onClick={() => setIntentFilter(null)}
                      className="flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium transition-colors hover:bg-accent/70"
                    >
                      {intentFilter.replace(/_/g, ' ')}
                      <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                  )}
                  {subFilter && (
                    <button
                      onClick={() => setSubFilter(null)}
                      className="flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium transition-colors hover:bg-accent/70"
                    >
                      r/{subFilter}
                      <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                  )}
                  <button
                    onClick={() => { setTierFilter(null); setIntentFilter(null); setSubFilter(null); }}
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>

            {/* Signal cards grid */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-72 rounded-xl" />
                ))}
              </div>
            ) : filteredSignals.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                No signals found. Try adjusting filters or use &quot;Scan Now&quot; to find new leads.
              </div>
            ) : (
              <TooltipProvider>
                <StaggerList key={`${tierFilter}-${intentFilter}-${subFilter}`} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredSignals.map((signal) => (
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
              </TooltipProvider>
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

      {/* Scan Wizard (first visit only) */}
      {wizardChecked && (
        <ScanWizard
          open={wizardOpen}
          onOpenChange={(open) => {
            setWizardOpen(open);
            if (!open) {
              // Mark as seen so it doesn't reappear on revisit
              localStorage.setItem(`sr_wizard_done_${project.id}`, '1');
            }
          }}
          projectId={project.id}
          onComplete={handleScanNow}
        />
      )}
    </PageTransition>
  );
}
