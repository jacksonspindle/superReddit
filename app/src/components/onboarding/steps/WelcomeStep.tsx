'use client';

import { ArrowRight, Sparkles, Target, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { staggerContainerVariants, staggerItemVariants } from '@/lib/motion';

interface WelcomeStepProps {
  userName: string;
  onNext: () => void;
}

export function WelcomeStep({ userName, onNext }: WelcomeStepProps) {
  const firstName = userName?.split(' ')[0] || 'there';

  return (
    <div className="flex flex-col items-center justify-center text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500 text-white"
      >
        <Sparkles className="h-8 w-8" />
      </motion.div>

      <h1 className="text-3xl font-bold tracking-tight">
        Welcome, {firstName}!
      </h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        Let&apos;s set up your first Reddit marketing campaign. This takes about 2 minutes
        and everything you share helps the AI find better communities and write more authentic content for you.
      </p>

      <motion.div
        variants={staggerContainerVariants}
        initial="hidden"
        animate="visible"
        className="mt-8 grid w-full max-w-md gap-3"
      >
        {[
          {
            icon: Target,
            text: 'Describe your product',
            sub: 'The more specific you are, the better the AI can match you to subreddits where your audience actually hangs out.',
          },
          {
            icon: Sparkles,
            text: 'AI finds your best subreddits',
            sub: 'Your product details directly shape which communities get recommended \u2014 vague descriptions lead to generic results.',
          },
          {
            icon: Zap,
            text: 'Start creating content instantly',
            sub: 'With the right context, generated posts sound authentic to each community instead of like a copy-paste ad.',
          },
        ].map(({ icon: Icon, text, sub }) => (
          <motion.div
            key={text}
            variants={staggerItemVariants}
            className="flex items-start gap-3 rounded-xl border bg-card p-3.5 text-left"
          >
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-500/10">
              <Icon className="h-4 w-4 text-orange-500" />
            </div>
            <div>
              <span className="text-sm font-medium">{text}</span>
              <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{sub}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <Button onClick={onNext} size="lg" className="mt-8">
        Get Started <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}
