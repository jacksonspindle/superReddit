'use client';

import { useEffect, useState } from 'react';
import { Settings2, Plus, X, Loader2, Save, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOutreachStore } from '@/stores/outreach-store';
import { toast } from 'sonner';

interface ScanParametersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onScanRequested: () => void;
}

export function ScanParametersModal({
  open,
  onOpenChange,
  projectId,
  onScanRequested,
}: ScanParametersModalProps) {
  const {
    config,
    keywords,
    monitoredSubs,
    fetchConfig,
    fetchKeywords,
    fetchMonitoredSubs,
    addKeyword,
    removeKeyword,
    toggleKeyword,
    addMonitoredSub,
    removeMonitoredSub,
    toggleMonitoredSub,
    syncSubsFromProject,
  } = useOutreachStore();

  // Local state for scan preferences
  const [timeFilter, setTimeFilter] = useState<string>('week');
  const [maxResults, setMaxResults] = useState<string>('100');
  const [includeComments, setIncludeComments] = useState(true);
  const [painPoints, setPainPoints] = useState<string[]>([]);
  const [customerGoals, setCustomerGoals] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Input fields
  const [keywordInput, setKeywordInput] = useState('');
  const [subInput, setSubInput] = useState('');
  const [painInput, setPainInput] = useState('');
  const [goalInput, setGoalInput] = useState('');

  // Load data on open & auto-sync subreddits from project
  useEffect(() => {
    if (open) {
      fetchConfig(projectId);
      fetchKeywords(projectId);
      fetchMonitoredSubs(projectId);
      syncSubsFromProject(projectId);
    }
  }, [open, projectId, fetchConfig, fetchKeywords, fetchMonitoredSubs, syncSubsFromProject]);

  // Sync local state from config when it loads
  useEffect(() => {
    if (config) {
      setTimeFilter(config.time_filter || 'week');
      setMaxResults(String(config.max_results || 100));
      setIncludeComments(config.include_comments ?? true);
      setPainPoints(config.pain_points || []);
      setCustomerGoals(config.customer_goals || []);
    }
  }, [config]);

  function handleAddKeyword() {
    const phrases = keywordInput.split(',').map((p) => p.trim()).filter(Boolean);
    if (phrases.length === 0) return;
    addKeyword(projectId, phrases);
    setKeywordInput('');
  }

  function handleAddSub() {
    if (!subInput.trim()) return;
    addMonitoredSub(projectId, subInput.trim());
    setSubInput('');
  }

  function handleAddPainPoint() {
    const val = painInput.trim();
    if (!val || painPoints.includes(val)) return;
    setPainPoints((prev) => [...prev, val]);
    setPainInput('');
  }

  function handleAddGoal() {
    const val = goalInput.trim();
    if (!val || customerGoals.includes(val)) return;
    setCustomerGoals((prev) => [...prev, val]);
    setGoalInput('');
  }

  async function handleSave(andScan = false) {
    setSaving(true);
    try {
      await fetch('/api/outreach/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          time_filter: timeFilter,
          max_results: parseInt(maxResults, 10),
          include_comments: includeComments,
          pain_points: painPoints,
          customer_goals: customerGoals,
        }),
      });
      toast.success('Scan parameters saved');
      if (andScan) {
        onOpenChange(false);
        onScanRequested();
      }
    } catch {
      toast.error('Failed to save parameters');
    }
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Scan Parameters
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-4 -mr-4">
          <div className="space-y-6 pb-4">
            {/* Keywords */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Keywords</h3>
              <p className="text-xs text-muted-foreground">
                Comma-separated phrases to search for in Reddit posts and comments.
              </p>
              <div className="flex gap-2">
                <Input
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddKeyword())}
                  placeholder="e.g., alternative to, best tool for"
                  className="text-xs h-8"
                />
                <Button onClick={handleAddKeyword} size="sm" className="h-8 px-3" disabled={!keywordInput.trim()}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              {keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {keywords.map((kw) => (
                    <div key={kw.id} className="flex items-center gap-1">
                      {kw.phrases.map((phrase) => (
                        <Badge
                          key={phrase}
                          variant={kw.is_active ? 'secondary' : 'outline'}
                          className={`text-[11px] cursor-pointer ${kw.is_active ? '' : 'opacity-50'}`}
                          onClick={() => toggleKeyword(kw.id, !kw.is_active)}
                        >
                          {phrase}
                        </Badge>
                      ))}
                      <button
                        onClick={() => removeKeyword(kw.id)}
                        className="text-muted-foreground hover:text-destructive ml-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className="border-t" />

            {/* Subreddits */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Subreddits</h3>
              <div className="flex gap-2">
                <Input
                  value={subInput}
                  onChange={(e) => setSubInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSub())}
                  placeholder="e.g., SaaS, startups"
                  className="text-xs h-8"
                />
                <Button onClick={handleAddSub} size="sm" className="h-8 px-3" disabled={!subInput.trim()}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              {monitoredSubs.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {monitoredSubs.map((sub) => (
                    <div key={sub.id} className="flex items-center gap-1">
                      <Badge
                        variant={sub.is_active ? 'secondary' : 'outline'}
                        className={`text-[11px] cursor-pointer ${sub.is_active ? '' : 'opacity-50'}`}
                        onClick={() => toggleMonitoredSub(sub.id, !sub.is_active)}
                      >
                        r/{sub.name}
                      </Badge>
                      <button
                        onClick={() => removeMonitoredSub(sub.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className="border-t" />

            {/* Time Range & Search Depth */}
            <section className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Time Range</label>
                <Select value={timeFilter} onValueChange={setTimeFilter}>
                  <SelectTrigger className="h-9 text-sm bg-muted/50 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hour">Last hour</SelectItem>
                    <SelectItem value="day">Last day</SelectItem>
                    <SelectItem value="week">Last week</SelectItem>
                    <SelectItem value="month">Last month</SelectItem>
                    <SelectItem value="year">Last year</SelectItem>
                    <SelectItem value="all">All time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Max Results</label>
                <Select value={maxResults} onValueChange={setMaxResults}>
                  <SelectTrigger className="h-9 text-sm bg-muted/50 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </section>

            <div className="border-t" />

            {/* Comment Search Toggle */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Comment Search</h3>
                  <p className="text-xs text-muted-foreground">
                    Search Reddit comments for leads buried in threads
                  </p>
                </div>
                <button
                  onClick={() => setIncludeComments(!includeComments)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    includeComments ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-lg ring-0 transition-transform ${
                      includeComments ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </section>

            <div className="border-t" />

            {/* Pain Points */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Pain Points</h3>
              <p className="text-xs text-muted-foreground">
                Problems your customers experience. Used as context for AI signal classification.
              </p>
              <div className="flex gap-2">
                <Input
                  value={painInput}
                  onChange={(e) => setPainInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddPainPoint())}
                  placeholder="e.g., slow onboarding, no integrations"
                  className="text-xs h-8"
                />
                <Button onClick={handleAddPainPoint} size="sm" className="h-8 px-3" disabled={!painInput.trim()}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              {painPoints.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {painPoints.map((point) => (
                    <Badge key={point} variant="secondary" className="text-[11px] pr-1">
                      {point}
                      <button
                        onClick={() => setPainPoints((prev) => prev.filter((p) => p !== point))}
                        className="ml-1 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </section>

            <div className="border-t" />

            {/* Customer Goals */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Customer Goals</h3>
              <p className="text-xs text-muted-foreground">
                What your customers are trying to achieve. Helps AI identify high-intent signals.
              </p>
              <div className="flex gap-2">
                <Input
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddGoal())}
                  placeholder="e.g., automate outreach, find leads faster"
                  className="text-xs h-8"
                />
                <Button onClick={handleAddGoal} size="sm" className="h-8 px-3" disabled={!goalInput.trim()}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              {customerGoals.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {customerGoals.map((goal) => (
                    <Badge key={goal} variant="secondary" className="text-[11px] pr-1">
                      {goal}
                      <button
                        onClick={() => setCustomerGoals((prev) => prev.filter((g) => g !== goal))}
                        className="ml-1 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-4 border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save
          </Button>
          <Button onClick={() => handleSave(true)} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            Save & Scan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
