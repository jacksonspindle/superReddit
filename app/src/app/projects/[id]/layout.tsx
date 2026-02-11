'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ProjectProvider } from '@/contexts/project-context';
import { ProjectSidebar } from '@/components/layout/project-sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import type { Project } from '@/types';

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', params.id)
        .single();

      if (error || !data) {
        router.push('/projects');
        return;
      }

      setProject(data);
      setLoading(false);
    }
    load();
  }, [params.id, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Skeleton className="h-96 w-96 rounded-xl" />
      </div>
    );
  }

  if (!project) return null;

  return (
    <ProjectProvider project={project}>
      <div className="flex h-screen overflow-hidden">
        <ProjectSidebar project={project} />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </ProjectProvider>
  );
}
