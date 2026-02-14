'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useProject } from '@/contexts/project-context';
import { PageTransition, StaggerList, StaggerItem } from '@/components/motion';
import { Header } from '@/components/layout/header';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { SignalCard } from '@/components/outreach/SignalCard';
import { toast } from 'sonner';
import type { OutreachSignal } from '@/types';

type IntentFilter = 'all' | 'question' | 'comparison' | 'problem' | 'discussion' | 'showcase';
type StatusFilter = 'new' | 'all' | 'replied' | 'dismissed';

export default function OutreachSignalsPage() {
  const project = useProject();
  const [signals, setSignals] = useState<OutreachSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [intentFilter, setIntentFilter] = useState<IntentFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('new');
  const [safetyScores, setSafetyScores] = useState<Record<string, number | null>>({});

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ project_id: project.id });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (intentFilter !== 'all') params.set('intent_type', intentFilter);

      const res = await fetch(`/api/outreach/signals?${params}`);
      const json = await res.json();

      if (json.error) {
        toast.error(json.error);
        setSignals([]);
      } else {
        setSignals(json.signals || []);
      }
    } catch {
      toast.error('Failed to load signals');
      setSignals([]);
    }
    setLoading(false);
  }, [project.id, statusFilter, intentFilter]);

  // Fetch signals on mount and when filters change
  useEffect(() => {
    fetchSignals();
  }, [fetchSignals]);

  // Fetch safety scores for unique subreddits
  useEffect(() => {
    if (signals.length === 0) return;
    const subreddits = [...new Set(signals.map((s) => s.subreddit))] as string[];
    const missing = subreddits.filter((sub) => !(sub in safetyScores));

    if (missing.length === 0) return;

    missing.forEach(async (sub) => {
      try {
        const res = await fetch(`/api/reddit/subreddit-rules?subreddit=${encodeURIComponent(sub)}`);
        const json = await res.json();
        if (json.rules?.safety_score != null) {
          setSafetyScores((prev) => ({ ...prev, [sub]: json.rules.safety_score }));
        } else {
          setSafetyScores((prev) => ({ ...prev, [sub]: null }));
        }
      } catch {
        setSafetyScores((prev) => ({ ...prev, [sub]: null }));
      }
    });
  }, [signals, safetyScores]);

  async function handleStatusChange(signalId: string, status: string) {
    // Optimistic update
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
        fetchSignals(); // revert by re-fetching
      } else {
        toast.success(`Signal marked as ${status}`);
      }
    } catch {
      toast.error('Failed to update signal');
      fetchSignals();
    }
  }

  return (
    <PageTransition>
      <div className="flex h-full flex-col">
        <Header title="Outreach Signals" />
        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-6xl p-6 space-y-6">
            {/* Filter bar */}
            <div className="flex items-center gap-2 flex-wrap">
              <Tabs value={intentFilter} onValueChange={(v) => setIntentFilter(v as IntentFilter)}>
                <TabsList className="h-8">
                  <TabsTrigger value="all" className="text-xs px-3 h-6">All</TabsTrigger>
                  <TabsTrigger value="question" className="text-xs px-3 h-6">Questions</TabsTrigger>
                  <TabsTrigger value="comparison" className="text-xs px-3 h-6">Comparisons</TabsTrigger>
                  <TabsTrigger value="problem" className="text-xs px-3 h-6">Problems</TabsTrigger>
                  <TabsTrigger value="discussion" className="text-xs px-3 h-6">Discussion</TabsTrigger>
                </TabsList>
              </Tabs>

              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger className="h-8 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="replied">Replied</SelectItem>
                  <SelectItem value="dismissed">Dismissed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Signals</h2>
              <span className="text-sm text-muted-foreground">
                {loading ? '...' : `${signals.length} ${statusFilter !== 'all' ? statusFilter : ''} signals`}
              </span>
            </div>

            {/* Signal cards — 3-column grid */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-56 rounded-xl" />
                ))}
              </div>
            ) : signals.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                No signals found. {statusFilter !== 'all' ? 'Try adjusting filters.' : 'Complete setup and add subreddits to start finding signals.'}
              </div>
            ) : (
              <StaggerList className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {signals.map((signal) => (
                  <StaggerItem key={signal.id}>
                    <SignalCard
                      signal={signal}
                      projectId={project.id}
                      safetyScore={safetyScores[signal.subreddit] ?? null}
                      onStatusChange={handleStatusChange}
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
