'use client';

import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { ArrowUpRight, MessageSquare, ChevronDown, ChevronUp, CheckSquare, Square } from 'lucide-react';
import { useCanvasStore } from '@/stores/canvas-store';
import type { ExamplePostNodeData } from '@/types';

type ExamplePostNodeProps = NodeProps & { data: ExamplePostNodeData };

export const ExamplePostNode = memo(function ExamplePostNode({ id, data, selected }: ExamplePostNodeProps) {
  const { updateNodeData } = useCanvasStore();
  const [expanded, setExpanded] = useState(false);

  const toggleSelected = () => {
    updateNodeData(id, { selected: !data.selected });
  };

  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  return (
    <div
      className={`w-72 rounded-xl border-2 bg-card shadow-md transition-all ${
        data.selected
          ? 'border-green-500 shadow-green-500/20 ring-2 ring-green-500/20'
          : selected
          ? 'border-green-500 shadow-green-500/20'
          : 'border-green-500/30'
      }`}
    >
      <div className="flex items-center justify-between rounded-t-xl bg-green-500 px-3 py-2 text-white">
        <span className="text-sm font-semibold">Example Post</span>
        <span className="text-xs opacity-80">r/{data.subreddit}</span>
      </div>

      <div className="p-3 space-y-2">
        {/* Selection checkbox */}
        <button
          onClick={toggleSelected}
          className="flex items-center gap-2 w-full text-left text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {data.selected ? (
            <CheckSquare className="h-4 w-4 text-green-500" />
          ) : (
            <Square className="h-4 w-4" />
          )}
          <span>{data.selected ? 'Selected for generation' : 'Select for generation'}</span>
        </button>

        <h3 className="text-sm font-medium leading-tight">{data.title}</h3>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <ArrowUpRight className="h-3 w-3" />
            {formatNumber(data.score)}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {formatNumber(data.numComments)}
          </span>
          <span>u/{data.author}</span>
        </div>

        {data.body && (
          <>
            <div className={`text-xs text-muted-foreground ${expanded ? '' : 'line-clamp-3'}`}>
              {data.body}
            </div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-400"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? 'Show less' : 'Show more'}
            </button>
          </>
        )}
      </div>

      <Handle type="target" position={Position.Left} className="!bg-green-500 !w-3 !h-3" />
      <Handle type="source" position={Position.Right} className="!bg-green-500 !w-3 !h-3" />
    </div>
  );
});
