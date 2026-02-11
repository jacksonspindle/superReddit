'use client';

import { Check } from 'lucide-react';
import { motion } from 'motion/react';

const STEPS = [
  { label: 'Welcome' },
  { label: 'Your Product' },
  { label: 'Subreddits' },
  { label: 'Writing DNA' },
  { label: 'All Set' },
];

interface OnboardingSidebarProps {
  currentStep: number;
}

export function OnboardingSidebar({ currentStep }: OnboardingSidebarProps) {
  return (
    <div className="flex w-60 flex-col justify-between border-r bg-card p-8">
      <div>
        <div className="mb-10 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500 text-white font-bold text-sm">
            SR
          </div>
          <span className="font-semibold">SuperReddit</span>
        </div>

        <nav className="space-y-1">
          {STEPS.map((step, i) => {
            const isCompleted = i < currentStep;
            const isCurrent = i === currentStep;

            return (
              <div key={step.label} className="flex items-center gap-3 py-2.5">
                <div className="relative flex h-7 w-7 shrink-0 items-center justify-center">
                  {isCompleted ? (
                    <motion.div
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-white"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </motion.div>
                  ) : (
                    <div
                      className={`h-7 w-7 rounded-full border-2 transition-colors ${
                        isCurrent
                          ? 'border-orange-500 bg-orange-500/10'
                          : 'border-muted-foreground/20'
                      }`}
                    >
                      {isCurrent && (
                        <motion.div
                          layoutId="step-dot"
                          className="absolute inset-[6px] rounded-full bg-orange-500"
                        />
                      )}
                    </div>
                  )}
                </div>
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
              </div>
            );
          })}
        </nav>
      </div>

      <p className="text-xs text-muted-foreground/50">
        You can always change these settings later.
      </p>
    </div>
  );
}
