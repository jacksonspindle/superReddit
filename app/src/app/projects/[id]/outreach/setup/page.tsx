'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProject } from '@/contexts/project-context';

export default function OutreachSetupPage() {
  const { project } = useProject();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/projects/${project.id}/context/profile`);
  }, [project.id, router]);

  return null;
}
