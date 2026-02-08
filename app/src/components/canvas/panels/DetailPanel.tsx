'use client';

import { X } from 'lucide-react';
import { useCanvasStore } from '@/stores/canvas-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ProductNodeData, ExamplePostNodeData, GeneratedPostNodeData, RewriteOption } from '@/types';
import { useState } from 'react';
import { toast } from 'sonner';

const TONES = ['Professional', 'Casual', 'Humorous', 'Technical', 'Storytelling', 'Educational'];
const REWRITE_OPTIONS: RewriteOption[] = ['Engaging', 'Humorous', 'Creative', 'Sarcastic', 'Inspirational', 'Concise', 'Improve grammar', 'Engaging hook', 'More details'];

export function DetailPanel() {
  const { selectedNodeId, nodes, updateNodeData, removeNode, setSelectedNodeId } = useCanvasStore();
  const [rewriting, setRewriting] = useState(false);

  const node = nodes.find((n) => n.id === selectedNodeId);
  if (!node) return null;

  const handleClose = () => setSelectedNodeId(null);

  async function handleRewrite(nodeId: string, text: string, tone: string) {
    setRewriting(true);
    try {
      const res = await fetch('/api/ai/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, tone }),
      });
      const json = await res.json();
      if (json.text) {
        updateNodeData(nodeId, { body: json.text, status: 'edited' });
        toast.success(`Rewritten as ${tone}`);
      }
    } catch {
      toast.error('Rewrite failed');
    }
    setRewriting(false);
  }

  return (
    <div className="absolute right-0 top-0 h-full w-80 border-l bg-card shadow-xl z-10">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="font-semibold text-sm">
          {node.data.type === 'product' && 'Product Details'}
          {node.data.type === 'subreddit' && 'Subreddit Details'}
          {node.data.type === 'example-post' && 'Example Post'}
          {node.data.type === 'generated-post' && 'Generated Post'}
        </h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="h-[calc(100%-52px)]">
        <div className="p-4 space-y-4">
          {node.data.type === 'product' && (
            <ProductDetailPanel nodeId={node.id} data={node.data as ProductNodeData} />
          )}
          {node.data.type === 'example-post' && (
            <ExamplePostDetailPanel data={node.data as ExamplePostNodeData} />
          )}
          {node.data.type === 'generated-post' && (
            <GeneratedPostDetailPanel
              nodeId={node.id}
              data={node.data as GeneratedPostNodeData}
              onRewrite={handleRewrite}
              rewriting={rewriting}
            />
          )}

          {node.data.type !== 'product' && (
            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={() => { removeNode(node.id); handleClose(); }}
            >
              Remove from canvas
            </Button>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function ProductDetailPanel({ nodeId, data }: { nodeId: string; data: ProductNodeData }) {
  const { updateNodeData } = useCanvasStore();

  return (
    <>
      <div className="space-y-2">
        <Label className="text-xs">Product Name</Label>
        <Input
          value={data.name}
          onChange={(e) => updateNodeData(nodeId, { name: e.target.value })}
          className="text-sm"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Description</Label>
        <Textarea
          value={data.description}
          onChange={(e) => updateNodeData(nodeId, { description: e.target.value })}
          rows={4}
          className="text-sm"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">URL</Label>
        <Input
          value={data.url}
          onChange={(e) => updateNodeData(nodeId, { url: e.target.value })}
          className="text-sm"
          placeholder="https://..."
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Target Audience</Label>
        <Input
          value={data.audience}
          onChange={(e) => updateNodeData(nodeId, { audience: e.target.value })}
          className="text-sm"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Tone</Label>
        <Select value={data.tone} onValueChange={(v) => updateNodeData(nodeId, { tone: v })}>
          <SelectTrigger className="text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TONES.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

function ExamplePostDetailPanel({ data }: { data: ExamplePostNodeData }) {
  return (
    <>
      <h4 className="font-semibold text-sm">{data.title}</h4>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{data.score} upvotes</span>
        <span>{data.numComments} comments</span>
      </div>
      <p className="text-xs text-muted-foreground">by u/{data.author} in r/{data.subreddit}</p>
      {data.body && (
        <div className="rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap">{data.body}</div>
      )}
      <a
        href={`https://reddit.com${data.permalink}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-blue-500 hover:underline"
      >
        View on Reddit
      </a>
    </>
  );
}

function GeneratedPostDetailPanel({
  nodeId,
  data,
  onRewrite,
  rewriting,
}: {
  nodeId: string;
  data: GeneratedPostNodeData;
  onRewrite: (nodeId: string, text: string, tone: string) => void;
  rewriting: boolean;
}) {
  return (
    <>
      <h4 className="font-semibold text-sm">{data.title}</h4>
      <div className="rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap">{data.body}</div>
      {data.strategyNote && (
        <div className="rounded-lg bg-purple-50 p-2 text-xs text-purple-700 dark:bg-purple-900/20 dark:text-purple-300">
          <strong>Strategy:</strong> {data.strategyNote}
        </div>
      )}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Rewrite as...</Label>
        <div className="flex flex-wrap gap-1.5">
          {REWRITE_OPTIONS.map((tone) => (
            <Button
              key={tone}
              variant="outline"
              size="sm"
              className="h-6 text-[10px] px-2"
              disabled={rewriting}
              onClick={() => onRewrite(nodeId, data.body, tone)}
            >
              {tone}
            </Button>
          ))}
        </div>
      </div>
    </>
  );
}
