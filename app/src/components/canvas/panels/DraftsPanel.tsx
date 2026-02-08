'use client';

import { useState } from 'react';
import { FileText, Copy, Check, ChevronDown, ChevronUp, Sparkles, ExternalLink } from 'lucide-react';
import { useCanvasStore } from '@/stores/canvas-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { GeneratedPostNodeData } from '@/types';
import { toast } from 'sonner';

export function DraftsPanel() {
  const { nodes, updateNodeData } = useCanvasStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const drafts = nodes
    .filter((n) => n.data.type === 'generated-post' && !(n.data as GeneratedPostNodeData).generating)
    .map((n) => ({ id: n.id, data: n.data as GeneratedPostNodeData }));

  if (drafts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500 mb-3">
          <Sparkles className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium">No drafts yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Select example posts and click Generate to create drafts
        </p>
      </div>
    );
  }

  function handleCopy(id: string, title: string, body: string) {
    navigator.clipboard.writeText(`${title}\n\n${body}`);
    setCopiedId(id);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleCopyTitle(title: string) {
    navigator.clipboard.writeText(title);
    toast.success('Title copied');
  }

  function handleCopyBody(body: string) {
    navigator.clipboard.writeText(body);
    toast.success('Body copied');
  }

  function handleMarkPosted(id: string) {
    updateNodeData(id, { status: 'posted' });
    toast.success('Marked as posted');
  }

  const statusColors = {
    draft: 'bg-muted text-muted-foreground',
    edited: 'bg-blue-500/10 text-blue-600',
    posted: 'bg-green-500/10 text-green-600',
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between px-1 mb-1">
          <span className="text-xs font-medium text-muted-foreground">{drafts.length} draft{drafts.length !== 1 ? 's' : ''}</span>
        </div>

        {drafts.map(({ id, data }) => {
          const isExpanded = expandedId === id;
          const titleLength = data.title.length;
          const bodyLength = data.body.length;

          return (
            <div key={id} className="rounded-lg border bg-card overflow-hidden">
              {/* Header */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : id)}
                className="w-full text-left p-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0 text-purple-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium leading-tight line-clamp-2">{data.title}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant="outline" className={`text-[10px] h-4 px-1.5 ${statusColors[data.status]}`}>
                        {data.status}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {titleLength + bodyLength} chars
                      </span>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t px-3 pb-3 pt-2 space-y-2.5">
                  {/* Title with copy */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Title ({titleLength} chars)</span>
                      <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px]" onClick={() => handleCopyTitle(data.title)}>
                        <Copy className="h-2.5 w-2.5 mr-1" /> Copy
                      </Button>
                    </div>
                    <p className="text-xs font-medium bg-muted rounded-md p-2">{data.title}</p>
                  </div>

                  {/* Body with copy */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Body ({bodyLength} chars)</span>
                      <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px]" onClick={() => handleCopyBody(data.body)}>
                        <Copy className="h-2.5 w-2.5 mr-1" /> Copy
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground bg-muted rounded-md p-2 whitespace-pre-wrap max-h-40 overflow-auto">
                      {data.body}
                    </p>
                  </div>

                  {/* Strategy note */}
                  {data.strategyNote && (
                    <p className="text-[10px] text-purple-600 dark:text-purple-400 italic">
                      {data.strategyNote}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs flex-1"
                      onClick={() => handleCopy(id, data.title, data.body)}
                    >
                      {copiedId === id ? (
                        <><Check className="mr-1 h-3 w-3" /> Copied</>
                      ) : (
                        <><Copy className="mr-1 h-3 w-3" /> Copy All</>
                      )}
                    </Button>
                    {data.status !== 'posted' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs flex-1"
                        onClick={() => handleMarkPosted(id)}
                      >
                        <ExternalLink className="mr-1 h-3 w-3" /> Mark Posted
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
