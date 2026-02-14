'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2, Sparkles, Plus, X, ArrowRight, ArrowLeft, Target, Radio, MessageSquare } from 'lucide-react';
import { useProject } from '@/contexts/project-context';
import { PageTransition } from '@/components/motion';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { slideHorizontalVariants } from '@/lib/motion';
import { toast } from 'sonner';

const STEPS = ['Welcome', 'Keywords', 'Competitors', 'Finish'];

export default function OutreachSetupPage() {
  const project = useProject();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const directionRef = useRef(1);

  // Step 2: Keywords
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [generatingKeywords, setGeneratingKeywords] = useState(false);

  // Step 3: Competitors
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [competitorInput, setCompetitorInput] = useState('');

  // Step 4: Username + finish
  const [redditUsername, setRedditUsername] = useState('');
  const [saving, setSaving] = useState(false);

  function goToStep(next: number) {
    directionRef.current = next > step ? 1 : -1;
    setStep(next);
  }

  async function handleGenerateKeywords() {
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
        setKeywords(json.keywords || []);
        toast.success(`Generated ${json.keywords?.length || 0} keywords`);
      }
    } catch {
      toast.error('Failed to generate keywords');
    }
    setGeneratingKeywords(false);
  }

  function addKeyword() {
    const kw = keywordInput.trim();
    if (kw && !keywords.includes(kw)) {
      setKeywords([...keywords, kw]);
      setKeywordInput('');
    }
  }

  function removeKeyword(kw: string) {
    setKeywords(keywords.filter((k) => k !== kw));
  }

  function addCompetitor() {
    const comp = competitorInput.trim();
    if (comp && !competitors.includes(comp)) {
      setCompetitors([...competitors, comp]);
      setCompetitorInput('');
    }
  }

  function removeCompetitor(comp: string) {
    setCompetitors(competitors.filter((c) => c !== comp));
  }

  async function handleFinish() {
    if (keywords.length === 0) {
      toast.error('Add at least one keyword');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/outreach/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: project.id,
          keywords,
          competitors,
          reddit_username: redditUsername || null,
        }),
      });

      const json = await res.json();
      if (json.error) {
        toast.error(json.error);
      } else {
        toast.success('Outreach setup complete!');
        router.replace(`/projects/${project.id}/outreach/signals`);
      }
    } catch {
      toast.error('Failed to save setup');
    }
    setSaving(false);
  }

  return (
    <PageTransition>
      <div className="flex h-full flex-col">
        <Header title="Outreach Setup" />
        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-2xl p-6 space-y-6">
            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2">
              {STEPS.map((label, s) => (
                <div key={label} className="flex items-center gap-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                      s === step
                        ? 'bg-primary text-primary-foreground'
                        : s < step
                          ? 'bg-primary/20 text-primary'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {s + 1}
                  </div>
                  {s < STEPS.length - 1 && (
                    <div className={`h-px w-8 ${s < step ? 'bg-primary/40' : 'bg-muted'}`} />
                  )}
                </div>
              ))}
            </div>

            <AnimatePresence mode="wait" custom={directionRef.current}>
              <motion.div
                key={step}
                custom={directionRef.current}
                variants={slideHorizontalVariants}
                initial="enter"
                animate="center"
                exit="exit"
              >
                {/* Step 0: Welcome / Intro */}
                {step === 0 && (
                  <div className="space-y-6">
                    <div className="text-center space-y-2">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                        <Target className="h-7 w-7 text-primary" />
                      </div>
                      <h2 className="text-xl font-semibold">Set up Outreach for {project.product_name}</h2>
                      <p className="text-sm text-muted-foreground max-w-md mx-auto">
                        Outreach scans Reddit for conversations where people are looking for
                        exactly what you offer — then helps you reply naturally.
                      </p>
                    </div>

                    <div className="grid gap-3">
                      <Card>
                        <CardContent className="flex items-start gap-3 p-4">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                            <Radio className="h-4 w-4 text-blue-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">Find signals</p>
                            <p className="text-xs text-muted-foreground">
                              We search your target subreddits for posts matching your keywords — questions,
                              comparisons, and pain points where {project.product_name} is relevant.
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="flex items-start gap-3 p-4">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
                            <Sparkles className="h-4 w-4 text-purple-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">AI scores & classifies</p>
                            <p className="text-xs text-muted-foreground">
                              Each signal gets an intent score and type (question, comparison, problem) so
                              you focus on the highest-value conversations first.
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="flex items-start gap-3 p-4">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-500/10">
                            <MessageSquare className="h-4 w-4 text-green-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">Draft & reply</p>
                            <p className="text-xs text-muted-foreground">
                              Generate authentic replies that mention your product naturally, respect
                              subreddit rules, and sound like a real person — not a marketer.
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <p className="text-center text-xs text-muted-foreground">
                      Takes about 1 minute to set up. We&apos;ll use your existing product info to get started.
                    </p>

                    <div className="flex justify-center">
                      <Button onClick={() => goToStep(1)} size="lg">
                        Get Started
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 1: Keywords */}
                {step === 1 && (
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-lg font-semibold">Search Keywords</h2>
                      <p className="text-sm text-muted-foreground">
                        These keywords are used to find Reddit posts where someone might need {project.product_name}.
                        Think pain points, questions, and &quot;looking for&quot; phrases.
                      </p>
                    </div>

                    <Button
                      onClick={handleGenerateKeywords}
                      disabled={generatingKeywords}
                      className="w-full"
                    >
                      {generatingKeywords ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                      )}
                      {generatingKeywords
                        ? 'Generating...'
                        : keywords.length > 0
                          ? 'Regenerate Keywords'
                          : 'Auto-Generate Keywords from Your Product'}
                    </Button>

                    <div className="flex gap-2">
                      <Input
                        value={keywordInput}
                        onChange={(e) => setKeywordInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
                        placeholder="Or add manually, e.g. &quot;best tool for...&quot;"
                      />
                      <Button variant="outline" onClick={addKeyword}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    {keywords.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {keywords.map((kw) => (
                          <Badge key={kw} variant="secondary" className="gap-1 pr-1">
                            {kw}
                            <button
                              onClick={() => removeKeyword(kw)}
                              className="ml-1 rounded-full p-0.5 hover:bg-muted"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex justify-between">
                      <Button variant="outline" onClick={() => goToStep(0)}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                      </Button>
                      <Button onClick={() => goToStep(2)} disabled={keywords.length === 0}>
                        Next
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 2: Competitors */}
                {step === 2 && (
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-lg font-semibold">Competitors (optional)</h2>
                      <p className="text-sm text-muted-foreground">
                        When someone mentions a competitor by name, that signal gets flagged — great
                        opportunities to suggest {project.product_name} as an alternative.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Input
                        value={competitorInput}
                        onChange={(e) => setCompetitorInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addCompetitor()}
                        placeholder="e.g. Competitor Inc, RivalApp"
                      />
                      <Button variant="outline" onClick={addCompetitor}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    {competitors.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {competitors.map((comp) => (
                          <Badge key={comp} variant="secondary" className="gap-1 pr-1">
                            {comp}
                            <button
                              onClick={() => removeCompetitor(comp)}
                              className="ml-1 rounded-full p-0.5 hover:bg-muted"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex justify-between">
                      <Button variant="outline" onClick={() => goToStep(1)}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                      </Button>
                      <Button onClick={() => goToStep(3)}>
                        {competitors.length === 0 ? 'Skip' : 'Next'}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 3: Username + Finish */}
                {step === 3 && (
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-lg font-semibold">Almost done</h2>
                      <p className="text-sm text-muted-foreground">
                        Add your Reddit username so we can track replies you post.
                      </p>
                    </div>

                    <Input
                      value={redditUsername}
                      onChange={(e) => setRedditUsername(e.target.value)}
                      placeholder="u/your_username"
                    />

                    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                      <h3 className="font-medium text-sm">Setup Summary</h3>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p><span className="font-medium text-foreground">{keywords.length}</span> keywords to search for</p>
                        <p><span className="font-medium text-foreground">{competitors.length}</span> competitors to watch</p>
                        {redditUsername && <p>Tracking as <span className="font-medium text-foreground">u/{redditUsername}</span></p>}
                      </div>
                    </div>

                    <div className="flex justify-between">
                      <Button variant="outline" onClick={() => goToStep(2)}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                      </Button>
                      <Button onClick={handleFinish} disabled={saving || !redditUsername.trim()}>
                        {saving ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="mr-2 h-4 w-4" />
                        )}
                        {saving ? 'Setting up...' : 'Start Finding Signals'}
                      </Button>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
