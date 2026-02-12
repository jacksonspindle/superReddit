'use client';

import { Header } from '@/components/layout/header';
import { PageTransition } from '@/components/motion/PageTransition';

export default function DailyMixPage() {
  return (
    <PageTransition>
      <Header title="Daily Mix" />
      <div className="flex flex-1 items-center justify-center p-12">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Coming Soon</h2>
          <p className="mt-2 text-muted-foreground">
            Daily Mix is under development. Check back soon!
          </p>
        </div>
      </div>
    </PageTransition>
  );
}
