'use client';

import { useState } from 'react';
import { ArrowRight, ArrowLeft, Sparkles, Loader2, CheckCircle2, AlertTriangle, Shield, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useCanvasStore } from '@/stores/canvas-store';
import type { Project } from '@/types';
import type { SuggestedSubreddit } from '@/lib/ai/prompts';

const TONES = ['Professional', 'Casual', 'Humorous', 'Technical', 'Storytelling', 'Educational'];

interface OnboardingWizardProps {
  project: Project;
  onComplete: () => void;
}

export function OnboardingWizard({ project, onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);

  // Step 1: Product details
  const [productName, setProductName] = useState(project.product_name);
  const [productDesc, setProductDesc] = useState(project.product_description);
  const [productUrl, setProductUrl] = useState(project.product_url || '');
  const [audience, setAudience] = useState(project.target_audience || '');
  const [tone, setTone] = useState(project.tone);

  // Step 2: Subreddit suggestions
  const [suggestions, setSuggestions] = useState<SuggestedSubreddit[]>([]);
  const [selectedSubs, setSelectedSubs] = useState<Set<string>>(new Set());
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestError, setSuggestError] = useState(false);
  const [manualInput, setManualInput] = useState('');

  // Step 3: Fetching posts
  const [loadingPosts, setLoadingPosts] = useState(false);

  const { updateNodeData, addNode, nodes, edges, setEdges } = useCanvasStore();

  async function handleFetchSuggestions() {
    setLoadingSuggestions(true);
    try {
      const res = await fetch('/api/ai/suggest-subreddits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: productName,
          description: productDesc,
          url: productUrl || undefined,
          audience: audience || undefined,
          tone,
        }),
      });
      const json = await res.json();
      if (json.subreddits) {
        setSuggestions(json.subreddits);
        // Auto-select low-risk ones
        const autoSelect = new Set<string>();
        json.subreddits.forEach((s: SuggestedSubreddit) => {
          if (s.risk === 'low') autoSelect.add(s.name);
        });
        setSelectedSubs(autoSelect);
      }
    } catch {
      setSuggestError(true);
    }
    setLoadingSuggestions(false);
  }

  function handleAddManual() {
    const name = manualInput.trim().replace(/^r\//, '');
    if (!name) return;
    setSelectedSubs((prev) => new Set(prev).add(name));
    // Also add as a suggestion card for display
    if (!suggestions.find((s) => s.name === name)) {
      setSuggestions((prev) => [...prev, { name, reason: 'Manually added', approach: '', risk: 'medium' as const }]);
    }
    setManualInput('');
  }

  function toggleSubreddit(name: string) {
    setSelectedSubs((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function handleFinish() {
    setLoadingPosts(true);

    // Update product node with latest data
    const productNode = nodes.find((n) => n.data.type === 'product');
    if (productNode) {
      updateNodeData(productNode.id, {
        name: productName,
        description: productDesc,
        url: productUrl,
        audience,
        tone,
      });
    }

    // Add subreddit nodes for each selected subreddit
    const subsArray = Array.from(selectedSubs);
    const newEdges = [...edges];

    for (let i = 0; i < subsArray.length; i++) {
      const subName = subsArray[i];
      const nodeId = `subreddit-${subName}`;

      addNode({
        id: nodeId,
        type: 'subreddit',
        position: { x: 420, y: 50 + i * 420 },
        data: {
          type: 'subreddit',
          name: subName,
          subscribers: null,
          description: null,
          posts: [],
          loading: false,
          sortBy: 'hot',
        },
      });

      if (productNode) {
        newEdges.push({
          id: `e-${productNode.id}-${nodeId}`,
          source: productNode.id,
          target: nodeId,
          animated: true,
        });
      }
    }

    setEdges(newEdges);
    setLoadingPosts(false);
    onComplete();
  }

  const riskColors = {
    low: 'bg-green-500/10 text-green-600 border-green-500/20',
    medium: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    high: 'bg-red-500/10 text-red-600 border-red-500/20',
  };

  const riskIcons = {
    low: <CheckCircle2 className="h-3.5 w-3.5" />,
    medium: <AlertTriangle className="h-3.5 w-3.5" />,
    high: <Shield className="h-3.5 w-3.5" />,
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border bg-card shadow-2xl overflow-hidden">
        {/* Progress bar */}
        <div className="flex gap-1 p-4 pb-0">
          {[0, 1, 2].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                s <= step ? 'bg-orange-500' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        <div className="p-6">
          {/* Step 0: Confirm product details */}
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold">Let&apos;s set up your campaign</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Confirm your product details. The AI uses this to find the right subreddits and generate content.
                </p>
              </div>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Product Name</Label>
                    <Input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="My Product" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">URL (optional)</Label>
                    <Input value={productUrl} onChange={(e) => setProductUrl(e.target.value)} placeholder="https://..." />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">What does it do?</Label>
                  <Textarea value={productDesc} onChange={(e) => setProductDesc(e.target.value)} placeholder="Describe your product in 2-3 sentences..." rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Target Audience</Label>
                    <Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Indie hackers, developers..." />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Tone</Label>
                    <Select value={tone} onValueChange={setTone}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TONES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={() => { setStep(1); handleFetchSuggestions(); }}
                  disabled={!productName.trim() || !productDesc.trim()}
                >
                  Find Subreddits <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 1: Subreddit suggestions */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold">Pick your target subreddits</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  AI-recommended subreddits for <strong>{productName}</strong>. Select the ones you want to target.
                </p>
              </div>

              {/* Manual entry */}
              <div className="flex gap-2">
                <Input
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddManual()}
                  placeholder="Type a subreddit name to add manually..."
                  className="text-sm"
                />
                <Button variant="outline" size="sm" onClick={handleAddManual} disabled={!manualInput.trim()}>
                  Add
                </Button>
              </div>

              {loadingSuggestions ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                  <p className="text-sm text-muted-foreground">Finding the best subreddits for your product...</p>
                </div>
              ) : suggestError && suggestions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                  <AlertTriangle className="h-8 w-8 text-yellow-500" />
                  <p className="text-sm font-medium">Couldn&apos;t fetch AI suggestions</p>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Use the input above to add subreddits manually, or click Retry to try again.
                  </p>
                  <Button variant="outline" size="sm" onClick={handleFetchSuggestions}>
                    Retry
                  </Button>
                </div>
              ) : (
                <>
                  <ScrollArea className="h-72">
                    <div className="space-y-2 pr-3">
                      {suggestions.map((sub) => {
                        const isSelected = selectedSubs.has(sub.name);
                        return (
                          <button
                            key={sub.name}
                            onClick={() => toggleSubreddit(sub.name)}
                            className={`w-full text-left rounded-xl border p-3 transition-all ${
                              isSelected
                                ? 'border-orange-500 bg-orange-500/5 ring-1 ring-orange-500/20'
                                : 'border-border hover:border-muted-foreground/30'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">r/{sub.name}</span>
                                  <Badge variant="outline" className={`text-[10px] h-5 gap-1 ${riskColors[sub.risk]}`}>
                                    {riskIcons[sub.risk]}
                                    {sub.risk} risk
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">{sub.reason}</p>
                                <p className="text-xs text-muted-foreground/70 mt-0.5 italic">{sub.approach}</p>
                              </div>
                              <div className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                                isSelected ? 'bg-orange-500 border-orange-500 text-white' : 'border-muted-foreground/30'
                              }`}>
                                {isSelected && <Check className="h-3 w-3" />}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" onClick={() => setStep(0)}>
                      <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Button>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{selectedSubs.size} selected</span>
                      <Button onClick={() => setStep(2)} disabled={selectedSubs.size === 0}>
                        Continue <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 2: Confirm & launch */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold">Ready to go!</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  We&apos;ll add these subreddits to your canvas and start loading top posts.
                </p>
              </div>

              <div className="rounded-xl border p-4 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Product</p>
                  <p className="font-medium text-sm">{productName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Target Subreddits</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {Array.from(selectedSubs).map((sub) => (
                      <Badge key={sub} variant="secondary" className="text-xs">
                        r/{sub}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Next steps on the canvas:</p>
                  <ol className="list-decimal list-inside space-y-0.5">
                    <li>Browse the top posts in each subreddit</li>
                    <li>Click &quot;Use&quot; on 2-3 posts that match the style you want</li>
                    <li>Select them (green checkboxes) and hit &quot;Generate&quot;</li>
                  </ol>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={() => setStep(1)}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button onClick={handleFinish} disabled={loadingPosts}>
                  {loadingPosts ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Launch Canvas
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
