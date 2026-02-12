'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useProject } from '@/contexts/project-context';

export default function AIWriterPage() {
  const project = useProject();
  const router = useRouter();

  // Redirect to AI Chat — AI Writer was merged into it
  useEffect(() => {
    router.replace(`/projects/${project.id}/chat`);
  }, [project.id, router]);

  return null;
}
