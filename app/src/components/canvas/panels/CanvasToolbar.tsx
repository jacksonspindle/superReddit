'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Sparkles, Loader2, FileText, AlertTriangle, ShieldCheck, ShieldAlert } from 'lucide-react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Project, ExamplePostNodeData, ProductNodeData, GeneratedPostNodeData } from '@/types';
import type { SuggestedSubreddit } from '@/lib/ai/prompts';
import { toast } from 'sonner';

export function CanvasToolbar({ project, onToggleDrafts, draftsOpen }: { project: Project; onToggleDrafts?: () => void; draftsOpen?: boolean }) {
  const { addNode, nodes, edges, setEdges, getSelectedExamplePosts, getProductNode, updateNodeData } = useCanvasStore();
  const [subredditInput, setSubredditInput] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedSubreddit[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);

  const fetchSuggestions = useCallback(async () => {
    const productNode = nodes.find((n) => n.data.type === 'product');
    if (!productNode) return;
    const pd = productNode.data as ProductNodeData;

    setSuggestionsLoading(true);
    setSuggestionsError(null);
    try {
      const res = await fetch('/api/ai/suggest-subreddits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: pd.name,
          description: pd.description,
          url: pd.url || undefined,
          audience: pd.audience || undefined,
          tone: pd.tone,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setSuggestions(json.subreddits || []);
      setSuggestionsLoaded(true);
    } catch {
      setSuggestionsError('Failed to load suggestions');
    }
    setSuggestionsLoading(false);
  }, [nodes]);

  useEffect(() => {
    if (dialogOpen && !suggestionsLoaded && !suggestionsLoading) {
      fetchSuggestions();
    }
  }, [dialogOpen, suggestionsLoaded, suggestionsLoading, fetchSuggestions]);

  function addSubredditByName(name: string) {
    const cleanName = name.trim().replace(/^r\//, '');
    if (!cleanName) return;

    const id = `subreddit-${cleanName}`;
    const existing = nodes.find((n) => n.id === id);
    if (existing) {
      toast.error(`r/${cleanName} is already on the canvas`);
      return;
    }

    const productNode = nodes.find((n) => n.data.type === 'product');
    const subredditCount = nodes.filter((n) => n.data.type === 'subreddit').length;

    addNode({
      id,
      type: 'subreddit',
      position: { x: 400, y: 50 + subredditCount * 400 },
      data: {
        type: 'subreddit',
        name: cleanName,
        subscribers: null,
        description: null,
        posts: [],
        loading: false,
        sortBy: 'hot',
      },
    });

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

    return cleanName;
  }

  function handleAddSubreddit() {
    if (!subredditInput.trim()) return;
    addSubredditByName(subredditInput);
    setSubredditInput('');
    setDialogOpen(false);
  }

  function handleAddSuggestion(name: string) {
    addSubredditByName(name);
    // Remove from suggestions list
    setSuggestions((prev) => prev.filter((s) => s.name !== name));
    toast.success(`Added r/${name} to canvas`);
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
        <DialogContent className="max-w-md">
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

          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">AI Suggestions</p>
              {suggestionsLoaded && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px] text-muted-foreground"
                  onClick={() => { setSuggestionsLoaded(false); fetchSuggestions(); }}
                >
                  Refresh
                </Button>
              )}
            </div>

            {suggestionsLoading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="ml-2 text-xs text-muted-foreground">Finding subreddits for your product...</span>
              </div>
            )}

            {suggestionsError && (
              <p className="text-xs text-destructive py-2">{suggestionsError}</p>
            )}

            {!suggestionsLoading && suggestions.length > 0 && (
              <ScrollArea className="h-64">
                <div className="space-y-1.5 pr-3">
                  {suggestions.map((s) => {
                    const alreadyAdded = nodes.some((n) => n.id === `subreddit-${s.name}`);
                    return (
                      <button
                        key={s.name}
                        disabled={alreadyAdded}
                        onClick={() => handleAddSuggestion(s.name)}
                        className="w-full text-left rounded-lg border p-2.5 hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">r/{s.name}</span>
                          <span className={`flex items-center gap-1 text-[10px] font-medium rounded-full px-2 py-0.5 ${
                            s.risk === 'low' ? 'bg-green-500/10 text-green-500' :
                            s.risk === 'medium' ? 'bg-yellow-500/10 text-yellow-500' :
                            'bg-red-500/10 text-red-500'
                          }`}>
                            {s.risk === 'low' ? <ShieldCheck className="h-2.5 w-2.5" /> :
                             s.risk === 'medium' ? <ShieldAlert className="h-2.5 w-2.5" /> :
                             <AlertTriangle className="h-2.5 w-2.5" />}
                            {s.risk}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.reason}</p>
                        {alreadyAdded && (
                          <p className="text-[10px] text-muted-foreground mt-1 italic">Already on canvas</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}

            {!suggestionsLoading && suggestionsLoaded && suggestions.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">All suggestions have been added!</p>
            )}
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
