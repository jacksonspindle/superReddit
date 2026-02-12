'use client';

import { useProject } from '@/contexts/project-context';
import { Header } from '@/components/layout/header';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { PageTransition } from '@/components/motion';

const WRITER_PROMPTS = [
  'Write me a Reddit post promoting my product',
  'Draft a "I built this" showcase post',
  'Write a post that shares value first, then mentions my product',
  'Help me write a post for r/SaaS about my product',
];

export default function AIWriterPage() {
  const project = useProject();

  return (
    <PageTransition>
      <div className="flex h-full flex-col">
        <Header title="AI Writer" />
        <div className="flex-1">
          <ChatInterface
            project={project}
            apiEndpoint="/api/ai/writer"
            placeholder="Describe the post you want to write..."
            suggestedPrompts={WRITER_PROMPTS}
            emptyTitle="AI Writer"
            emptyDescription="Your Reddit ghostwriter. Describe what you want to post and I'll draft it for you — matching the right tone, style, and subreddit culture."
          />
        </div>
      </div>
    </PageTransition>
  );
}
