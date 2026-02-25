'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { SearchAction } from '@/stores/create-store';
import type { SuggestedPrompt, ChatInterfaceHandle, SearchResultPost } from '@/components/chat/ChatInterface';
import { GripHorizontal, GripVertical, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/layout/header';
import { PostEditor } from '@/components/create/PostEditor';
import { ReferenceSidebar } from '@/components/create/ReferenceSidebar';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { useCreateStore } from '@/stores/create-store';
import { useProject } from '@/contexts/project-context';
import { toast } from 'sonner';

export default function CreatePage() {
  const { project } = useProject();
  const {
    setTone, setTitle, setBody, reset,
    title, body, targetSubreddit, referencePosts, removeReference, clearReferences,
  } = useCreateStore();

  // Resizable vertical split state (percentage for editor)
  const [editorPercent, setEditorPercent] = useState(40);
  const editorDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Resizable right sidebar state
  const RIGHT_DEFAULT = 420;
  const RIGHT_MIN = 280;
  const RIGHT_MAX = 700;
  const [rightWidth, setRightWidth] = useState(RIGHT_DEFAULT);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const rightDragging = useRef(false);
  const lastRightWidth = useRef(RIGHT_DEFAULT);
  const outerRef = useRef<HTMLDivElement>(null);

  const { draftId } = useCreateStore();
  const chatRef = useRef<ChatInterfaceHandle>(null);

  useEffect(() => {
    // Don't reset if navigating here with a loaded draft
    if (draftId) return;
    reset();
    setTone(project.tone || 'Adaptive');
  }, [project.id]);

  // Watch for AI search results and send them back to chat as a follow-up
  useEffect(() => {
    const unsub = useCreateStore.subscribe((state) => {
      if (!state.aiSearchResults) return;
      const { query, subreddit, posts } = state.aiSearchResults;
      state.setAISearchResults(null);

      const searchResultPosts: SearchResultPost[] = posts.slice(0, 10).map((p) => ({
        title: p.title,
        subreddit: p.subreddit,
        score: p.score,
        numComments: p.num_comments,
        permalink: p.permalink,
      }));

      chatRef.current?.sendSearchResults({ query, subreddit, posts: searchResultPosts });
    });
    return unsub;
  }, []);

  // Handle drag for editor/chat vertical split
  const handleEditorDragStart = useCallback(() => {
    editorDragging.current = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, []);

  // Handle drag for right sidebar horizontal resize
  const handleRightDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    rightDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const handleToggleRight = useCallback(() => {
    if (sidebarOpen) {
      lastRightWidth.current = rightWidth;
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
      setRightWidth(lastRightWidth.current);
    }
  }, [sidebarOpen, rightWidth]);

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (editorDragging.current && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const pct = Math.min(70, Math.max(20, (y / rect.height) * 100));
        setEditorPercent(pct);
      }

      if (rightDragging.current && outerRef.current) {
        const rect = outerRef.current.getBoundingClientRect();
        const fromRight = rect.right - e.clientX;
        const clamped = Math.min(RIGHT_MAX, Math.max(RIGHT_MIN, fromRight));
        setRightWidth(clamped);
        if (!sidebarOpen) setSidebarOpen(true);
      }
    }

    function handleMouseUp() {
      if (editorDragging.current) {
        editorDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
      if (rightDragging.current) {
        rightDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [sidebarOpen]);

  // Handle AI-triggered search action
  const handleSearchAction = useCallback((search: SearchAction) => {
    // Open sidebar if closed
    if (!sidebarOpen) setSidebarOpen(true);
    // Switch to search tab
    useCreateStore.getState().setActiveTab('search');
    // Set the pending search for InspirationPanel to pick up
    useCreateStore.getState().setPendingSearch(search);
  }, [sidebarOpen]);

  // Apply draft from chat to editor
  function handleApplyDraft(draft: { title: string; body: string }) {
    setTitle(draft.title);
    setBody(draft.body);
    toast.success('Draft applied to editor');
  }

  // Context-aware suggested prompts for the chat
  const suggestedPrompts: SuggestedPrompt[] = useMemo(() => {
    const hasContent = title.trim() || body.trim();
    const hasRefs = referencePosts.length > 0;

    if (hasContent) {
      const prompts: SuggestedPrompt[] = [];
      if (title.trim()) {
        prompts.push({ text: `Review my post title: "${title.slice(0, 50)}${title.length > 50 ? '...' : ''}"`, icon: 'write' });
      }
      if (body.trim()) {
        prompts.push({ text: 'Improve my post body to sound more authentic', icon: 'write' });
      }
      if (targetSubreddit) {
        prompts.push({ text: `Find top posts in r/${targetSubreddit} for inspiration`, icon: 'search' });
      }
      prompts.push({ text: 'Rewrite this as a different style', icon: 'write' });
      return prompts.slice(0, 4);
    }

    if (hasRefs) {
      return [
        { text: 'Write a post draft based on my reference posts', icon: 'write' as const },
        { text: 'What patterns make these reference posts successful?', icon: 'write' as const },
        { text: 'Search Reddit for similar high-performing posts', icon: 'search' as const },
        { text: 'Suggest 3 different angles for my post', icon: 'write' as const },
      ];
    }

    return [
      { text: 'Write me 3 post drafts for my product', icon: 'write' as const },
      { text: 'Find the top posts about my niche this week', icon: 'search' as const },
      { text: 'Search Reddit for posts similar to what I want to write', icon: 'search' as const },
      { text: 'Help me write a post based on what\'s trending', icon: 'write' as const },
    ];
  }, [title, body, targetSubreddit, referencePosts.length]);

  return (
    <div className="flex h-full flex-col">
      <Header title="Create" />
      <div ref={outerRef} className="flex flex-1 overflow-hidden flex-col lg:flex-row">
        {/* Left panel: Editor + Chat with resizable split */}
        <div ref={containerRef} className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Editor section */}
          <div
            className="overflow-hidden shrink-0"
            style={{ height: `${editorPercent}%` }}
          >
            <PostEditor />
          </div>

          {/* Drag handle */}
          <div
            onMouseDown={handleEditorDragStart}
            className="flex items-center justify-center h-2 cursor-row-resize border-y bg-muted/50 hover:bg-muted transition-colors shrink-0"
          >
            <GripHorizontal className="h-3 w-3 text-muted-foreground" />
          </div>

          {/* Chat section */}
          <div className="flex-1 overflow-hidden min-h-0">
            <ChatInterface
              ref={chatRef}
              project={project}
              onApplyDraft={handleApplyDraft}
              onSearchAction={handleSearchAction}
              editorContent={title || body ? { title, body } : null}
              suggestedPrompts={suggestedPrompts}
              attachments={referencePosts}
              onRemoveAttachment={removeReference}
              onClearAttachments={clearReferences}
              placeholder="Describe what you want to post, or ask for help..."
              emptyTitle="Writing Assistant"
              emptyDescription="I can write post drafts, search Reddit for inspiration, and help you refine your content."
            />
          </div>
        </div>

        {/* Right panel drag handle */}
        <div
          onMouseDown={handleRightDragStart}
          className="hidden lg:flex items-center justify-center w-2 cursor-col-resize border-x bg-muted/50 hover:bg-muted transition-colors shrink-0"
        >
          <GripVertical className="h-3 w-3 text-muted-foreground" />
        </div>

        {/* Right panel: Search / Feed / Bookmarks */}
        <div
          className="min-h-[400px] lg:min-h-0 overflow-hidden shrink-0"
          style={{
            width: sidebarOpen ? rightWidth : 0,
            opacity: sidebarOpen ? 1 : 0,
            transition: rightDragging.current ? 'none' : 'width 200ms ease, opacity 200ms ease',
          }}
        >
          <ReferenceSidebar onCollapse={handleToggleRight} />
        </div>

        {/* Re-open button when sidebar is collapsed */}
        {!sidebarOpen && (
          <div className="hidden lg:flex items-start pt-2 pr-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleToggleRight}
            >
              <PanelRightOpen className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
