'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { createClient } from '@/lib/supabase/client';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import {
  OnboardingSidebar,
  WelcomeStep,
  ProductStep,
  SubredditsStep,
  CompletionStep,
} from '@/components/onboarding';
import type { AddedSubreddit } from '@/components/onboarding';
import type { SuggestedSubreddit } from '@/lib/ai/prompts';
import { slideHorizontalVariants } from '@/lib/motion';

const STORAGE_KEY = 'sr_onboarding_state';

interface OnboardingState {
  step: number;
  productName: string;
  productDescription: string;
  productUrl: string;
  targetAudience: string;
  redditUsername: string;
  addedSubreddits: AddedSubreddit[];
  aiSuggestions: SuggestedSubreddit[];
  aiFetched: boolean;
  selectedRepoUrl: string | null;
  githubAccessToken: string | null;
}

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const hydrated = useRef(false);
  const directionRef = useRef(1);
  const [userName, setUserName] = useState('');
  const [finishing, setFinishing] = useState(false);

  const [step, setStep] = useState(0);
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productUrl, setProductUrl] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [redditUsername, setRedditUsername] = useState('');
  const [addedSubreddits, setAddedSubreddits] = useState<AddedSubreddit[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<SuggestedSubreddit[]>([]);
  const [aiFetched, setAiFetched] = useState(false);
  const selectedSubreddits = new Set(addedSubreddits.map((s) => s.name));
  const [selectedRepoUrl, setSelectedRepoUrl] = useState<string | null>(null);
  const [githubAccessToken, setGithubAccessToken] = useState<string | null>(null);

  const tone = 'Adaptive';

  // Restore from sessionStorage after mount (avoids hydration mismatch)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved: Partial<OnboardingState> = JSON.parse(raw);
        if (saved.step != null) setStep(saved.step);
        if (saved.productName != null) setProductName(saved.productName);
        if (saved.productDescription != null) setProductDescription(saved.productDescription);
        if (saved.productUrl != null) setProductUrl(saved.productUrl);
        if (saved.targetAudience != null) setTargetAudience(saved.targetAudience);
        if (saved.redditUsername != null) setRedditUsername(saved.redditUsername);
        if (saved.addedSubreddits != null) setAddedSubreddits(saved.addedSubreddits);
        if (saved.aiSuggestions != null) setAiSuggestions(saved.aiSuggestions);
        if (saved.aiFetched != null) setAiFetched(saved.aiFetched);
        if (saved.selectedRepoUrl !== undefined) setSelectedRepoUrl(saved.selectedRepoUrl);
        if (saved.githubAccessToken !== undefined) setGithubAccessToken(saved.githubAccessToken);
      }
    } catch { /* ok */ }
    hydrated.current = true;
  }, []);

  // Persist state to sessionStorage on every change (skip until hydrated)
  const persist = useCallback(() => {
    if (!hydrated.current) return;
    const state: OnboardingState = {
      step, productName, productDescription, productUrl, targetAudience,
      redditUsername, addedSubreddits, aiSuggestions, aiFetched,
      selectedRepoUrl, githubAccessToken,
    };
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* quota */ }
  }, [step, productName, productDescription, productUrl, targetAudience,
      redditUsername, addedSubreddits, aiSuggestions, aiFetched,
      selectedRepoUrl, githubAccessToken]);

  useEffect(() => { persist(); }, [persist]);

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace('/login');
      return;
    }
    setUserName(user.user_metadata?.full_name || user.email || '');
  }

  function goToStep(next: number) {
    directionRef.current = next > step ? 1 : -1;
    setStep(next);
  }

  async function handleFinish() {
    setFinishing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Not authenticated');
        setFinishing(false);
        return;
      }

      // 1. Create the project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          user_id: user.id,
          name: `${productName} Campaign`,
          product_name: productName,
          product_description: productDescription,
          product_url: productUrl || null,
          target_audience: targetAudience || null,
          tone,
          writing_styles: [],
        })
        .select()
        .single();

      if (projectError || !project) {
        toast.error('Failed to create project');
        setFinishing(false);
        return;
      }

      // 2. Build canvas state with product node + subreddit nodes + edges
      const productNodeId = 'product-node';
      const subsArray = Array.from(selectedSubreddits);

      const nodes = [
        {
          id: productNodeId,
          type: 'product',
          position: { x: 0, y: Math.max(0, (subsArray.length * 420 - 300) / 2) },
          data: {
            type: 'product',
            name: productName,
            description: productDescription,
            url: productUrl || '',
            audience: targetAudience || '',
            tone,
            writingStyles: [],
          },
        },
        ...subsArray.map((subName, i) => ({
          id: `subreddit-${subName}`,
          type: 'subreddit',
          position: { x: 420, y: i * 420 },
          data: {
            type: 'subreddit',
            name: subName,
            subscribers: null,
            description: null,
            posts: [],
            loading: false,
            sortBy: 'hot',
          },
        })),
      ];

      const edges = subsArray.map((subName) => ({
        id: `e-${productNodeId}-subreddit-${subName}`,
        source: productNodeId,
        target: `subreddit-${subName}`,
        animated: true,
      }));

      // 3. Save canvas state
      const { error: canvasError } = await supabase.from('canvas_states').insert({
        project_id: project.id,
        nodes,
        edges,
        viewport: { x: 0, y: 0, zoom: 0.8 },
      });

      if (canvasError) {
        console.error('Canvas save error:', canvasError);
        // Non-fatal — project was created, canvas will init on load
      }

      // 4. Add subreddits to the subreddits table
      if (subsArray.length > 0) {
        await supabase.from('subreddits').insert(
          subsArray.map((name) => ({
            project_id: project.id,
            name,
          }))
        );
      }

      // 5. Connect GitHub repo if one was selected
      if (selectedRepoUrl) {
        try {
          if (githubAccessToken) {
            await supabase.from('github_connections').upsert({
              project_id: project.id,
              access_token: githubAccessToken,
              repo_url: '',
              owner: '',
              repo_name: '',
            }, { onConflict: 'project_id' });
          }
          await fetch('/api/context/github/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId: project.id, repoUrl: selectedRepoUrl }),
          });
        } catch {
          // Non-critical
        }
      }

      // 6. Save Reddit username to outreach config if provided
      if (redditUsername.trim()) {
        try {
          await fetch('/api/outreach/config', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              project_id: project.id,
              reddit_username: redditUsername.replace(/^\/?u\//, '').trim(),
            }),
          });
        } catch {
          // Non-critical — user can set it later in Context > Profile
        }
      }

      // 7. Mark onboarding complete
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', user.id);

      if (profileError) {
        console.error('Profile update error:', profileError);
      }

      // 8. Clear saved onboarding state and redirect
      try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ok */ }
      router.replace(`/projects/${project.id}`);
    } catch (err) {
      console.error('Onboarding finish error:', err);
      toast.error('Something went wrong. Please try again.');
      setFinishing(false);
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <OnboardingSidebar currentStep={step} onCancel={() => router.push('/projects')} />

      <main className="flex flex-1 justify-center overflow-y-auto p-8">
        <AnimatePresence mode="wait" custom={directionRef.current}>
          <motion.div
            key={step}
            custom={directionRef.current}
            variants={slideHorizontalVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="my-auto w-full max-w-2xl"
          >
            {step === 0 && (
              <WelcomeStep userName={userName} onNext={() => goToStep(1)} />
            )}
            {step === 1 && (
              <ProductStep
                productName={productName}
                productDescription={productDescription}
                productUrl={productUrl}
                targetAudience={targetAudience}
                redditUsername={redditUsername}
                onProductNameChange={setProductName}
                onProductDescriptionChange={setProductDescription}
                onProductUrlChange={setProductUrl}
                onTargetAudienceChange={setTargetAudience}
                onRedditUsernameChange={setRedditUsername}
                onRepoSelected={(url, token) => {
                  setSelectedRepoUrl(url);
                  setGithubAccessToken(token);
                }}
                onNext={() => goToStep(2)}
              />
            )}
            {step === 2 && (
              <SubredditsStep
                productName={productName}
                productDescription={productDescription}
                productUrl={productUrl}
                targetAudience={targetAudience}
                tone={tone}
                addedSubs={addedSubreddits}
                onAddedSubsChange={setAddedSubreddits}
                aiSuggestions={aiSuggestions}
                onAiSuggestionsChange={setAiSuggestions}
                aiFetched={aiFetched}
                onAiFetchedChange={setAiFetched}
                onBack={() => goToStep(1)}
                onNext={() => goToStep(3)}
              />
            )}
            {step === 3 && (
              <CompletionStep
                userName={userName}
                productName={productName}
                selectedSubreddits={selectedSubreddits}
                addedSubreddits={addedSubreddits}
                loading={finishing}
                onBack={() => goToStep(2)}
                onFinish={handleFinish}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <Toaster />
    </div>
  );
}
