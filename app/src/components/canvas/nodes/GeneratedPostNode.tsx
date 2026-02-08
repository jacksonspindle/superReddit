'use client';

import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Sparkles, Copy, RefreshCw, Pencil, Check, Loader2 } from 'lucide-react';
import { useCanvasStore } from '@/stores/canvas-store';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import type { GeneratedPostNodeData } from '@/types';
import { toast } from 'sonner';

type GeneratedPostNodeProps = NodeProps & { data: GeneratedPostNodeData };

export const GeneratedPostNode = memo(function GeneratedPostNode({ id, data, selected }: GeneratedPostNodeProps) {
  const { updateNodeData } = useCanvasStore();
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(data.title);
  const [editBody, setEditBody] = useState(data.body);
  const [rewriting, setRewriting] = useState(false);

  function handleCopy() {
    const text = `${data.title}\n\n${data.body}`;
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  }

  function handleSaveEdit() {
    updateNodeData(id, { title: editTitle, body: editBody, status: 'edited' });
    setEditing(false);
  }

  async function handleRewrite(tone: string) {
    setRewriting(true);
    try {
      const res = await fetch('/api/ai/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: data.body, tone }),
      });
      const json = await res.json();
      if (json.text) {
        updateNodeData(id, { body: json.text, status: 'edited' });
        setEditBody(json.text);
        toast.success(`Rewritten as ${tone}`);
      }
    } catch {
      toast.error('Rewrite failed');
    }
    setRewriting(false);
  }

  if (data.generating) {
    return (
      <div className="w-80 rounded-xl border-2 border-purple-500/30 bg-card shadow-md">
        <div className="flex items-center gap-2 rounded-t-xl bg-purple-500 px-3 py-2 text-white">
          <Sparkles className="h-4 w-4" />
          <span className="text-sm font-semibold">Generating...</span>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
        </div>
        <Handle type="target" position={Position.Left} className="!bg-purple-500 !w-3 !h-3" />
      </div>
    );
  }

  return (
    <div
      className={`w-80 rounded-xl border-2 bg-card shadow-md transition-shadow ${
        selected ? 'border-purple-500 shadow-purple-500/20' : 'border-purple-500/30'
      }`}
    >
      <div className="flex items-center justify-between rounded-t-xl bg-purple-500 px-3 py-2 text-white">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          <span className="text-sm font-semibold">Generated Post</span>
        </div>
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px]">{data.status}</span>
      </div>

      <div className="p-3 space-y-2">
        {editing ? (
          <>
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="text-sm font-medium"
              placeholder="Post title"
            />
            <Textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              className="text-xs min-h-[120px]"
              placeholder="Post body"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveEdit} className="h-7 text-xs">
                <Check className="mr-1 h-3 w-3" /> Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="h-7 text-xs">
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <>
            <h3 className="text-sm font-semibold leading-tight">{data.title}</h3>
            <p className="text-xs text-muted-foreground line-clamp-6 whitespace-pre-wrap">{data.body}</p>

            {data.strategyNote && (
              <div className="rounded-lg bg-purple-50 p-2 text-xs text-purple-700 dark:bg-purple-900/20 dark:text-purple-300">
                {data.strategyNote}
              </div>
            )}

            <div className="flex flex-wrap gap-1.5 pt-1">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleCopy}>
                <Copy className="mr-1 h-3 w-3" /> Copy
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditing(true)}>
                <Pencil className="mr-1 h-3 w-3" /> Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => handleRewrite('Engaging')}
                disabled={rewriting}
              >
                <RefreshCw className={`mr-1 h-3 w-3 ${rewriting ? 'animate-spin' : ''}`} />
                Rewrite
              </Button>
            </div>
          </>
        )}
      </div>

      <Handle type="target" position={Position.Left} className="!bg-purple-500 !w-3 !h-3" />
    </div>
  );
});
