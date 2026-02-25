'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { createClient } from '@/lib/supabase/client';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import {
  OnboardingSidebar,
  ProductStep,
  SubredditsStep,
  CompletionStep,
} from '@/components/onboarding';
import type { AddedSubreddit } from '@/components/onboarding';
import type { SuggestedSubreddit } from '@/lib/ai/prompts';
import { slideHorizontalVariants } from '@/lib/motion';

const NEW_PROJECT_STEPS = [
  { label: 'Your Product' },
  { label: 'Subreddits' },
  { label: 'All Set' },
];

export default function NewProjectPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState(0);
  const directionRef = useRef(1);
  const [userName, setUserName] = useState('');
  const [finishing, setFinishing] = useState(false);

  // Product fields
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productUrl, setProductUrl] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [redditUsername, setRedditUsername] = useState('');

  // Subreddits
  const [addedSubreddits, setAddedSubreddits] = useState<AddedSubreddit[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<SuggestedSubreddit[]>([]);
  const [aiFetched, setAiFetched] = useState(false);
  const selectedSubreddits = new Set(addedSubreddits.map((s) => s.name));

  // GitHub repo (selected during ProductStep)
  const [selectedRepoUrl, setSelectedRepoUrl] = useState<string | null>(null);
  const [githubAccessToken, setGithubAccessToken] = useState<string | null>(null);

  const tone = 'Adaptive';

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
          // Ensure the token is stored for this project first
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
          // Non-critical — project was still created
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

      // 7. Redirect to the new project
      router.replace(`/projects/${project.id}`);
    } catch (err) {
      console.error('New project finish error:', err);
      toast.error('Something went wrong. Please try again.');
      setFinishing(false);
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <OnboardingSidebar currentStep={step} steps={NEW_PROJECT_STEPS} onCancel={() => router.push('/projects')} />

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
                onNext={() => goToStep(1)}
              />
            )}
            {step === 1 && (
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
                onBack={() => goToStep(0)}
                onNext={() => goToStep(2)}
              />
            )}
            {step === 2 && (
              <CompletionStep
                userName={userName}
                productName={productName}
                selectedSubreddits={selectedSubreddits}
                loading={finishing}
                onBack={() => goToStep(1)}
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
