'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Plus,
  X,
  Loader2,
  Sparkles,
  Check,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { slideHorizontalVariants } from '@/lib/motion';
import { useOutreachStore } from '@/stores/outreach-store';
import { useProject } from '@/contexts/project-context';
import { DiscordConnect } from '@/components/outreach/DiscordConnect';
import { DiscordDmConnect } from '@/components/outreach/DiscordDmConnect';
import { SlackConnect } from '@/components/outreach/SlackConnect';
import { EmailConnect } from '@/components/outreach/EmailConnect';
import { TelegramConnect } from '@/components/outreach/TelegramConnect';
import { toast } from 'sonner';
import type { AlertChannel } from '@/types';

interface AlertsSetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

const STEP_LABELS = ['Channels', 'Keywords', 'Subreddits'];

const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with','by',
  'is','are','was','were','be','been','being','have','has','had','do','does',
  'did','will','would','could','should','may','might','can','this','that',
  'these','those','it','its','i','you','we','they','he','she','my','your',
  'our','their','what','which','who','how','when','where','why','all','each',
  'every','both','few','more','most','other','some','such','no','not','only',
  'very','just','about','into','from','up','out','so','than','too','also',
  'as','if','then','because','while','after','before','between','through',
  'during','above','below','any','own','same','over','under','again','further',
  'once','here','there','am','get','got','make','made','use','used','using',
  'help','helps','way','platform','tool','software','app','product','service',
  'solution','build','built','create','created','designed','based','like',
  'new','best','need','want','find','provide','provides','offer','offers',
  'enable','enables','allow','allows','easy','simple','powerful','fast',
  'real','time','data','users','user','people','them','one','two','work',
  'works','working','well',
]);

function extractSuggestions(description: string, audience: string | null, productName: string): string[] {
  const text = `${description} ${audience || ''}`.toLowerCase();
  const words = text.split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  // Extract unique single words (domain-specific terms)
  const singles = [...new Set(words)];

  // Extract 2-word phrases from the original text
  const phrases: string[] = [];
  const rawWords = text.split(/[^a-z0-9]+/).filter((w) => w.length > 0);
  for (let i = 0; i < rawWords.length - 1; i++) {
    const a = rawWords[i], b = rawWords[i + 1];
    if (a.length > 2 && b.length > 2 && !STOP_WORDS.has(a) && !STOP_WORDS.has(b)) {
      phrases.push(`${a} ${b}`);
    }
  }
  const uniquePhrases = [...new Set(phrases)];

  // Combine: phrases first (more specific), then singles
  const suggestions = [...uniquePhrases, ...singles.filter((s) => !uniquePhrases.some((p) => p.includes(s)))];

  // Filter out anything that's just the product name
  const nameLower = productName.toLowerCase();
  const nameWords = new Set(nameLower.split(/\s+/));
  const result: string[] = [];
  for (const s of suggestions) {
    if (s === nameLower || nameWords.has(s)) continue;
    result.push(s);
    if (result.length >= 12) break;
  }

  return result;
}

interface SubredditSuggestion {
  name: string;
  reason: string;
  approach: string;
  match: 'best' | 'good' | 'relevant';
}

export function AlertsSetupWizard({
  open,
  onOpenChange,
  projectId,
}: AlertsSetupWizardProps) {
  const { project } = useProject();
  const {
    config,
    keywords,
    monitoredSubs,
    fetchConfig,
    fetchKeywords,
    fetchMonitoredSubs,
    addKeyword,
    addMonitoredSub,
    removeMonitoredSub,
    syncSubsFromProject,
    disconnectChannel,
  } = useOutreachStore();

  const suggestions = extractSuggestions(
    project.product_description || '',
    project.target_audience,
    project.product_name || '',
  );

  const [step, setStep] = useState(0);
  const directionRef = useRef(1);

  // Step 2: Keywords
  const [keywordInput, setKeywordInput] = useState('');
  const [aiKeywords, setAiKeywords] = useState<string[]>([]);
  const [selectedAiKeywords, setSelectedAiKeywords] = useState<Set<string>>(new Set());
  const [generatingKeywords, setGeneratingKeywords] = useState(false);

  // Step 3: Subreddits
  const [subInput, setSubInput] = useState('');
  const [aiSubreddits, setAiSubreddits] = useState<SubredditSuggestion[]>([]);
  const [selectedAiSubs, setSelectedAiSubs] = useState<Set<string>>(new Set());
  const [suggestingSubs, setSuggestingSubs] = useState(false);

  // Load data on open
  useEffect(() => {
    if (open) {
      setStep(0);
      setAiKeywords([]);
      setSelectedAiKeywords(new Set());
      setAiSubreddits([]);
      setSelectedAiSubs(new Set());
      setKeywordInput('');
      setSubInput('');
      fetchConfig(projectId);
      fetchKeywords(projectId);
      syncSubsFromProject(projectId).then(() => fetchMonitoredSubs(projectId));
    }
  }, [open, projectId, fetchConfig, fetchKeywords, fetchMonitoredSubs, syncSubsFromProject]);

  // Channel helpers
  const connectedChannels: AlertChannel[] = (
    ['discord', 'discord_dm', 'slack', 'email', 'telegram'] as AlertChannel[]
  ).filter((ch) => {
    switch (ch) {
      case 'discord': return !!config?.discord_connected;
      case 'discord_dm': return !!config?.discord_dm_connected;
      case 'slack': return !!config?.slack_connected;
      case 'email': return !!config?.email_connected;
      case 'telegram': return !!config?.telegram_connected;
    }
  });

  function goToStep(next: number) {
    directionRef.current = next > step ? 1 : -1;
    setStep(next);
  }

  // --- Step 2: Keywords ---

  const handleGenerateKeywords = useCallback(async () => {
    setGeneratingKeywords(true);
    try {
      const res = await fetch('/api/outreach/keywords/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: project.product_name,
          productDescription: project.product_description,
          targetAudience: project.target_audience,
        }),
      });
      const json = await res.json();
      if (json.error) {
        toast.error(json.error);
      } else {
        setAiKeywords(json.keywords || []);
        setSelectedAiKeywords(new Set(json.keywords || []));
      }
    } catch {
      toast.error('Failed to generate keywords');
    }
    setGeneratingKeywords(false);
  }, [project]);

  function toggleAiKeyword(kw: string) {
    setSelectedAiKeywords((prev) => {
      const next = new Set(prev);
      if (next.has(kw)) next.delete(kw);
      else next.add(kw);
      return next;
    });
  }

  async function addSelectedAiKeywords() {
    const existing = new Set(keywords.flatMap((k) => k.phrases.map((p) => p.toLowerCase())));
    const toAdd = [...selectedAiKeywords].filter((kw) => !existing.has(kw.toLowerCase()));
    for (const kw of toAdd) {
      await addKeyword(projectId, [kw]);
    }
    if (toAdd.length > 0) toast.success(`Added ${toAdd.length} keywords`);
    setAiKeywords([]);
    setSelectedAiKeywords(new Set());
  }

  function handleAddManualKeywords() {
    const phrases = keywordInput
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (phrases.length === 0) return;
    addKeyword(projectId, phrases);
    setKeywordInput('');
  }

  // --- Step 3: Subreddits ---

  const handleSuggestSubreddits = useCallback(async () => {
    setSuggestingSubs(true);
    try {
      const existingNames = monitoredSubs.map((s) => s.name);
      const res = await fetch('/api/ai/suggest-subreddits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: project.product_name,
          description: project.product_description,
          url: project.product_url,
          audience: project.target_audience,
          tone: project.tone,
          existingSubreddits: existingNames,
          competitors: [],
        }),
      });
      const json = await res.json();
      if (json.error) {
        toast.error(json.error);
      } else {
        const suggestions: SubredditSuggestion[] = json.subreddits || [];
        setAiSubreddits(suggestions);
        setSelectedAiSubs(new Set(suggestions.map((s) => s.name)));
      }
    } catch {
      toast.error('Failed to suggest subreddits');
    }
    setSuggestingSubs(false);
  }, [project, monitoredSubs]);

  function toggleAiSub(name: string) {
    setSelectedAiSubs((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function addSelectedAiSubs() {
    const existing = new Set(monitoredSubs.map((s) => s.name.toLowerCase()));
    const toAdd = [...selectedAiSubs].filter((n) => !existing.has(n.toLowerCase()));
    for (const name of toAdd) {
      await addMonitoredSub(projectId, name);
    }
    if (toAdd.length > 0) toast.success(`Added ${toAdd.length} subreddits`);
    setAiSubreddits([]);
    setSelectedAiSubs(new Set());
  }

  function handleAddManualSub() {
    if (!subInput.trim()) return;
    addMonitoredSub(projectId, subInput.trim());
    setSubInput('');
  }

  function handleDone() {
    // Add any selected AI keywords/subs that haven't been committed yet
    if (selectedAiKeywords.size > 0 && aiKeywords.length > 0) {
      addSelectedAiKeywords();
    }
    if (selectedAiSubs.size > 0 && aiSubreddits.length > 0) {
      addSelectedAiSubs();
    }
    onOpenChange(false);
  }

  const matchBadgeColor: Record<string, string> = {
    best: 'bg-green-500/10 text-green-600 border-green-500/20',
    good: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    relevant: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-2xl w-[95vw] max-h-[85vh]"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Alerts Setup Wizard</DialogTitle>

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

        {/* Step label */}
        <p className="text-[11px] text-muted-foreground text-center">
          Step {step + 1} of 3 &middot; {STEP_LABELS[step]}
        </p>

        <AnimatePresence mode="wait" custom={directionRef.current}>
          {/* ═══════ STEP 0: Connect Channels ═══════ */}
          {step === 0 && (
            <motion.div
              key="step-0"
              custom={directionRef.current}
              variants={slideHorizontalVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-4"
            >
              <div>
                <h2 className="text-lg font-bold">Connect your alert channels</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Choose where you want to receive alerts when posts match your keywords.
                </p>
              </div>

              <ScrollArea className="max-h-[50vh]">
                <div className="grid grid-cols-2 gap-3">
                  <DiscordConnect
                    config={config}
                    projectId={projectId}
                    onDisconnect={() => disconnectChannel(projectId, 'discord')}
                  />
                  <DiscordDmConnect
                    config={config}
                    projectId={projectId}
                    onDisconnect={() => disconnectChannel(projectId, 'discord_dm')}
                  />
                  <SlackConnect
                    config={config}
                    projectId={projectId}
                    onDisconnect={() => disconnectChannel(projectId, 'slack')}
                  />
                  <EmailConnect
                    config={config}
                    projectId={projectId}
                    onDisconnect={() => disconnectChannel(projectId, 'email')}
                  />
                  <TelegramConnect
                    config={config}
                    projectId={projectId}
                    onDisconnect={() => disconnectChannel(projectId, 'telegram')}
                  />
                </div>
              </ScrollArea>

              {connectedChannels.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {connectedChannels.length} channel{connectedChannels.length !== 1 ? 's' : ''} connected
                </p>
              )}

              <div className="flex justify-end">
                <Button onClick={() => goToStep(1)} className="gap-1.5">
                  Next <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* ═══════ STEP 1: Keywords ═══════ */}
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
              <div>
                <h2 className="text-lg font-bold">What should we monitor?</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Add keywords to track. We&apos;ll alert you when Reddit posts match.
                </p>
              </div>

              <ScrollArea className="max-h-[50vh] pr-2">
                <div className="space-y-4">
                  {/* Suggestions extracted from product context */}
                  {suggestions.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] text-muted-foreground font-medium">Suggested for your product</p>
                      <div className="flex flex-wrap gap-1.5">
                        {suggestions.map((kw) => (
                          <button
                            key={kw}
                            onClick={() => addKeyword(projectId, [kw])}
                            className="inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                          >
                            <Plus className="h-2.5 w-2.5" />
                            {kw}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI keyword suggestions */}
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateKeywords}
                      disabled={generatingKeywords}
                      className="gap-1.5"
                    >
                      {generatingKeywords ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : aiKeywords.length > 0 ? (
                        <RefreshCw className="h-3.5 w-3.5" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      {aiKeywords.length > 0 ? 'Regenerate' : 'Generate with AI'}
                    </Button>

                    {aiKeywords.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[11px] text-muted-foreground font-medium">
                          Tap to select
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {aiKeywords.map((kw) => (
                            <button
                              key={kw}
                              onClick={() => toggleAiKeyword(kw)}
                              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                                selectedAiKeywords.has(kw)
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                              }`}
                            >
                              {selectedAiKeywords.has(kw) && <Check className="h-3 w-3" />}
                              {kw}
                            </button>
                          ))}
                        </div>
                        <Button
                          size="sm"
                          onClick={addSelectedAiKeywords}
                          disabled={selectedAiKeywords.size === 0}
                          className="gap-1.5"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add {selectedAiKeywords.size} selected
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-[11px] text-muted-foreground">or add manually</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>

                  {/* Manual input */}
                  <div className="flex gap-2">
                    <Input
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
                      placeholder="e.g. arb, sports betting odds, sure bet"
                      className="text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddManualKeywords();
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleAddManualKeywords}
                      disabled={!keywordInput.trim()}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Already-added keywords */}
                  {keywords.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] text-muted-foreground font-medium">
                        Added keywords ({keywords.length})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {keywords.map((kw) => (
                          <Badge
                            key={kw.id}
                            variant="secondary"
                            className="gap-1 text-xs"
                          >
                            {kw.phrases.join(', ')}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => goToStep(0)} className="gap-1.5">
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </Button>
                <Button onClick={() => goToStep(2)} className="gap-1.5">
                  Next <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* ═══════ STEP 2: Subreddits ═══════ */}
          {step === 2 && (
            <motion.div
              key="step-2"
              custom={directionRef.current}
              variants={slideHorizontalVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-4"
            >
              <div>
                <h2 className="text-lg font-bold">Which subreddits should we watch?</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Select the subreddits to monitor for matching posts.
                </p>
              </div>

              <ScrollArea className="max-h-[50vh] pr-2">
                <div className="space-y-4">
                  {/* AI Suggest */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSuggestSubreddits}
                    disabled={suggestingSubs}
                    className="gap-1.5"
                  >
                    {suggestingSubs ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    Suggest with AI
                  </Button>

                  {/* AI suggestion cards */}
                  {aiSubreddits.length > 0 && (
                    <div className="space-y-2">
                      <div className="space-y-1.5">
                        {aiSubreddits.map((sub) => (
                          <button
                            key={sub.name}
                            onClick={() => toggleAiSub(sub.name)}
                            className={`w-full text-left rounded-lg border p-3 transition-colors ${
                              selectedAiSubs.has(sub.name)
                                ? 'border-primary bg-primary/5'
                                : 'hover:bg-muted/50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {selectedAiSubs.has(sub.name) && (
                                  <Check className="h-3.5 w-3.5 text-primary" />
                                )}
                                <span className="text-sm font-medium">r/{sub.name}</span>
                              </div>
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${matchBadgeColor[sub.match] || ''}`}
                              >
                                {sub.match}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {sub.reason}
                            </p>
                          </button>
                        ))}
                      </div>
                      <Button
                        size="sm"
                        onClick={addSelectedAiSubs}
                        disabled={selectedAiSubs.size === 0}
                        className="gap-1.5"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add {selectedAiSubs.size} selected
                      </Button>
                    </div>
                  )}

                  {/* Manual input */}
                  <div className="flex gap-2">
                    <Input
                      value={subInput}
                      onChange={(e) => setSubInput(e.target.value)}
                      placeholder="e.g. SaaS, startups, webdev"
                      className="text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddManualSub();
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleAddManualSub}
                      disabled={!subInput.trim()}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Already-monitored subs */}
                  {monitoredSubs.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] text-muted-foreground font-medium">
                        Monitored subreddits ({monitoredSubs.length})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {monitoredSubs.map((sub) => (
                          <Badge
                            key={sub.id}
                            variant="secondary"
                            className="gap-1 text-xs group"
                          >
                            r/{sub.name}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeMonitoredSub(sub.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => goToStep(1)} className="gap-1.5">
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </Button>
                <Button onClick={handleDone} className="gap-1.5">
                  Done <Check className="h-3.5 w-3.5" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
