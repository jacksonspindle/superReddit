'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Copy, Save, X, ImagePlus, Link2, Video, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useCreateStore } from '@/stores/create-store';
import type { PostImage } from '@/stores/create-store';
import { useProject } from '@/contexts/project-context';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export function PostEditor() {
  const { project } = useProject();
  const {
    title, body, targetSubreddit, tone, referencePosts, draftId,
    images, linkUrl,
    setTitle, setBody, setTargetSubreddit, setDraftId,
    setLinkUrl, addImages, removeImage,
    removeReference,
  } = useCreateStore();

  const [trackedSubs, setTrackedSubs] = useState<string[]>([]);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [subDropdownOpen, setSubDropdownOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const subInputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('subreddits')
      .select('name')
      .eq('project_id', project.id)
      .then(({ data }) => {
        if (data) setTrackedSubs(data.map((s) => s.name));
      });
  }, [project.id]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (subInputRef.current && !subInputRef.current.contains(e.target as Node)) {
        setSubDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredSubs = trackedSubs.filter((s) =>
    s.toLowerCase().includes(targetSubreddit.toLowerCase().replace(/^r\//, ''))
  );

  const processFiles = useCallback((files: FileList | File[]) => {
    const newImages: PostImage[] = [];
    const fileArray = Array.from(files);
    let processed = 0;

    fileArray.forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => {
        newImages.push({
          id: crypto.randomUUID(),
          dataUrl: reader.result as string,
          name: file.name,
        });
        processed++;
        if (processed === fileArray.filter((f) => f.type.startsWith('image/')).length) {
          addImages(newImages);
        }
      };
      reader.readAsDataURL(file);
    });
  }, [addImages]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) processFiles(e.target.files);
    e.target.value = '';
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    if (e.dataTransfer.files?.length) {
      processFiles(e.dataTransfer.files);
    }
  }

  async function handleCopy() {
    let text = `${title}\n\n${body}`;
    if (linkUrl) text += `\n\n${linkUrl}`;
    await navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  }

  async function handleSaveDraft() {
    const supabase = createClient();

    const imagesJson = images.map((img) => ({ id: img.id, dataUrl: img.dataUrl, name: img.name }));

    if (draftId) {
      const { error } = await supabase
        .from('generated_posts')
        .update({
          title,
          body,
          tone,
          images: imagesJson,
          link_url: linkUrl || null,
          based_on_post_ids: referencePosts.map((r) => r.id),
          updated_at: new Date().toISOString(),
        })
        .eq('id', draftId);

      if (error) {
        toast.error('Failed to update draft');
        return;
      }
      toast.success('Draft updated');
    } else {
      const { data, error } = await supabase
        .from('generated_posts')
        .insert({
          project_id: project.id,
          title,
          body,
          tone,
          images: imagesJson,
          link_url: linkUrl || null,
          status: 'draft',
          based_on_post_ids: referencePosts.map((r) => r.id),
        })
        .select()
        .single();

      if (error) {
        toast.error('Failed to save draft');
        return;
      }
      if (data) setDraftId(data.id);
      toast.success('Draft saved');
    }
  }

  function sendToExtension<T = unknown>(type: string, data?: Record<string, unknown>, timeoutMs = 5000): Promise<T | null> {
    return new Promise((resolve) => {
      const requestId = `sr_post_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const timer = setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve(null);
      }, timeoutMs);

      function handler(event: MessageEvent) {
        if (event.source !== window) return;
        if (!event.data || event.data.source !== 'superreddit-extension') return;
        if (event.data.requestId !== requestId) return;

        window.removeEventListener('message', handler);
        clearTimeout(timer);

        if (event.data.error) {
          resolve(null);
        } else {
          resolve(event.data.data as T);
        }
      }

      window.addEventListener('message', handler);

      const msg: Record<string, unknown> = { target: 'superreddit-extension', type, requestId };
      if (data) msg.data = data;
      window.postMessage(msg, '*');
    });
  }

  async function handlePostToReddit() {
    const sub = targetSubreddit.replace(/^r\//, '').trim();
    if (!sub) {
      toast.error('Enter a target subreddit first');
      return;
    }

    let postBody = body;
    if (linkUrl) postBody += `\n\n${linkUrl}`;

    // Try extension-powered post (auto-fills title, body, AND images on new Reddit)
    const result = await sendToExtension<{ success: boolean }>('PREPARE_POST', {
      subreddit: sub,
      title,
      body: postBody,
      images: images.map((img) => ({ dataUrl: img.dataUrl, name: img.name })),
    });

    if (result?.success) {
      toast.success('Opening Reddit — fields will be auto-filled', { duration: 3000 });
      return;
    }

    // Fallback: old.reddit.com URL params (title + body only, no images)
    const params = new URLSearchParams({
      selftext: 'true',
      title,
      text: postBody,
    });
    window.open(`https://old.reddit.com/r/${encodeURIComponent(sub)}/submit?${params.toString()}`, '_blank');

    if (images.length > 0) {
      toast.info('Install the SuperReddit extension to auto-fill images', { duration: 5000 });
    }
  }

  return (
    <div
      ref={dropZoneRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col h-full overflow-auto p-4 space-y-3 relative ${dragging ? 'ring-2 ring-orange-500 ring-inset bg-orange-500/5' : ''}`}
    >
      {/* Drag overlay */}
      {dragging && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 pointer-events-none">
          <div className="flex flex-col items-center gap-2">
            <ImagePlus className="h-8 w-8 text-orange-500" />
            <span className="text-sm font-medium text-orange-500">Drop images here</span>
          </div>
        </div>
      )}

      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Post title..."
        className="text-base font-semibold h-10"
      />

      <div ref={subInputRef} className="relative">
        <Input
          value={targetSubreddit}
          onChange={(e) => { setTargetSubreddit(e.target.value); setSubDropdownOpen(true); }}
          onFocus={() => setSubDropdownOpen(true)}
          placeholder="Target subreddit..."
          className="h-8 text-xs"
        />
        {subDropdownOpen && filteredSubs.length > 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover p-1 shadow-md">
            {filteredSubs.map((s) => (
              <button
                key={s}
                onClick={() => { setTargetSubreddit(s); setSubDropdownOpen(false); }}
                className="flex w-full items-center rounded-sm px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                r/{s}
              </button>
            ))}
          </div>
        )}
      </div>

      {referencePosts.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {referencePosts.map((ref) => (
            <Badge key={ref.id} variant="secondary" className="text-[10px] gap-1 pr-1">
              <span className="max-w-[160px] truncate">{ref.title}</span>
              <button
                onClick={() => removeReference(ref.id)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your post body, or use the chat below to generate one..."
        className="flex-1 min-h-[120px] text-xs resize-none"
      />

      {/* Image previews */}
      {images.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {images.map((img) => (
            <div key={img.id} className="relative group">
              <img
                src={img.dataUrl}
                alt={img.name}
                className="h-20 w-20 rounded-lg object-cover border"
              />
              <button
                onClick={() => removeImage(img.id)}
                className="absolute -top-1.5 -right-1.5 rounded-full bg-muted border p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground hover:border-destructive"
              >
                <X className="h-2.5 w-2.5" />
              </button>
              <span className="absolute bottom-0.5 left-0.5 right-0.5 text-[8px] text-white bg-black/60 rounded px-1 truncate">
                {img.name}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Link input */}
      {showLinkInput && (
        <div className="flex gap-2 items-center">
          <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="Paste a URL..."
            className="h-8 text-xs flex-1"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => { setLinkUrl(''); setShowLinkInput(false); }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center gap-1.5">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus className="h-3 w-3" />
          Image
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => setShowLinkInput(!showLinkInput)}
        >
          <Link2 className="h-3 w-3" />
          Link
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => {
            setShowLinkInput(true);
            setLinkUrl(linkUrl || '');
          }}
        >
          <Video className="h-3 w-3" />
          Video
        </Button>

        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={handleCopy} disabled={!title && !body} className="h-7 text-xs">
            <Copy className="mr-1.5 h-3 w-3" />
            Copy
          </Button>
          <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={!title && !body} className="h-7 text-xs">
            <Save className="mr-1.5 h-3 w-3" />
            Save Draft
          </Button>
          <Button
            size="sm"
            onClick={handlePostToReddit}
            disabled={!title && !body}
            className="h-7 text-xs bg-orange-500 hover:bg-orange-600 text-white"
          >
            <ExternalLink className="mr-1.5 h-3 w-3" />
            Post to Reddit
          </Button>
        </div>
      </div>
    </div>
  );
}
