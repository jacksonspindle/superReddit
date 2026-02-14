'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProject } from '@/contexts/project-context';

export default function OutreachPage() {
  const project = useProject();
  const router = useRouter();

  // Layout already verified setup is complete, so go straight to signals
  useEffect(() => {
    router.replace(`/projects/${project.id}/outreach/signals`);
  }, [project.id, router]);

  return null;
}
