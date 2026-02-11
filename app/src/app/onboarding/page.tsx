'use client';

import { useEffect, useRef, useState } from 'react';
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
  ToneStep,
  CompletionStep,
} from '@/components/onboarding';
import type { AddedSubreddit } from '@/components/onboarding';
import type { SuggestedSubreddit } from '@/lib/ai/prompts';
import { slideHorizontalVariants } from '@/lib/motion';

export default function OnboardingPage() {
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

  // Subreddits (lifted from SubredditsStep for persistence)
  const [addedSubreddits, setAddedSubreddits] = useState<AddedSubreddit[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<SuggestedSubreddit[]>([]);
  const [aiFetched, setAiFetched] = useState(false);
  const selectedSubreddits = new Set(addedSubreddits.map((s) => s.name));

  // Writing style
  const [likedStyles, setLikedStyles] = useState<Set<string>>(new Set());
  const [toneCompleted, setToneCompleted] = useState(false);
  const tone = 'Adaptive'; // Derived from liked styles at generation time

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
      const writingStylesArray = Array.from(likedStyles);
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
          writing_styles: writingStylesArray,
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
            writingStyles: writingStylesArray,
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

      // 5. Mark onboarding complete
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', user.id);

      if (profileError) {
        console.error('Profile update error:', profileError);
      }

      // 6. Redirect to the new project canvas
      router.replace(`/projects/${project.id}`);
    } catch (err) {
      console.error('Onboarding finish error:', err);
      toast.error('Something went wrong. Please try again.');
      setFinishing(false);
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <OnboardingSidebar currentStep={step} />

      <main className="flex flex-1 items-center justify-center overflow-y-auto p-8">
        <AnimatePresence mode="wait" custom={directionRef.current}>
          <motion.div
            key={step}
            custom={directionRef.current}
            variants={slideHorizontalVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="w-full max-w-2xl"
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
                onProductNameChange={setProductName}
                onProductDescriptionChange={setProductDescription}
                onProductUrlChange={setProductUrl}
                onTargetAudienceChange={setTargetAudience}
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
              <ToneStep
                likedStyles={likedStyles}
                onLikedStylesChange={setLikedStyles}
                completed={toneCompleted}
                onComplete={() => setToneCompleted(true)}
                onReset={() => {
                  setToneCompleted(false);
                  setLikedStyles(new Set());
                }}
                onBack={() => goToStep(2)}
                onNext={() => goToStep(4)}
              />
            )}
            {step === 4 && (
              <CompletionStep
                userName={userName}
                productName={productName}
                selectedSubreddits={selectedSubreddits}
                likedStyles={likedStyles}
                loading={finishing}
                onBack={() => goToStep(3)}
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
