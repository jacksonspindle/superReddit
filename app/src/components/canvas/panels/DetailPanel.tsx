'use client';

import { X, Users, ExternalLink, ArrowUpRight, Sparkles, Loader2, Lightbulb, Target, TrendingUp } from 'lucide-react';
import { useCanvasStore } from '@/stores/canvas-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ProductNodeData, SubredditNodeData, ExamplePostNodeData, GeneratedPostNodeData, RewriteOption } from '@/types';
import type { SubredditAnalysis } from '@/lib/ai/prompts';
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
          {node.data.type === 'subreddit' && (
            <SubredditDetailPanel data={node.data as SubredditNodeData} />
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

function SubredditDetailPanel({ data }: { data: SubredditNodeData }) {
  const { nodes } = useCanvasStore();
  const [analysis, setAnalysis] = useState<SubredditAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const formatNumber = (n: number | null | undefined) => {
    if (n == null) return '—';
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n);
  };

  async function handleAnalyze() {
    if (data.posts.length === 0) {
      toast.error('Wait for posts to load first');
      return;
    }
    setAnalyzing(true);
    try {
      const productNode = nodes.find((n) => n.data.type === 'product');
      const pd = productNode?.data as ProductNodeData | undefined;

      const res = await fetch('/api/ai/analyze-subreddit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subredditName: data.name,
          posts: data.posts.map((p) => ({
            title: p.title,
            body: p.selftext || null,
            score: p.score,
            num_comments: p.num_comments,
            author: p.author,
          })),
          product: pd ? {
            name: pd.name,
            description: pd.description,
            audience: pd.audience || undefined,
          } : undefined,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setAnalysis(json);
    } catch {
      toast.error('Analysis failed. Check your API key.');
    }
    setAnalyzing(false);
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
          <Users className="h-4 w-4 text-blue-500" />
        </div>
        <div>
          <h4 className="text-sm font-semibold">r/{data.name}</h4>
          {data.subscribers !== null && (
            <p className="text-xs text-muted-foreground">{formatNumber(data.subscribers)} members</p>
          )}
        </div>
      </div>

      {/* Description */}
      {data.description && (
        <p className="text-xs text-muted-foreground leading-relaxed">{data.description}</p>
      )}

      {/* Link + sort */}
      <div className="flex items-center justify-between">
        <a
          href={`https://reddit.com/r/${data.name}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-blue-500 hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          View on Reddit
        </a>
        <span className="text-[10px] text-muted-foreground">
          {data.posts.length} posts · <span className="capitalize">{data.sortBy}</span>
        </span>
      </div>

      {/* Analyze button */}
      {!analysis && (
        <Button
          size="sm"
          className="w-full h-9 text-xs bg-blue-500 hover:bg-blue-600 text-white"
          onClick={handleAnalyze}
          disabled={analyzing || data.posts.length === 0}
        >
          {analyzing ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Analyzing posts...
            </>
          ) : (
            <>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Analyze for Marketing Potential
            </>
          )}
        </Button>
      )}

      {/* Analysis results */}
      {analysis && (
        <div className="space-y-4">
          {/* Subreddit insight */}
          <div className="rounded-lg bg-blue-500/10 p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-blue-500">
              <Lightbulb className="h-3 w-3" />
              Subreddit Insight
            </div>
            <p className="text-xs leading-relaxed">{analysis.subredditInsight}</p>
          </div>

          {/* Tailored recommendation */}
          {analysis.recommendation && (
            <div className="rounded-lg bg-green-500/10 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-green-500">
                <Target className="h-3 w-3" />
                Recommendation for Your Product
              </div>
              <p className="text-xs leading-relaxed">{analysis.recommendation}</p>
            </div>
          )}

          {/* High-conversion posts */}
          {analysis.conversionPosts.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <TrendingUp className="h-3 w-3" />
                High-Conversion Posts
              </div>
              <div className="space-y-2">
                {analysis.conversionPosts.map((post, i) => (
                  <div key={i} className="rounded-lg border p-2.5 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium leading-tight line-clamp-2">{post.title}</p>
                      <span className="shrink-0 flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <ArrowUpRight className="h-2.5 w-2.5" />
                        {formatNumber(post.score)}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">{post.why}</p>
                    <span className="inline-block text-[10px] font-medium bg-purple-500/10 text-purple-500 rounded-full px-2 py-0.5">
                      {post.strategy}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Winning patterns */}
          {analysis.winningPatterns.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Winning Patterns</p>
              <div className="space-y-2">
                {analysis.winningPatterns.map((pattern, i) => (
                  <div key={i} className="rounded-lg bg-muted/50 p-2.5 space-y-1">
                    <p className="text-xs font-semibold">{pattern.pattern}</p>
                    <p className="text-[11px] text-muted-foreground leading-snug">{pattern.description}</p>
                    <p className="text-[11px] italic text-muted-foreground">&ldquo;{pattern.example}&rdquo;</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Re-analyze */}
          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 text-xs"
            onClick={() => { setAnalysis(null); handleAnalyze(); }}
            disabled={analyzing}
          >
            {analyzing ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1.5 h-3 w-3" />}
            Re-analyze
          </Button>
        </div>
      )}
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
