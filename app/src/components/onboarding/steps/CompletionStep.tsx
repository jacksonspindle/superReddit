'use client';

import { ArrowLeft, Loader2, Megaphone, Target, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';

interface CompletionStepProps {
  userName: string;
  productName: string;
  selectedSubreddits: Set<string>;
  likedStyles: Set<string>;
  loading: boolean;
  onBack: () => void;
  onFinish: () => void;
}

export function CompletionStep({
  userName,
  productName,
  selectedSubreddits,
  likedStyles,
  loading,
  onBack,
  onFinish,
}: CompletionStepProps) {
  const firstName = userName.split(' ')[0] || userName;

  return (
    <div className="w-full max-w-lg mx-auto text-center">
      {/* Avatar */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-orange-500 text-white text-2xl font-bold"
      >
        {firstName.charAt(0).toUpperCase()}
      </motion.div>

      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.4 }}
      >
        <h2 className="text-2xl font-bold tracking-tight">
          Hey {firstName}!
        </h2>
      </motion.div>

      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.25, duration: 0.4 }}
        className="mt-3 space-y-3"
      >
        <p className="text-base text-muted-foreground leading-relaxed">
          You&apos;re all set up and ready to grow. This is just the beginning of
          your journey to reaching the right people on Reddit.
        </p>
      </motion.div>

      {/* Stats / what they set up */}
      <motion.div
        initial={{ y: 15, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="mt-8 grid grid-cols-3 gap-3"
      >
        <div className="rounded-xl border bg-card p-4">
          <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/10">
            <Megaphone className="h-4.5 w-4.5 text-orange-500" />
          </div>
          <p className="text-2xl font-bold">{selectedSubreddits.size}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {selectedSubreddits.size === 1 ? 'Subreddit' : 'Subreddits'}
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/10">
            <Target className="h-4.5 w-4.5 text-purple-500" />
          </div>
          <p className="text-2xl font-bold">{likedStyles.size}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Writing {likedStyles.size === 1 ? 'Style' : 'Styles'}
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10">
            <TrendingUp className="h-4.5 w-4.5 text-green-500" />
          </div>
          <p className="text-2xl font-bold">AI</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Powered Posts
          </p>
        </div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55, duration: 0.4 }}
        className="mt-6 text-sm text-muted-foreground"
      >
        We&apos;ll help you craft authentic posts for <span className="font-medium text-foreground">{productName}</span> that
        blend into each community naturally.
      </motion.p>

      {/* CTA */}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.65, duration: 0.4 }}
        className="mt-8"
      >
        <Button
          onClick={onFinish}
          size="lg"
          disabled={loading}
          className="w-full h-12 text-base bg-orange-500 hover:bg-orange-600 text-white rounded-xl"
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Start Growing on Reddit
        </Button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.75, duration: 0.3 }}
        className="mt-4"
      >
        <Button variant="ghost" size="sm" onClick={onBack} disabled={loading} className="text-xs text-muted-foreground">
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Go back
        </Button>
      </motion.div>
    </div>
  );
}
