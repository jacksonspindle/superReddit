'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Plus,
  X,
  Loader2,
  Radar,
  Package,
  Hash,
  Swords,
  MessageSquare,
  Check,
  Brain,
  Target,
  AlertTriangle,
  Sparkles,
  Activity,
  Pencil,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { slideHorizontalVariants } from '@/lib/motion';
import { useOutreachStore } from '@/stores/outreach-store';
import { useProject } from '@/contexts/project-context';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { OutreachProductContext } from '@/types';

interface ScanWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onComplete: () => void;
}

export function ScanWizard({
  open,
  onOpenChange,
  projectId,
  onComplete,
}: ScanWizardProps) {
  const { project, refreshProject } = useProject();
  const {
    config,
    keywords,
    monitoredSubs,
    fetchConfig,
    fetchKeywords,
    fetchMonitoredSubs,
    addKeyword,
    removeKeyword,
    addMonitoredSub,
    removeMonitoredSub,
    syncSubsFromProject,
  } = useOutreachStore();

  const [step, setStep] = useState(0);
  const directionRef = useRef(1);
  const [saving, setSaving] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Inline description editing
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [savingDescription, setSavingDescription] = useState(false);

  // Full context data
  const [productContext, setProductContext] =
    useState<OutreachProductContext | null>(null);
  // Project subreddits (from onboarding, always available)
  const [projectSubs, setProjectSubs] = useState<string[]>([]);

  // Step 2 inputs
  const [targetAudience, setTargetAudience] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [subInput, setSubInput] = useState('');
  const [painPoints, setPainPoints] = useState<string[]>([]);
  const [customerGoals, setCustomerGoals] = useState<string[]>([]);
  const [activities, setActivities] = useState<string[]>([]);
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [painInput, setPainInput] = useState('');
  const [goalInput, setGoalInput] = useState('');
  const [activityInput, setActivityInput] = useState('');
  const [competitorInput, setCompetitorInput] = useState('');

  // AI suggestions
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);

  // Step 3: Settings
  const [timeFilter, setTimeFilter] = useState('week');
  const [maxResults, setMaxResults] = useState('100');
  const [includeComments, setIncludeComments] = useState(true);

  // Load all data on open
  const loadData = useCallback(async () => {
    setDataLoaded(false);

    // Fetch project subreddits directly from the subreddits table (onboarding source)
    // This is always reliable regardless of outreach_monitored_subs state
    const supabase = createClient();
    const subsPromise = supabase
      .from('subreddits')
      .select('name')
      .eq('project_id', projectId)
      .order('name', { ascending: true });

    const [subsRes, , , , ctxRes] = await Promise.allSettled([
      subsPromise,
      // Sync project subs → outreach_monitored_subs (for scanning later)
      syncSubsFromProject(projectId),
      fetchConfig(projectId),
      fetchKeywords(projectId),
      // Fetch product context
      fetch(
        `/api/outreach/signals/enrich?project_id=${projectId}`
      ).then((r) => r.json()),
    ]);

    // Use project subreddits for the review step (from onboarding table)
    if (subsRes.status === 'fulfilled' && subsRes.value?.data) {
      setProjectSubs(subsRes.value.data.map((s: { name: string }) => s.name));
    }

    // Set product context
    if (
      ctxRes.status === 'fulfilled' &&
      ctxRes.value?.productContext
    ) {
      setProductContext(ctxRes.value.productContext);
    }

    // After sync completes, fetch monitored subs to ensure store is current
    await fetchMonitoredSubs(projectId);

    setDataLoaded(true);
  }, [projectId, fetchConfig, fetchKeywords, fetchMonitoredSubs, syncSubsFromProject]);

  useEffect(() => {
    if (open) {
      setStep(0);
      loadData();
    }
  }, [open, loadData]);

  // Pre-fill local state from config and project
  useEffect(() => {
    if (config) {
      setCompetitors(config.competitors || []);
      setPainPoints(config.pain_points || []);
      setCustomerGoals(config.customer_goals || []);
      setActivities(config.target_activities || []);
      if (config.time_filter) setTimeFilter(config.time_filter);
      if (config.max_results)
        setMaxResults(String(config.max_results));
      if (config.include_comments !== undefined)
        setIncludeComments(config.include_comments);
    }
  }, [config]);

  // Pre-fill target audience from project
  useEffect(() => {
    if (project.target_audience) {
      setTargetAudience(project.target_audience);
    }
  }, [project.target_audience]);

  // Pre-fill pain points and goals from product context if available and local state is empty
  useEffect(() => {
    if (productContext && painPoints.length === 0) {
      setPainPoints(productContext.problems_solved || []);
    }
    if (productContext && customerGoals.length === 0) {
      setCustomerGoals(productContext.audience_behaviors || []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productContext]);

  // Fetch AI suggestions for activities, pain points, and goals
  const fetchAiSuggestions = useCallback(async () => {
    if (suggestionsLoaded) return;
    setSuggestionsLoading(true);
    try {
      const res = await fetch(
        `/api/outreach/suggest-targeting?project_id=${projectId}`
      );
      const json = await res.json();
      if (!json.error) {
        // Only fill fields that are currently empty
        if (activities.length === 0 && json.activities?.length) {
          setActivities(json.activities);
        }
        if (painPoints.length === 0 && json.pain_points?.length) {
          setPainPoints(json.pain_points);
        }
        if (customerGoals.length === 0 && json.customer_goals?.length) {
          setCustomerGoals(json.customer_goals);
        }
        setSuggestionsLoaded(true);
      }
    } catch {
      // Silent fail — user can still add manually
    }
    setSuggestionsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, suggestionsLoaded]);

  // Trigger AI suggestions when entering Step 2
  useEffect(() => {
    if (step === 1 && dataLoaded && !suggestionsLoaded) {
      fetchAiSuggestions();
    }
  }, [step, dataLoaded, suggestionsLoaded, fetchAiSuggestions]);

  function goToStep(next: number) {
    directionRef.current = next > step ? 1 : -1;
    setStep(next);
  }

  function handleAddKeyword() {
    const phrases = keywordInput
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
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

  function handleAddActivity() {
    const val = activityInput.trim();
    if (!val || activities.includes(val)) return;
    setActivities((prev) => [...prev, val]);
    setActivityInput('');
  }

  function handleAddCompetitor() {
    const val = competitorInput.trim();
    if (!val || competitors.includes(val)) return;
    setCompetitors((prev) => [...prev, val]);
    setCompetitorInput('');
  }

  function startEditingDescription() {
    setDescriptionDraft(project.product_description || '');
    setEditingDescription(true);
  }

  async function saveDescription() {
    setSavingDescription(true);
    try {
      const supabase = createClient();
      await supabase
        .from('projects')
        .update({ product_description: descriptionDraft })
        .eq('id', projectId);
      await refreshProject();
      setEditingDescription(false);
    } catch {
      toast.error('Failed to save description');
    }
    setSavingDescription(false);
  }

  async function handleRegenerateSuggestions() {
    setSuggestionsLoaded(false);
    setSuggestionsLoading(true);
    try {
      const res = await fetch(
        `/api/outreach/suggest-targeting?project_id=${projectId}`
      );
      const json = await res.json();
      if (!json.error) {
        if (json.activities?.length) setActivities(json.activities);
        if (json.pain_points?.length) setPainPoints(json.pain_points);
        if (json.customer_goals?.length) setCustomerGoals(json.customer_goals);
        setSuggestionsLoaded(true);
      }
    } catch {
      toast.error('Failed to regenerate suggestions');
    }
    setSuggestionsLoading(false);
  }

  async function handleFinish() {
    setSaving(true);
    try {
      // Save outreach config
      await fetch('/api/outreach/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          competitors,
          time_filter: timeFilter,
          max_results: parseInt(maxResults, 10),
          include_comments: includeComments,
          pain_points: painPoints,
          customer_goals: customerGoals,
          target_activities: activities,
          scan_wizard_completed: true,
        }),
      });

      // Save updated target audience back to project if changed
      if (targetAudience !== (project.target_audience || '')) {
        const supabase = createClient();
        await supabase
          .from('projects')
          .update({ target_audience: targetAudience || null })
          .eq('id', projectId);
      }

      toast.success('Scan setup complete');
      onOpenChange(false);
      onComplete();
    } catch {
      toast.error('Failed to save scan settings');
    }
    setSaving(false);
  }

  const activeKeywords = keywords.filter((k) => k.is_active);
  const activeSubs = monitoredSubs.filter((s) => s.is_active);

  // Determine what's present/missing for the review
  const configKeywords = config?.keywords || [];
  const configCompetitors = config?.competitors || [];
  const allKeywordPhrases = keywords.flatMap((k) => k.phrases);
  const displayKeywords =
    allKeywordPhrases.length > 0 ? allKeywordPhrases : configKeywords;
  // For the review step, prefer project subreddits (from onboarding),
  // fall back to monitored subs if available
  const displaySubs = projectSubs.length > 0
    ? projectSubs
    : monitoredSubs.map((s) => s.name);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[1100px] w-[95vw] max-h-[92vh]"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Scan Setup Wizard</DialogTitle>
        {/* Progress bar */}
        <div className="flex gap-1 mb-1">
          {[0, 1, 2].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                s <= step ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait" custom={directionRef.current}>
          {/* ═══════ STEP 0: Full context review ═══════ */}
          {step === 0 && (
            <motion.div
              key="step-0"
              custom={directionRef.current}
              variants={slideHorizontalVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-3"
            >
              <div>
                <h2 className="text-xl font-bold">
                  Your Project Context
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  This is everything we know about your project from
                  onboarding. The scan will use all of this to find
                  relevant leads.
                </p>
              </div>

              <ScrollArea className="h-[60vh] pr-3">
                <div className="space-y-3">
                  {/* ── Product ── */}
                  <div className="rounded-xl border p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      <h3 className="text-lg font-bold">{project.product_name}</h3>
                    </div>
                    <div className="pl-6 space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                            Description
                          </p>
                          {!editingDescription && (
                            <button
                              onClick={startEditingDescription}
                              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                            >
                              <Pencil className="h-3 w-3" />
                              Edit
                            </button>
                          )}
                        </div>
                        {editingDescription ? (
                          <div className="space-y-2">
                            <textarea
                              value={descriptionDraft}
                              onChange={(e) => setDescriptionDraft(e.target.value)}
                              placeholder="Describe what your product does, who it's for, and what makes it unique..."
                              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[100px] resize-y"
                              autoFocus
                            />
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                className="h-7 text-xs"
                                onClick={saveDescription}
                                disabled={savingDescription || !descriptionDraft.trim()}
                              >
                                {savingDescription ? (
                                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                                ) : (
                                  <Check className="mr-1.5 h-3 w-3" />
                                )}
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs"
                                onClick={() => setEditingDescription(false)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : project.product_description ? (
                          <>
                            <p className="text-sm leading-relaxed">
                              {project.product_description}
                            </p>
                            {project.product_description.length < 100 && (
                              <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                                <p className="text-[11px] text-amber-400 leading-relaxed">
                                  <strong>Recommended:</strong> Your description is quite short. A detailed 2-3 sentence description of what your product does, who it serves, and what makes it unique will significantly improve signal quality and lead relevance.
                                </p>
                              </div>
                            )}
                          </>
                        ) : (
                          <button
                            onClick={startEditingDescription}
                            className="text-xs text-muted-foreground italic hover:text-foreground transition-colors"
                          >
                            No description set — click to add one.
                          </button>
                        )}
                      </div>
                      {project.product_url && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5">
                            URL
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {project.product_url}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Target Audience ── */}
                  <ContextCard
                    icon={
                      <Target className="h-4 w-4 text-emerald-500" />
                    }
                    title="Target Audience"
                    empty={!project.target_audience}
                    emptyText="No target audience configured yet."
                  >
                    <p className="text-sm leading-relaxed">
                      {project.target_audience}
                    </p>
                  </ContextCard>

                  {/* ── Subreddits ── */}
                  <ContextCard
                    icon={
                      <MessageSquare className="h-4 w-4 text-orange-500" />
                    }
                    title="Subreddits"
                    count={displaySubs.length}
                    empty={displaySubs.length === 0}
                    emptyText="No subreddits configured — you'll add them next."
                  >
                    <div className="flex flex-wrap gap-1.5">
                      {displaySubs.map((name) => (
                        <Badge
                          key={name}
                          variant="secondary"
                          className="text-[11px]"
                        >
                          r/{name}
                        </Badge>
                      ))}
                    </div>
                  </ContextCard>

                  {/* ── Keywords ── */}
                  <ContextCard
                    icon={
                      <Hash className="h-4 w-4 text-blue-500" />
                    }
                    title="Keywords"
                    count={displayKeywords.length}
                    empty={displayKeywords.length === 0}
                    emptyText="No keywords configured — you'll add them next."
                  >
                    <div className="flex flex-wrap gap-1.5">
                      {displayKeywords.map((kw) => (
                        <Badge
                          key={kw}
                          variant="secondary"
                          className="text-[11px]"
                        >
                          {kw}
                        </Badge>
                      ))}
                    </div>
                  </ContextCard>

                  {/* ── Competitors ── */}
                  <ContextCard
                    icon={
                      <Swords className="h-4 w-4 text-purple-500" />
                    }
                    title="Competitors"
                    count={configCompetitors.length}
                    empty={configCompetitors.length === 0}
                    emptyText="No competitors tracked — you can add them next."
                  >
                    <div className="flex flex-wrap gap-1.5">
                      {configCompetitors.map((comp) => (
                        <Badge
                          key={comp}
                          variant="secondary"
                          className="text-[11px]"
                        >
                          {comp}
                        </Badge>
                      ))}
                    </div>
                  </ContextCard>

                  {/* ── AI Product Context (if generated) ── */}
                  {productContext &&
                    (productContext.problems_solved.length > 0 ||
                      productContext.solution_features.length > 0 ||
                      productContext.audience_behaviors.length >
                        0) && (
                      <ContextCard
                        icon={
                          <Brain className="h-4 w-4 text-pink-500" />
                        }
                        title="AI Product Intelligence"
                      >
                        {productContext.problems_solved.length > 0 && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
                              Problems Solved
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {productContext.problems_solved.map(
                                (p) => (
                                  <Badge
                                    key={p}
                                    variant="outline"
                                    className="text-[10px]"
                                  >
                                    {p}
                                  </Badge>
                                )
                              )}
                            </div>
                          </div>
                        )}
                        {productContext.solution_features.length >
                          0 && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
                              Key Features
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {productContext.solution_features.map(
                                (f) => (
                                  <Badge
                                    key={f}
                                    variant="outline"
                                    className="text-[10px]"
                                  >
                                    {f}
                                  </Badge>
                                )
                              )}
                            </div>
                          </div>
                        )}
                        {productContext.audience_behaviors.length >
                          0 && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
                              Audience Behaviors
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {productContext.audience_behaviors.map(
                                (b) => (
                                  <Badge
                                    key={b}
                                    variant="outline"
                                    className="text-[10px]"
                                  >
                                    {b}
                                  </Badge>
                                )
                              )}
                            </div>
                          </div>
                        )}
                        {productContext.competitor_weaknesses.length >
                          0 && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
                              Competitor Weaknesses
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {productContext.competitor_weaknesses.map(
                                (w) => (
                                  <Badge
                                    key={w}
                                    variant="outline"
                                    className="text-[10px]"
                                  >
                                    {w}
                                  </Badge>
                                )
                              )}
                            </div>
                          </div>
                        )}
                      </ContextCard>
                    )}

                  {/* Missing data warning */}
                  {(displayKeywords.length === 0 ||
                    displaySubs.length === 0) && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      <div className="text-xs">
                        <p className="font-medium text-amber-600">
                          Missing configuration
                        </p>
                        <p className="text-muted-foreground mt-0.5">
                          {displayKeywords.length === 0 &&
                            'No keywords set. '}
                          {displaySubs.length === 0 &&
                            'No subreddits configured. '}
                          You&apos;ll set these up in the next step.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-muted-foreground">
                  Step 1 of 3 — Review
                </p>
                <Button onClick={() => goToStep(1)}>
                  Customize Scan{' '}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* ═══════ STEP 1: Deep dive targeting ═══════ */}
          {step === 1 && (
            <motion.div
              key="step-1"
              custom={directionRef.current}
              variants={slideHorizontalVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">
                    Refine Your Targeting
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Fine-tune who you&apos;re looking for, what keywords to track,
                    and where to search.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 text-xs gap-1.5"
                  onClick={handleRegenerateSuggestions}
                  disabled={suggestionsLoading}
                >
                  {suggestionsLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  {suggestionsLoading ? 'Generating...' : 'AI Suggest'}
                </Button>
              </div>

              {/* AI suggestions banner */}
              {suggestionsLoading && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span className="text-xs text-primary">
                    Generating AI recommendations for activities, pain points, and goals...
                  </span>
                </div>
              )}

              <ScrollArea className="h-[60vh] pr-3">
                <div className="space-y-5">
                  {/* Target Audience */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Target className="h-3.5 w-3.5 text-emerald-500" />
                      Target Audience
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Who are you trying to reach? This helps the AI identify
                      high-intent signals from the right people.
                    </p>
                    <textarea
                      value={targetAudience}
                      onChange={(e) => setTargetAudience(e.target.value)}
                      placeholder="Describe your ideal customer — who they are, what they do, what they need..."
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[80px] resize-y"
                    />
                  </div>

                  {/* Activities */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Activity className="h-3.5 w-3.5 text-indigo-500" />
                      Audience Activities
                      {suggestionsLoaded && activities.length > 0 && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-normal text-primary border-primary/30">
                          AI generated
                        </Badge>
                      )}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      What does your target audience actively do? Things they buy, track, research, or participate in.
                    </p>
                    <div className="flex gap-2">
                      <Input
                        value={activityInput}
                        onChange={(e) =>
                          setActivityInput(e.target.value)
                        }
                        onKeyDown={(e) =>
                          e.key === 'Enter' &&
                          (e.preventDefault(), handleAddActivity())
                        }
                        placeholder="e.g., buying booster boxes, tracking card prices"
                        className="text-xs h-8"
                      />
                      <Button
                        onClick={handleAddActivity}
                        size="sm"
                        className="h-8 px-3"
                        disabled={!activityInput.trim()}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    {activities.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {activities.map((act) => (
                          <Badge
                            key={act}
                            variant="secondary"
                            className="text-[11px] pr-1"
                          >
                            {act}
                            <button
                              onClick={() =>
                                setActivities((prev) =>
                                  prev.filter((a) => a !== act)
                                )
                              }
                              className="ml-1 text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Pain Points */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                      Pain Points
                      {suggestionsLoaded && painPoints.length > 0 && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-normal text-primary border-primary/30">
                          AI generated
                        </Badge>
                      )}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      What problems does your product solve? Helps AI
                      identify high-intent signals.
                    </p>
                    <div className="flex gap-2">
                      <Input
                        value={painInput}
                        onChange={(e) =>
                          setPainInput(e.target.value)
                        }
                        onKeyDown={(e) =>
                          e.key === 'Enter' &&
                          (e.preventDefault(),
                          handleAddPainPoint())
                        }
                        placeholder="e.g., hard to track card values, no price alerts"
                        className="text-xs h-8"
                      />
                      <Button
                        onClick={handleAddPainPoint}
                        size="sm"
                        className="h-8 px-3"
                        disabled={!painInput.trim()}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    {painPoints.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {painPoints.map((point) => (
                          <Badge
                            key={point}
                            variant="secondary"
                            className="text-[11px] pr-1"
                          >
                            {point}
                            <button
                              onClick={() =>
                                setPainPoints((prev) =>
                                  prev.filter((p) => p !== point)
                                )
                              }
                              className="ml-1 text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Customer Goals */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Target className="h-3.5 w-3.5 text-cyan-500" />
                      Customer Goals
                      {suggestionsLoaded && customerGoals.length > 0 && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-normal text-primary border-primary/30">
                          AI generated
                        </Badge>
                      )}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      What are your customers trying to achieve?
                    </p>
                    <div className="flex gap-2">
                      <Input
                        value={goalInput}
                        onChange={(e) =>
                          setGoalInput(e.target.value)
                        }
                        onKeyDown={(e) =>
                          e.key === 'Enter' &&
                          (e.preventDefault(), handleAddGoal())
                        }
                        placeholder="e.g., maximize ROI, track collection value"
                        className="text-xs h-8"
                      />
                      <Button
                        onClick={handleAddGoal}
                        size="sm"
                        className="h-8 px-3"
                        disabled={!goalInput.trim()}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    {customerGoals.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {customerGoals.map((goal) => (
                          <Badge
                            key={goal}
                            variant="secondary"
                            className="text-[11px] pr-1"
                          >
                            {goal}
                            <button
                              onClick={() =>
                                setCustomerGoals((prev) =>
                                  prev.filter((g) => g !== goal)
                                )
                              }
                              className="ml-1 text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border-t" />

                  {/* Keywords */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Hash className="h-3.5 w-3.5 text-blue-500" />
                      Search Keywords
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Phrases to search for in Reddit posts and
                      comments. Separate multiple with commas.
                    </p>
                    <div className="flex gap-2">
                      <Input
                        value={keywordInput}
                        onChange={(e) =>
                          setKeywordInput(e.target.value)
                        }
                        onKeyDown={(e) =>
                          e.key === 'Enter' &&
                          (e.preventDefault(), handleAddKeyword())
                        }
                        placeholder="e.g., best trading card app, investment tracker"
                        className="text-xs h-8"
                      />
                      <Button
                        onClick={handleAddKeyword}
                        size="sm"
                        className="h-8 px-3"
                        disabled={!keywordInput.trim()}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    {keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {keywords.map((kw) => (
                          <div
                            key={kw.id}
                            className="flex items-center gap-0.5"
                          >
                            {kw.phrases.map((phrase) => (
                              <Badge
                                key={phrase}
                                variant="secondary"
                                className="text-[11px]"
                              >
                                {phrase}
                              </Badge>
                            ))}
                            <button
                              onClick={() => removeKeyword(kw.id)}
                              className="text-muted-foreground hover:text-destructive ml-0.5"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Competitors */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Swords className="h-3.5 w-3.5 text-purple-500" />
                      Competitors
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Products people might be switching from or
                      comparing to. We&apos;ll watch for mentions.
                    </p>
                    <div className="flex gap-2">
                      <Input
                        value={competitorInput}
                        onChange={(e) =>
                          setCompetitorInput(e.target.value)
                        }
                        onKeyDown={(e) =>
                          e.key === 'Enter' &&
                          (e.preventDefault(),
                          handleAddCompetitor())
                        }
                        placeholder="e.g., TCGplayer, CardMarket"
                        className="text-xs h-8"
                      />
                      <Button
                        onClick={handleAddCompetitor}
                        size="sm"
                        className="h-8 px-3"
                        disabled={!competitorInput.trim()}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    {competitors.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {competitors.map((comp) => (
                          <Badge
                            key={comp}
                            variant="secondary"
                            className="text-[11px] pr-1"
                          >
                            {comp}
                            <button
                              onClick={() =>
                                setCompetitors((prev) =>
                                  prev.filter((c) => c !== comp)
                                )
                              }
                              className="ml-1 text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Subreddits */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <MessageSquare className="h-3.5 w-3.5 text-orange-500" />
                      Subreddits to Monitor
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      These are the subreddits we&apos;ll scan for signals. Add
                      more or remove ones that aren&apos;t relevant.
                    </p>
                    <div className="flex gap-2">
                      <Input
                        value={subInput}
                        onChange={(e) =>
                          setSubInput(e.target.value)
                        }
                        onKeyDown={(e) =>
                          e.key === 'Enter' &&
                          (e.preventDefault(), handleAddSub())
                        }
                        placeholder="Add subreddit name..."
                        className="text-xs h-8"
                      />
                      <Button
                        onClick={handleAddSub}
                        size="sm"
                        className="h-8 px-3"
                        disabled={!subInput.trim()}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    {monitoredSubs.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {monitoredSubs.map((sub) => (
                          <Badge
                            key={sub.id}
                            variant="secondary"
                            className="text-[11px] pr-1"
                          >
                            r/{sub.name}
                            <button
                              onClick={() =>
                                removeMonitoredSub(sub.id)
                              }
                              className="ml-1 text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>

              <div className="flex items-center justify-between pt-1">
                <Button
                  variant="ghost"
                  onClick={() => goToStep(0)}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" /> Review
                </Button>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground">
                    Step 2 of 3
                  </p>
                  <Button onClick={() => goToStep(2)}>
                    Configure Scan{' '}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══════ STEP 2: Configure & Launch ═══════ */}
          {step === 2 && (
            <motion.div
              key="step-2"
              custom={directionRef.current}
              variants={slideHorizontalVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-5"
            >
              <div>
                <h2 className="text-xl font-bold">
                  Configure & Launch
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Set search depth and preferences, then start scanning
                  Reddit for leads.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Time Range</h3>
                  <Select
                    value={timeFilter}
                    onValueChange={setTimeFilter}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hour">
                        Last hour
                      </SelectItem>
                      <SelectItem value="day">Last day</SelectItem>
                      <SelectItem value="week">
                        Last week
                      </SelectItem>
                      <SelectItem value="month">
                        Last month
                      </SelectItem>
                      <SelectItem value="year">
                        Last year
                      </SelectItem>
                      <SelectItem value="all">All time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Max Results</h3>
                  <Select
                    value={maxResults}
                    onValueChange={setMaxResults}
                  >
                    <SelectTrigger className="h-8 text-xs">
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
              </div>

              {/* Comment toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">
                    Include Comment Search
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Search Reddit comments for leads buried in threads
                  </p>
                </div>
                <button
                  onClick={() =>
                    setIncludeComments(!includeComments)
                  }
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    includeComments ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-lg ring-0 transition-transform ${
                      includeComments
                        ? 'translate-x-4'
                        : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Summary card */}
              <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                <h3 className="text-sm font-semibold">Scan Summary</h3>
                <div className="space-y-2">
                  <SummaryRow
                    label="Subreddits"
                    value={`${activeSubs.length} active`}
                    ok={activeSubs.length > 0}
                  />
                  <SummaryRow
                    label="Keywords"
                    value={`${activeKeywords.length} keyword groups`}
                    ok={activeKeywords.length > 0}
                  />
                  <SummaryRow
                    label="Competitors"
                    value={String(competitors.length)}
                    ok={competitors.length > 0}
                  />
                  <SummaryRow
                    label="Time range"
                    value={timeFilter}
                    ok
                  />
                  <SummaryRow
                    label="Max results"
                    value={maxResults}
                    ok
                  />
                  <SummaryRow
                    label="Comment search"
                    value={includeComments ? 'On' : 'Off'}
                    ok={includeComments}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <Button
                  variant="ghost"
                  onClick={() => goToStep(1)}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button
                  onClick={handleFinish}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Radar className="mr-2 h-4 w-4" />
                  )}
                  Start Scanning
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

/** Reusable card for the context review step */
function ContextCard({
  icon,
  title,
  count,
  empty,
  emptyText,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  empty?: boolean;
  emptyText?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          {icon}
          {title}
        </div>
        {count !== undefined && (
          <Badge variant="secondary" className="text-[10px]">
            {count}
          </Badge>
        )}
      </div>
      <div className="pl-6 space-y-2">
        {empty ? (
          <p className="text-xs text-muted-foreground italic">
            {emptyText}
          </p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 font-medium">
        {ok ? (
          <Check className="h-3 w-3 text-green-500" />
        ) : (
          <span className="h-3 w-3 rounded-full border border-muted-foreground/30 inline-block" />
        )}
        {value}
      </span>
    </div>
  );
}
