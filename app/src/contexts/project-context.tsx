'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Project } from '@/types';

interface ProjectContextValue {
  project: Project;
  refreshProject: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({
  project: initialProject,
  children,
}: {
  project: Project;
  children: React.ReactNode;
}) {
  const [project, setProject] = useState<Project>(initialProject);

  const refreshProject = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('id', project.id)
      .single();
    if (data) setProject(data);
  }, [project.id]);

  return (
    <ProjectContext.Provider value={{ project, refreshProject }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return ctx;
}
