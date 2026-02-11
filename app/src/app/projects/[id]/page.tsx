'use client';

import { useProject } from '@/contexts/project-context';
import { Canvas } from '@/components/canvas/Canvas';
import { FadeIn } from '@/components/motion';

export default function ProjectCanvasPage() {
  const project = useProject();

  return (
    <FadeIn className="flex h-full flex-col">
      <div className="flex h-12 items-center gap-3 border-b bg-card px-4">
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
    </FadeIn>
  );
}
