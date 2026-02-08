'use client';

import { memo, useEffect, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Users, ArrowUpRight, MessageSquare, ExternalLink, Loader2 } from 'lucide-react';
import { useCanvasStore } from '@/stores/canvas-store';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { SubredditNodeData, RedditPost } from '@/types';

type SubredditNodeProps = NodeProps & { data: SubredditNodeData };

export const SubredditNode = memo(function SubredditNode({ id, data, selected }: SubredditNodeProps) {
  const { updateNodeData, addNode, edges, setEdges } = useCanvasStore();
  const [localLoading, setLocalLoading] = useState(false);

  useEffect(() => {
    if (data.name && data.posts.length === 0 && !data.loading) {
      fetchPosts(data.sortBy);
    }
  }, [data.name]);

  async function fetchPosts(sort: string) {
    updateNodeData(id, { loading: true });
    setLocalLoading(true);
    try {
      const res = await fetch(`/api/reddit?subreddit=${data.name}&sort=${sort}&info=true&limit=15`);
      const json = await res.json();
      updateNodeData(id, {
        posts: json.posts || [],
        loading: false,
        subscribers: json.subredditInfo?.subscribers || null,
        description: json.subredditInfo?.public_description || null,
      });
    } catch {
      updateNodeData(id, { loading: false });
    }
    setLocalLoading(false);
  }

  function handleSortChange(value: string) {
    updateNodeData(id, { sortBy: value as 'hot' | 'top' | 'rising', posts: [] });
    fetchPosts(value);
  }

  function handleUsePost(post: RedditPost) {
    const nodeId = `example-${post.id}`;
    // Check if already added
    const existingNodes = useCanvasStore.getState().nodes;
    if (existingNodes.find((n) => n.id === nodeId)) return;

    const myNode = existingNodes.find((n) => n.id === id);
    const myX = myNode?.position?.x || 400;
    const myY = myNode?.position?.y || 0;
    const exampleCount = existingNodes.filter(
      (n) => n.data.type === 'example-post'
    ).length;

    addNode({
      id: nodeId,
      type: 'example-post',
      position: { x: myX + 380, y: myY + exampleCount * 220 },
      data: {
        type: 'example-post',
        redditId: post.id,
        title: post.title,
        body: post.selftext || null,
        author: post.author,
        score: post.score,
        numComments: post.num_comments,
        subreddit: post.subreddit,
        permalink: post.permalink,
        selected: false,
      },
    });

    // Add edge
    const currentEdges = useCanvasStore.getState().edges;
    setEdges([
      ...currentEdges,
      {
        id: `e-${id}-${nodeId}`,
        source: id,
        target: nodeId,
        animated: true,
      },
    ]);
  }

  const formatNumber = (n: number | null | undefined) => {
    if (n == null) return '?';
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n);
  };

  return (
    <div
      className={`w-80 rounded-xl border-2 bg-card shadow-md transition-shadow ${
        selected ? 'border-blue-500 shadow-blue-500/20' : 'border-blue-500/30'
      }`}
    >
      <div className="flex items-center justify-between rounded-t-xl bg-blue-500 px-3 py-2 text-white">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          <span className="text-sm font-semibold">r/{data.name}</span>
        </div>
        {data.subscribers !== null && (
          <span className="text-xs opacity-80">{formatNumber(data.subscribers)} members</span>
        )}
      </div>

      <div className="p-3 space-y-2">
        {data.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{data.description}</p>
        )}

        <Select value={data.sortBy} onValueChange={handleSortChange}>
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hot">Hot</SelectItem>
            <SelectItem value="top">Top (Week)</SelectItem>
            <SelectItem value="rising">Rising</SelectItem>
          </SelectContent>
        </Select>

        {localLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          </div>
        ) : (
          <ScrollArea className="nowheel h-56">
            <div className="space-y-1">
              {data.posts.map((post) => (
                <div
                  key={post.id}
                  className="group flex items-start gap-2 rounded-lg p-2 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex flex-col items-center min-w-[36px] text-xs text-muted-foreground">
                    <ArrowUpRight className="h-3 w-3" />
                    <span>{formatNumber(post.score)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium leading-tight line-clamp-2">{post.title}</p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        <MessageSquare className="h-2.5 w-2.5" />
                        {post.num_comments}
                      </span>
                      <span>u/{post.author}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => handleUsePost(post)}
                    >
                      Use
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => window.open(`https://reddit.com${post.permalink}`, '_blank')}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
              {data.posts.length === 0 && !localLoading && (
                <p className="py-4 text-center text-xs text-muted-foreground">No posts found</p>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      <Handle type="target" position={Position.Left} className="!bg-blue-500 !w-3 !h-3" />
      <Handle type="source" position={Position.Right} className="!bg-blue-500 !w-3 !h-3" />
    </div>
  );
});
