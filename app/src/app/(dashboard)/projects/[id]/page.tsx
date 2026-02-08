'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Settings } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Canvas } from '@/components/canvas/Canvas';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { Project } from '@/types';
import Link from 'next/link';

export default function ProjectCanvasPage() {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProject();
  }, [params.id]);

  async function loadProject() {
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

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Skeleton className="h-96 w-96 rounded-xl" />
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 items-center gap-3 border-b bg-card px-4">
        <Link href="/projects">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-sm font-semibold">{project.name}</h1>
          <p className="text-xs text-muted-foreground">{project.product_name}</p>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          Auto-saving
        </span>
      </div>
      <div className="flex-1">
        <Canvas project={project} />
      </div>
    </div>
  );
}
