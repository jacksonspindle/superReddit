'use client';

import { useProject } from '@/contexts/project-context';
import { Header } from '@/components/layout/header';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { PageTransition } from '@/components/motion';

export default function ProjectChatPage() {
  const project = useProject();

  return (
    <PageTransition>
      <div className="flex h-full flex-col">
        <Header title="AI Chat" />
        <div className="flex-1">
          <ChatInterface project={project} />
        </div>
      </div>
    </PageTransition>
  );
}
