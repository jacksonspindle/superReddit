'use client';

import { useState } from 'react';
import { Plus, Sparkles, Loader2, FileText } from 'lucide-react';
import { useCanvasStore } from '@/stores/canvas-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { Project, ExamplePostNodeData, ProductNodeData, GeneratedPostNodeData } from '@/types';
import { toast } from 'sonner';

export function CanvasToolbar({ project, onToggleDrafts, draftsOpen }: { project: Project; onToggleDrafts?: () => void; draftsOpen?: boolean }) {
  const { addNode, nodes, edges, setEdges, getSelectedExamplePosts, getProductNode, updateNodeData } = useCanvasStore();
  const [subredditInput, setSubredditInput] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  function handleAddSubreddit() {
    const name = subredditInput.trim().replace(/^r\//, '');
    if (!name) return;

    const id = `subreddit-${name}`;
    const existing = nodes.find((n) => n.id === id);
    if (existing) {
      toast.error(`r/${name} is already on the canvas`);
      return;
    }

    // Find product node for edge
    const productNode = nodes.find((n) => n.data.type === 'product');
    const subredditCount = nodes.filter((n) => n.data.type === 'subreddit').length;

    addNode({
      id,
      type: 'subreddit',
      position: { x: 400, y: 50 + subredditCount * 400 },
      data: {
        type: 'subreddit',
        name,
        subscribers: null,
        description: null,
        posts: [],
        loading: false,
        sortBy: 'hot',
      },
    });

    // Connect product → subreddit
    if (productNode) {
      const currentEdges = useCanvasStore.getState().edges;
      setEdges([
        ...currentEdges,
        {
          id: `e-${productNode.id}-${id}`,
          source: productNode.id,
          target: id,
          animated: true,
        },
      ]);
    }

    setSubredditInput('');
    setDialogOpen(false);
  }

  async function handleGenerate() {
    const productNode = getProductNode();
    const selectedPosts = getSelectedExamplePosts();

    if (!productNode) {
      toast.error('No product node found on canvas');
      return;
    }

    if (selectedPosts.length === 0) {
      toast.error('Select at least one example post (click the checkbox on green nodes)');
      return;
    }

    setGenerating(true);

    // Create placeholder generated nodes
    const placeholderIds: string[] = [];
    const count = Math.min(selectedPosts.length, 3);

    for (let i = 0; i < count; i++) {
      const nodeId = `generated-${Date.now()}-${i}`;
      placeholderIds.push(nodeId);
      const lastExample = selectedPosts[Math.min(i, selectedPosts.length - 1)];
      const exNode = nodes.find((n) => n.id === lastExample.id);
      const exX = exNode?.position?.x || 800;
      const exY = exNode?.position?.y || 0;

      addNode({
        id: nodeId,
        type: 'generated-post',
        position: { x: exX + 340, y: exY + i * 280 },
        data: {
          type: 'generated-post',
          title: '',
          body: '',
          tone: productNode.data.tone,
          strategyNote: null,
          status: 'draft',
          basedOnPostIds: selectedPosts.map((p) => p.id),
          generating: true,
        },
      });

      // Connect edge from last example post
      const currentEdges = useCanvasStore.getState().edges;
      setEdges([
        ...currentEdges,
        {
          id: `e-${lastExample.id}-${nodeId}`,
          source: lastExample.id,
          target: nodeId,
          animated: true,
        },
      ]);
    }

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productContext: {
            name: productNode.data.name,
            description: productNode.data.description,
            url: productNode.data.url || undefined,
            audience: productNode.data.audience || undefined,
            tone: productNode.data.tone,
          },
          examplePosts: selectedPosts.map((p) => ({
            title: (p.data as ExamplePostNodeData).title,
            body: (p.data as ExamplePostNodeData).body,
            score: (p.data as ExamplePostNodeData).score,
            subreddit: (p.data as ExamplePostNodeData).subreddit,
            numComments: (p.data as ExamplePostNodeData).numComments,
          })),
          count,
        }),
      });

      const json = await res.json();

      if (json.error) {
        throw new Error(json.error);
      }

      // Update placeholder nodes with real data
      json.posts.forEach((post: { title: string; body: string; strategyNote: string }, i: number) => {
        if (placeholderIds[i]) {
          updateNodeData(placeholderIds[i], {
            title: post.title,
            body: post.body,
            strategyNote: post.strategyNote,
            generating: false,
          });
        }
      });

      toast.success(`Generated ${json.posts.length} posts!`);
    } catch (error) {
      // Remove placeholder nodes on error
      placeholderIds.forEach((nodeId) => {
        updateNodeData(nodeId, { generating: false, title: 'Generation failed', body: 'Click Regenerate to try again.' });
      });
      toast.error('Failed to generate posts. Check your API key.');
    }

    setGenerating(false);
  }

  const selectedCount = nodes.filter(
    (n) => n.data.type === 'example-post' && (n.data as ExamplePostNodeData).selected
  ).length;

  const draftCount = nodes.filter(
    (n) => n.data.type === 'generated-post' && !(n.data as GeneratedPostNodeData).generating
  ).length;

  return (
    <div className="flex items-center gap-2 rounded-xl border bg-card/95 px-3 py-2 shadow-lg backdrop-blur-sm">
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 text-xs">
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Subreddit
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Subreddit</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. SaaS, startups, webdev"
              value={subredditInput}
              onChange={(e) => setSubredditInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSubreddit()}
            />
            <Button onClick={handleAddSubreddit}>Add</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="h-6 w-px bg-border" />

      <Button
        size="sm"
        className="h-8 text-xs bg-purple-500 hover:bg-purple-600 text-white"
        onClick={handleGenerate}
        disabled={generating || selectedCount === 0}
      >
        {generating ? (
          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="mr-1 h-3.5 w-3.5" />
        )}
        Generate ({selectedCount} selected)
      </Button>

      {onToggleDrafts && (
        <>
          <div className="h-6 w-px bg-border" />
          <Button
            variant={draftsOpen ? 'default' : 'outline'}
            size="sm"
            className="h-8 text-xs"
            onClick={onToggleDrafts}
          >
            <FileText className="mr-1 h-3.5 w-3.5" />
            Drafts ({draftCount})
          </Button>
        </>
      )}
    </div>
  );
}
