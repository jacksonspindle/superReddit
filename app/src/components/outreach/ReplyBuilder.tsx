'use client';

import { useState } from 'react';
import { Loader2, Copy, ExternalLink, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { scaleFadeVariants } from '@/lib/motion';
import { toast } from 'sonner';

interface ReplyBuilderProps {
  signalId: string;
  projectId: string;
  permalink: string;
  onCopied?: () => void;
}

type ReplyMode = 'helpful' | 'experience' | 'subtle';

export function ReplyBuilder({ signalId, projectId, permalink, onCopied }: ReplyBuilderProps) {
  const [mode, setMode] = useState<ReplyMode>('helpful');
  const [draft, setDraft] = useState('');
  const [replyId, setReplyId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch('/api/ai/outreach-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signal_id: signalId, project_id: projectId, reply_mode: mode }),
      });

      const json = await res.json();
      if (json.error) {
        toast.error(json.error);
      } else {
        setDraft(json.reply);
        if (json.reply_id) setReplyId(json.reply_id);
        toast.success('Reply draft generated');
      }
    } catch {
      toast.error('Failed to generate reply');
    }
    setGenerating(false);
  }

  async function handleCopyAndOpen() {
    try {
      await navigator.clipboard.writeText(draft);
      toast.success('Reply copied to clipboard');

      // Mark as copied in backend
      if (replyId) {
        await fetch('/api/outreach/reply/copied', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reply_id: replyId, signal_id: signalId }),
        });
      }

      onCopied?.();

      // Open Reddit thread
      window.open(`https://reddit.com${permalink}`, '_blank');
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  }

  return (
    <motion.div
      variants={scaleFadeVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="mt-3 space-y-3 rounded-lg border bg-muted/30 p-3"
    >
      <div className="flex items-center gap-2">
        <Select value={mode} onValueChange={(v) => setMode(v as ReplyMode)}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="helpful">Helpful</SelectItem>
            <SelectItem value="experience">Experience</SelectItem>
            <SelectItem value="subtle">Subtle</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="mr-1 h-3 w-3" />
          )}
          {generating ? 'Generating...' : 'Generate'}
        </Button>
      </div>

      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="AI-generated reply will appear here. You can edit it before copying."
        className="min-h-[100px] text-sm"
      />

      {draft && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={handleCopyAndOpen}
          >
            <Copy className="mr-1 h-3 w-3" />
            Copy & Open Thread
          </Button>
          <a
            href={`https://reddit.com${permalink}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="ghost" size="sm" className="h-8 text-xs">
              <ExternalLink className="mr-1 h-3 w-3" />
              View Thread
            </Button>
          </a>
        </div>
      )}
    </motion.div>
  );
}
