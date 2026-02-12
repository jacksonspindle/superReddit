'use client';

import { Header } from '@/components/layout/header';
import { PageTransition } from '@/components/motion/PageTransition';

export default function AIWriterPage() {
  return (
    <PageTransition>
      <Header title="AI Writer" />
      <div className="flex flex-1 items-center justify-center p-12">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Coming Soon</h2>
          <p className="mt-2 text-muted-foreground">
            AI Writer is under development. Check back soon!
          </p>
        </div>
      </div>
    </PageTransition>
  );
}
