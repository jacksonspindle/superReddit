'use client';

import { TrendingDown } from 'lucide-react';
import { useProject } from '@/contexts/project-context';
import { PageTransition } from '@/components/motion';
import { Header } from '@/components/layout/header';

export default function DmChurnPage() {
  useProject();

  return (
    <PageTransition>
      <div className="flex h-full flex-col">
        <Header title="DM Churn" />
        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-4xl p-6">
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <TrendingDown className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Churn Tracking</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Monitor dropped leads, identify churn patterns, and recover lost opportunities. Coming soon.
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
