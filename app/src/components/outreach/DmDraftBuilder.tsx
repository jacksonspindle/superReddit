'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, ExternalLink, Sparkles, Check, X, Send } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { scaleFadeVariants } from '@/lib/motion';
import { toast } from 'sonner';
import { useRedditBridge } from '@/hooks/useRedditBridge';
import type { DmTemplate } from '@/types';

interface DmDraftBuilderProps {
  dmId: string;
  projectId: string;
  username: string;
  onSent?: (followUpDays: number | null) => void;
}

export function DmDraftBuilder({ dmId, projectId, username, onSent }: DmDraftBuilderProps) {
  const [templateId, setTemplateId] = useState<string>('none');
  const [templates, setTemplates] = useState<DmTemplate[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [generating, setGenerating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [followUpDays, setFollowUpDays] = useState<string>('3');
  const { prepareDraft } = useRedditBridge();

  // Fetch templates
  useEffect(() => {
    fetch('/api/outreach/dms/templates')
      .then((res) => res.json())
      .then((json) => {
        if (json.templates) setTemplates(json.templates);
      })
      .catch(() => {});
  }, []);

  // Tab-return confirmation via visibilitychange
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'visible' && showConfirm === false && body) {
      setShowConfirm(true);
    }
  }, [showConfirm, body]);

  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [handleVisibilityChange]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch('/api/ai/dm-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dm_id: dmId,
          project_id: projectId,
          template_id: templateId !== 'none' ? templateId : undefined,
        }),
      });

      const json = await res.json();
      if (json.error) {
        toast.error(json.error);
      } else {
        setSubject(json.subject || '');
        setBody(json.body || '');
        toast.success('DM draft generated');
      }
    } catch {
      toast.error('Failed to generate DM draft');
    }
    setGenerating(false);
  }

  async function handleCopyAndOpen() {
    // Tell extension not to auto-send on the compose page
    await prepareDraft();

    try {
      await navigator.clipboard.writeText(body);
    } catch { /* silent */ }

    const sub = subject || body.slice(0, 60).split('\n')[0];
    const composeUrl = `https://www.reddit.com/message/compose/?to=${encodeURIComponent(username)}&subject=${encodeURIComponent(sub)}&message=${encodeURIComponent(body)}`;
    window.open(composeUrl, '_blank');
  }

  async function handleConfirmSent() {
    const days = followUpDays === 'none' ? null : parseInt(followUpDays);

    try {
      await fetch('/api/outreach/dms/sent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dm_id: dmId,
          dm_content: body,
          follow_up_days: days,
        }),
      });
      toast.success('DM marked as sent');
      onSent?.(days);
    } catch {
      toast.error('Failed to update DM status');
    }
    setShowConfirm(false);
  }

  return (
    <motion.div
      variants={scaleFadeVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="mt-3 space-y-3 rounded-lg border bg-muted/30 p-3"
    >
      {/* Template selector + Generate button */}
      <div className="flex items-center gap-2">
        <Select value={templateId} onValueChange={setTemplateId}>
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue placeholder="Template..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No template</SelectItem>
            {templates.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
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
          {generating ? 'Generating...' : 'Generate DM'}
        </Button>
      </div>

      {/* Subject field */}
      <Input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Subject line..."
        className="text-sm h-8"
      />

      {/* Body field */}
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="DM body will appear here. You can edit before sending."
        className="min-h-[100px] text-sm"
      />

      {/* Actions */}
      {(subject || body) && !showConfirm && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={handleCopyAndOpen}
          >
            <Send className="mr-1 h-3 w-3" />
            Send on Reddit
          </Button>
          <a
            href={`https://www.reddit.com/user/${username}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="ghost" size="sm" className="h-8 text-xs">
              <ExternalLink className="mr-1 h-3 w-3" />
              u/{username}
            </Button>
          </a>
        </div>
      )}

      {/* Tab-return confirmation */}
      {showConfirm && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950 p-2"
        >
          <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
            Did you send the DM?
          </span>
          <div className="ml-auto flex items-center gap-1">
            <Select value={followUpDays} onValueChange={setFollowUpDays}>
              <SelectTrigger className="h-6 w-24 text-[10px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 day</SelectItem>
                <SelectItem value="3">3 days</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="none">No follow-up</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="h-6 text-[10px] px-2"
              onClick={handleConfirmSent}
            >
              <Check className="mr-1 h-3 w-3" />
              Yes, sent
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] px-2"
              onClick={() => setShowConfirm(false)}
            >
              <X className="mr-1 h-3 w-3" />
              Not yet
            </Button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
