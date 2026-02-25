'use client';

import { ArrowLeft, Loader2, Megaphone, MessageSquare, Target, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';

interface CompletionStepProps {
  userName: string;
  productName: string;
  selectedSubreddits: Set<string>;
  loading: boolean;
  onBack: () => void;
  onFinish: () => void;
}

export function CompletionStep({
  userName,
  productName,
  selectedSubreddits,
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
          You&apos;re ready to find your first users, {firstName}.
        </h2>
      </motion.div>

      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.25, duration: 0.4 }}
        className="mt-3"
      >
        <p className="text-base text-muted-foreground leading-relaxed">
          Every day, people in {selectedSubreddits.size === 1 ? 'this subreddit' : `these ${selectedSubreddits.size} subreddits`} are
          asking for exactly what <span className="font-medium text-foreground">{productName}</span> does.
          SuperReddit helps you show up in those conversations with posts that feel native,
          drive clicks, and turn Redditors into users.
        </p>
      </motion.div>

      {/* Value props */}
      <motion.div
        initial={{ y: 15, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="mt-8 grid grid-cols-3 gap-3"
      >
        <div className="rounded-xl border bg-card p-4">
          <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/10">
            <Target className="h-4.5 w-4.5 text-orange-500" />
          </div>
          <p className="text-2xl font-bold">{selectedSubreddits.size}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {selectedSubreddits.size === 1 ? 'Community' : 'Communities'}
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10">
            <TrendingUp className="h-4.5 w-4.5 text-green-500" />
          </div>
          <p className="text-2xl font-bold">AI</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Post Generation
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
            <MessageSquare className="h-4.5 w-4.5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold">DM</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Outreach
          </p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55, duration: 0.4 }}
        className="mt-6 space-y-2 text-sm text-muted-foreground text-left"
      >
        <p className="flex items-start gap-2">
          <span className="mt-0.5 text-orange-500">&#10003;</span>
          Generate Reddit posts tailored to each subreddit&apos;s tone and rules
        </p>
        <p className="flex items-start gap-2">
          <span className="mt-0.5 text-orange-500">&#10003;</span>
          Reach high-intent users already searching for solutions like yours
        </p>
        <p className="flex items-start gap-2">
          <span className="mt-0.5 text-orange-500">&#10003;</span>
          Auto-DM interested Redditors to convert engagement into leads
        </p>
      </motion.div>

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
          Start Getting Leads
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
