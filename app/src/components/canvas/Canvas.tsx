'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useOnViewportChange,
  BackgroundVariant,
  Panel,
  type Viewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from '@/components/ui/button';
import { useCanvasStore } from '@/stores/canvas-store';
import { createClient } from '@/lib/supabase/client';
import { ProductNode } from './nodes/ProductNode';
import { SubredditNode } from './nodes/SubredditNode';
import { ExamplePostNode } from './nodes/ExamplePostNode';
import { GeneratedPostNode } from './nodes/GeneratedPostNode';
import { CanvasToolbar } from './panels/CanvasToolbar';
import { DetailPanel } from './panels/DetailPanel';
import { DraftsPanel } from './panels/DraftsPanel';
import { OnboardingWizard } from './OnboardingWizard';
import type { Project } from '@/types';

const nodeTypes = {
  product: ProductNode,
  subreddit: SubredditNode,
  'example-post': ExamplePostNode,
  'generated-post': GeneratedPostNode,
};

interface CanvasProps {
  project: Project;
}

export function Canvas({ project }: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner project={project} />
    </ReactFlowProvider>
  );
}

function CanvasInner({ project }: CanvasProps) {
  const {
    nodes,
    edges,
    viewport,
    isDirty,
    selectedNodeId,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setViewport,
    setSelectedNodeId,
    setProjectId,
    loadCanvasState,
    markClean,
  } = useCanvasStore();

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [canvasLoaded, setCanvasLoaded] = useState(false);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const supabase = createClient();

  // Track viewport changes via hook
  useOnViewportChange({
    onChange: useCallback((vp: Viewport) => setViewport(vp), [setViewport]),
  });

  // Load canvas state on mount
  useEffect(() => {
    setProjectId(project.id);
    loadInitialState();
  }, [project.id]);

  async function loadInitialState() {
    const { data } = await supabase
      .from('canvas_states')
      .select('*')
      .eq('project_id', project.id)
      .single();

    if (data) {
      loadCanvasState(data.nodes || [], data.edges || [], data.viewport || { x: 0, y: 0, zoom: 1 });
      // Show onboarding if no subreddit nodes exist yet
      const hasSubreddits = (data.nodes || []).some(
        (n: { data?: { type?: string } }) => n.data?.type === 'subreddit'
      );
      if (!hasSubreddits) setShowOnboarding(true);
    } else {
      // Create initial product node
      const initialNodes = [
        {
          id: 'product-1',
          type: 'product',
          position: { x: 50, y: 200 },
          data: {
            type: 'product' as const,
            name: project.product_name,
            description: project.product_description,
            url: project.product_url || '',
            audience: project.target_audience || '',
            tone: project.tone,
          },
        },
      ];
      loadCanvasState(initialNodes, [], { x: 0, y: 0, zoom: 1 });

      // Save initial state
      await supabase.from('canvas_states').insert({
        project_id: project.id,
        nodes: initialNodes,
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      });

      setShowOnboarding(true);
    }
    setCanvasLoaded(true);
  }

  // Auto-save with debounce (2s)
  useEffect(() => {
    if (!isDirty || !project.id) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      await supabase
        .from('canvas_states')
        .upsert({
          project_id: project.id,
          nodes,
          edges,
          viewport,
        }, { onConflict: 'project_id' });
      markClean();
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [isDirty, nodes, edges, viewport, project.id]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => {
      setSelectedNodeId(node.id);
    },
    [setSelectedNodeId]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        defaultViewport={viewport}
        fitView={!nodes.length}
        className="bg-background"
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(var(--muted-foreground) / 0.15)" />
        <Controls className="rounded-lg border bg-card shadow-sm" />
        <MiniMap
          className="rounded-lg border bg-card shadow-sm"
          nodeColor={(node) => {
            switch (node.type) {
              case 'product': return '#f97316';
              case 'subreddit': return '#3b82f6';
              case 'example-post': return '#22c55e';
              case 'generated-post': return '#a855f7';
              default: return '#6b7280';
            }
          }}
        />
        <Panel position="top-center">
          <CanvasToolbar project={project} onToggleDrafts={() => setDraftsOpen(!draftsOpen)} draftsOpen={draftsOpen} />
        </Panel>
      </ReactFlow>
      {selectedNodeId && !draftsOpen && <DetailPanel />}
      {draftsOpen && (
        <div className="absolute right-0 top-0 h-full w-80 border-l bg-card shadow-xl z-10">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="font-semibold text-sm">Drafts</h3>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDraftsOpen(false)}>
              <span className="text-lg leading-none">&times;</span>
            </Button>
          </div>
          <div className="h-[calc(100%-52px)]">
            <DraftsPanel />
          </div>
        </div>
      )}
      {showOnboarding && canvasLoaded && (
        <OnboardingWizard project={project} onComplete={() => setShowOnboarding(false)} />
      )}
    </div>
  );
}
