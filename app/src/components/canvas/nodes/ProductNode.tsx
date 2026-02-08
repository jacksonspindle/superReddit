'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Package } from 'lucide-react';
import type { ProductNodeData } from '@/types';

type ProductNodeProps = NodeProps & { data: ProductNodeData };

export const ProductNode = memo(function ProductNode({ data, selected }: ProductNodeProps) {
  return (
    <div
      className={`w-72 rounded-xl border-2 bg-card shadow-md transition-shadow ${
        selected ? 'border-orange-500 shadow-orange-500/20' : 'border-orange-500/30'
      }`}
    >
      <div className="flex items-center gap-2 rounded-t-xl bg-orange-500 px-3 py-2 text-white">
        <Package className="h-4 w-4" />
        <span className="text-sm font-semibold">Product</span>
      </div>
      <div className="space-y-2 p-3">
        <h3 className="font-semibold text-base">{data.name || 'Untitled Product'}</h3>
        {data.description && (
          <p className="text-xs text-muted-foreground line-clamp-3">{data.description}</p>
        )}
        {data.url && (
          <p className="text-xs text-blue-500 truncate">{data.url}</p>
        )}
        <div className="flex flex-wrap gap-1">
          {data.audience && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
              {data.audience}
            </span>
          )}
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {data.tone}
          </span>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-orange-500 !w-3 !h-3" />
    </div>
  );
});
