'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2, Target, ArrowRight, SkipForward } from 'lucide-react';
import { useProject } from '@/contexts/project-context';
import { Button } from '@/components/ui/button';

export default function OutreachLayout({ children }: { children: React.ReactNode }) {
  const project = useProject();
  const pathname = usePathname();
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [setupDone, setSetupDone] = useState(false);
  const [skipped, setSkipped] = useState(false);

  const isSetupPage = pathname.endsWith('/setup');

  useEffect(() => {
    // Don't gate the setup page itself
    if (isSetupPage) {
      setChecking(false);
      return;
    }

    let cancelled = false;

    async function check() {
      try {
        const res = await fetch(`/api/outreach/config?project_id=${project.id}`);
        const json = await res.json();
        if (!cancelled) {
          setSetupDone(json.config?.setup_completed === true);
        }
      } catch {
        // If API fails (e.g. DB tables missing), allow skip
        if (!cancelled) setSetupDone(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    check();
    return () => { cancelled = true; };
  }, [project.id, isSetupPage]);

  // Setup page always renders directly
  if (isSetupPage) return <>{children}</>;

  // Loading state
  if (checking) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Setup complete or user skipped — render the page
  if (setupDone || skipped) return <>{children}</>;

  // Setup not complete — show prompt with skip option
  return (
    <div className="flex h-full items-center justify-center">
      <div className="max-w-sm space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Target className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">Set up Outreach</h2>
        <p className="text-sm text-muted-foreground">
          Configure keywords and competitors so we can find the right Reddit conversations for {project.product_name}.
        </p>
        <div className="flex flex-col gap-2">
          <Button onClick={() => router.push(`/projects/${project.id}/outreach/setup`)}>
            Start Setup
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSkipped(true)}>
            <SkipForward className="mr-1.5 h-3.5 w-3.5" />
            Skip for now
          </Button>
        </div>
      </div>
    </div>
  );
}
