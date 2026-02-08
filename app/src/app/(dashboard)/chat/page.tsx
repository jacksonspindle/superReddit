'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Header } from '@/components/layout/header';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Project } from '@/types';

export default function ChatPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('none');
  const supabase = createClient();

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .order('updated_at', { ascending: false });
    setProjects(data || []);
  }

  const selectedProject = projects.find((p) => p.id === selectedProjectId) || null;

  return (
    <div className="flex h-full flex-col">
      <Header title="AI Chat" />
      <div className="border-b px-6 py-2">
        <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
          <SelectTrigger className="w-64 h-8 text-xs">
            <SelectValue placeholder="Select a project for context..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No project context</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name} — {p.product_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex-1">
        <ChatInterface project={selectedProject} />
      </div>
    </div>
  );
}
