'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import { motion } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PlanProgressProps {
  projectId: string;
  hasSubreddits: boolean;
  hasResearch: boolean;
  hasDrafts: boolean;
  hasEdited: boolean;
  hasPublished: boolean;
}

const STEPS = [
  { label: 'Set up your product', ctaLabel: '', ctaPath: '' },
  { label: 'Add target subreddits', ctaLabel: 'Go to Canvas', ctaPath: '/canvas' },
  { label: 'Research inspiration posts', ctaLabel: 'Go to Inspiration', ctaPath: '/inspiration' },
  { label: 'Generate draft posts', ctaLabel: 'Go to Canvas', ctaPath: '/canvas' },
  { label: 'Refine your drafts', ctaLabel: 'Go to Canvas', ctaPath: '/canvas' },
  { label: 'Publish to Reddit', ctaLabel: 'Go to Canvas', ctaPath: '/canvas' },
];

export function PlanProgress({
  projectId,
  hasSubreddits,
  hasResearch,
  hasDrafts,
  hasEdited,
  hasPublished,
}: PlanProgressProps) {
  const completions = [true, hasSubreddits, hasResearch, hasDrafts, hasEdited, hasPublished];

  // Current step is the first incomplete step
  let currentStep = completions.findIndex((c) => !c);
  if (currentStep === -1) currentStep = STEPS.length; // all complete

  const base = `/projects/${projectId}`;

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="pb-0">
        <CardTitle className="text-sm">Your Reddit Marketing Plan</CardTitle>
      </CardHeader>
      <CardContent>
        <nav>
          {STEPS.map((step, i) => {
            const isCompleted = i < currentStep;
            const isCurrent = i === currentStep;

            return (
              <div key={step.label} className="flex items-center gap-3 py-1.5">
                <div className="relative flex h-6 w-6 shrink-0 items-center justify-center">
                  {isCompleted ? (
                    <motion.div
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-white"
                    >
                      <Check className="h-3 w-3" />
                    </motion.div>
                  ) : (
                    <div
                      className={`h-6 w-6 rounded-full border-2 transition-colors ${
                        isCurrent
                          ? 'border-orange-500 bg-orange-500/10'
                          : 'border-muted-foreground/20'
                      }`}
                    >
                      {isCurrent && (
                        <motion.div
                          layoutId="plan-step-dot"
                          className="absolute inset-[5px] rounded-full bg-orange-500"
                        />
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-1 items-center justify-between gap-2">
                  <span
                    className={`text-sm transition-colors ${
                      isCurrent
                        ? 'font-medium text-foreground'
                        : isCompleted
                          ? 'text-muted-foreground'
                          : 'text-muted-foreground/50'
                    }`}
                  >
                    {step.label}
                  </span>
                  {isCurrent && step.ctaPath && (
                    <Link
                      href={`${base}${step.ctaPath}`}
                      className="shrink-0 rounded-md bg-orange-500 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-orange-600"
                    >
                      {step.ctaLabel}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </nav>
      </CardContent>
    </Card>
  );
}
