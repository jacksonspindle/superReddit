'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import {
  Scissors, X, Loader2, Copy, Save, RefreshCw, Check,
  Plus, ArrowRight, ChevronUp, ChevronDown, Settings,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useProject } from '@/contexts/project-context';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { PageTransition } from '@/components/motion';
import { useBookmarkStore } from '@/stores/bookmark-store';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { SpliceRequest, SpliceResponse, Bookmark } from '@/types';

interface SelectedPost {
  id: string;
  title: string;
  body: string | null;
  score: number;
  subreddit: string;
  numComments: number;
}

type ToneOption = 'casual' | 'professional' | 'edgy';
type LengthOption = 'short' | 'medium' | 'long';

export default function SplicerPage() {
  const { project } = useProject();
  const { bookmarks, loading: bookmarksLoading, fetchBookmarks } = useBookmarkStore();

  // Selection state
  const [selectedPosts, setSelectedPosts] = useState<SelectedPost[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [fetchingUrl, setFetchingUrl] = useState(false);

  // Controls state
  const [tone, setTone] = useState<ToneOption>('casual');
  const [length, setLength] = useState<LengthOption>('medium');
  const [targetSubreddit, setTargetSubreddit] = useState('');
  const [additionalPrompt, setAdditionalPrompt] = useState('');

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [output, setOutput] = useState<SpliceResponse | null>(null);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedBody, setEditedBody] = useState('');
  const [regenDirections, setRegenDirections] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // UI state
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [subredditPickerOpen, setSubredditPickerOpen] = useState(true);
  const [subredditSearch, setSubredditSearch] = useState('');
  const [projectSubreddits, setProjectSubreddits] = useState<string[]>([]);

  // Combine project subreddits + unique bookmark subreddits for the picker
  const subredditOptions = useMemo(() => {
    const bookmarkSubs = new Set(bookmarks.map((b) => b.subreddit));
    const all = new Set([...projectSubreddits, ...bookmarkSubs]);
    return Array.from(all).sort();
  }, [projectSubreddits, bookmarks]);

  const filteredSubreddits = useMemo(() => {
    if (!subredditSearch) return subredditOptions;
    return subredditOptions.filter((s) =>
      s.toLowerCase().includes(subredditSearch.toLowerCase())
    );
  }, [subredditOptions, subredditSearch]);

  useEffect(() => {
    fetchBookmarks();
    async function loadProjectSubreddits() {
      const supabase = createClient();
      const { data } = await supabase
        .from('subreddits')
        .select('name')
        .eq('project_id', project.id);
      if (data) setProjectSubreddits(data.map((s) => s.name));
    }
    loadProjectSubreddits();
  }, []);

  useEffect(() => {
    if (output) {
      setEditedTitle(output.title);
      setEditedBody(output.body);
    }
  }, [output]);

  function isSelectedInOtherSlot(bookmark: Bookmark) {
    return selectedPosts.some(
      (p, i) => p.id === bookmark.reddit_id && i !== pickerSlot
    );
  }

  function handlePickerSelect(bookmark: Bookmark) {
    if (pickerSlot === null) return;
    if (isSelectedInOtherSlot(bookmark)) {
      toast.error('This post is already selected');
      return;
    }

    const newPost: SelectedPost = {
      id: bookmark.reddit_id,
      title: bookmark.title,
      body: bookmark.body,
      score: bookmark.score,
      subreddit: bookmark.subreddit,
      numComments: bookmark.num_comments,
    };

    setSelectedPosts((prev) => {
      const next = [...prev];
      if (pickerSlot < prev.length) {
        next[pickerSlot] = newPost;
      } else {
        next.push(newPost);
      }
      return next;
    });
    setPickerSlot(null);
  }

  function removePost(id: string) {
    setSelectedPosts((prev) => prev.filter((p) => p.id !== id));
  }

  async function fetchFromUrl() {
    const url = urlInput.trim();
    if (!url) return;

    const redditUrlMatch = url.match(
      /(?:https?:\/\/)?(?:www\.)?(?:old\.)?reddit\.com(\/r\/\w+\/comments\/\w+)/
    );
    if (!redditUrlMatch) {
      toast.error('Invalid Reddit URL. Paste a link to a Reddit post.');
      return;
    }

    if (selectedPosts.length >= 2 && (pickerSlot === null || pickerSlot >= selectedPosts.length)) {
      toast.error('Maximum 2 posts allowed');
      return;
    }

    setFetchingUrl(true);
    try {
      const jsonUrl = `https://www.reddit.com${redditUrlMatch[1]}.json`;
      const res = await fetch(jsonUrl, {
        headers: { 'User-Agent': 'SuperReddit/1.0' },
      });

      if (!res.ok) throw new Error('Failed to fetch post');

      const data = await res.json();
      const post = data[0]?.data?.children?.[0]?.data;
      if (!post) throw new Error('Could not parse post data');

      const duplicateIndex = selectedPosts.findIndex((p) => p.id === post.id);
      if (duplicateIndex !== -1 && duplicateIndex !== pickerSlot) {
        toast.error('This post is already selected');
        setFetchingUrl(false);
        return;
      }

      const newPost: SelectedPost = {
        id: post.id,
        title: post.title,
        body: post.selftext || null,
        score: post.score,
        subreddit: post.subreddit,
        numComments: post.num_comments,
      };

      setSelectedPosts((prev) => {
        const next = [...prev];
        if (pickerSlot !== null && pickerSlot < prev.length) {
          next[pickerSlot] = newPost;
        } else {
          next.push(newPost);
        }
        return next;
      });
      setUrlInput('');
      if (pickerSlot !== null) setPickerSlot(null);
      toast.success('Post added!');
    } catch {
      toast.error('Failed to fetch post. Check the URL and try again.');
    }
    setFetchingUrl(false);
  }

  async function handleGenerate(directions?: string) {
    if (selectedPosts.length === 0) {
      toast.error('Select at least one post');
      return;
    }
    if (!targetSubreddit.trim()) {
      toast.error('Enter a target subreddit');
      return;
    }

    setGenerating(true);
    setOutput(null);

    const combinedPrompt = [additionalPrompt, directions].filter(Boolean).join('\n\n');

    const requestBody: SpliceRequest = {
      selectedPosts: selectedPosts.map((p) => ({
        title: p.title,
        body: p.body,
        score: p.score,
        subreddit: p.subreddit,
        numComments: p.numComments,
      })),
      productContext: {
        name: project.product_name,
        description: project.product_description,
        url: project.product_url || undefined,
        audience: project.target_audience || undefined,
        tone: project.tone,
      },
      controls: {
        tone,
        length,
        targetSubreddit: targetSubreddit.trim().replace(/^r\//, ''),
        additionalPrompt: combinedPrompt || undefined,
      },
    };

    try {
      const res = await fetch('/api/ai/splice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Generation failed');
      }

      const data: SpliceResponse = await res.json();
      setOutput(data);
      setRegenDirections('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate. Try again.');
    }
    setGenerating(false);
  }

  async function handleCopy() {
    const text = `${editedTitle}\n\n${editedBody}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('generated_posts').insert({
        project_id: project.id,
        title: editedTitle,
        body: editedBody,
        tone: tone,
        strategy_note: `Spliced from ${selectedPosts.length} post(s)`,
        status: 'draft',
        based_on_post_ids: selectedPosts.map((p) => p.id),
      });

      if (error) throw error;
      toast.success('Saved to project drafts!');
    } catch {
      toast.error('Failed to save. Try again.');
    }
    setSaving(false);
  }

  function handleRegenerate() {
    handleGenerate(regenDirections);
  }

  const canGenerate = selectedPosts.length > 0 && !!targetSubreddit.trim() && !generating;

  return (
    <PageTransition>
      <div className="flex h-full flex-col">
        <Header title="Splicer" />

        {/* Subreddit indicator bar */}
        {targetSubreddit && (
          <div className="flex items-center gap-2 border-b px-6 py-2">
            <span className="text-sm text-muted-foreground">Posting to</span>
            <span className="text-sm font-medium">r/{targetSubreddit}</span>
            <button
              className="text-xs text-primary hover:underline ml-1"
              onClick={() => {
                setSubredditSearch('');
                setSubredditPickerOpen(true);
              }}
            >
              Change
            </button>
          </div>
        )}

        {/* Main visual splice flow */}
        <div className="flex flex-1 items-center justify-center gap-10 overflow-hidden px-8">
          {/* Source Slots */}
          <div className="flex flex-col items-center">
            {[0, 1].map((slotIndex) => (
              <Fragment key={slotIndex}>
                {slotIndex > 0 && (
                  <div className="py-1.5">
                    <span className="text-xl font-bold text-green-500">+</span>
                  </div>
                )}
                {selectedPosts[slotIndex] ? (
                  <div
                    className="relative w-52 cursor-pointer rounded-xl border bg-card p-3 shadow-sm transition-all hover:border-primary hover:shadow-md"
                    onClick={() => setPickerSlot(slotIndex)}
                  >
                    <button
                      className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-destructive hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        removePost(selectedPosts[slotIndex].id);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <p className="text-sm font-medium truncate">
                      {selectedPosts[slotIndex].title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      r/{selectedPosts[slotIndex].subreddit} · {selectedPosts[slotIndex].score} pts
                    </p>
                  </div>
                ) : (
                  <div
                    className="flex w-52 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed p-6 text-muted-foreground transition-all hover:border-primary hover:text-primary"
                    onClick={() => setPickerSlot(slotIndex)}
                  >
                    <Plus className="h-6 w-6" />
                    <span className="text-xs font-medium">Add post</span>
                  </div>
                )}
              </Fragment>
            ))}
          </div>

          {/* Arrow Generate Button */}
          <div className="flex flex-col items-center gap-2">
            <motion.button
              className={cn(
                'flex h-16 w-16 items-center justify-center rounded-full transition-colors',
                canGenerate
                  ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
                  : 'bg-muted/50 text-muted-foreground/30 cursor-not-allowed'
              )}
              disabled={!canGenerate}
              onClick={() => handleGenerate()}
              animate={
                canGenerate && !generating
                  ? {
                      scale: [1, 1.08, 1],
                      boxShadow: [
                        '0 0 0 0 rgba(34,197,94,0)',
                        '0 0 0 8px rgba(34,197,94,0.15)',
                        '0 0 0 0 rgba(34,197,94,0)',
                      ],
                    }
                  : {}
              }
              transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
            >
              {generating ? (
                <Loader2 className="h-7 w-7 animate-spin" />
              ) : (
                <ArrowRight className="h-7 w-7" />
              )}
            </motion.button>
            <span className="text-xs font-medium text-muted-foreground">
              {generating ? 'Splicing...' : 'Splice'}
            </span>
          </div>

          {/* Output Card */}
          <div className="w-[380px] shrink-0">
            {output ? (
              <Card className="border-orange-500/40 shadow-md">
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Generated Post</h3>
                    <div className="flex gap-1">
                      <Button variant="outline" size="xs" onClick={handleCopy}>
                        {copied ? (
                          <Check className="h-3 w-3 mr-1" />
                        ) : (
                          <Copy className="h-3 w-3 mr-1" />
                        )}
                        {copied ? 'Copied' : 'Copy'}
                      </Button>
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={handleSave}
                        disabled={saving}
                      >
                        {saving ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <Save className="h-3 w-3 mr-1" />
                        )}
                        Save
                      </Button>
                    </div>
                  </div>

                  <Input
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    placeholder="Title"
                    className="font-medium"
                  />
                  <Textarea
                    value={editedBody}
                    onChange={(e) => setEditedBody(e.target.value)}
                    rows={10}
                    className="font-mono text-sm"
                  />

                  <div className="border-t pt-3 space-y-2">
                    <Textarea
                      value={regenDirections}
                      onChange={(e) => setRegenDirections(e.target.value)}
                      placeholder="Directions for regeneration..."
                      rows={2}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={generating}
                      onClick={handleRegenerate}
                    >
                      {generating ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <RefreshCw className="h-3 w-3 mr-1" />
                      )}
                      Regenerate
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="flex h-72 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-muted-foreground">
                <Scissors className="h-8 w-8 opacity-30" />
                <p className="text-sm">Your spliced post will appear here</p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Settings Panel */}
        <div className="border-t bg-card/50">
          <button
            className="flex w-full items-center justify-between px-6 py-2.5 text-sm hover:bg-accent/50 transition-colors"
            onClick={() => setSettingsOpen(!settingsOpen)}
          >
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Settings</span>
              {!settingsOpen && (
                <span className="text-xs text-muted-foreground ml-1">
                  {tone} · {length}
                </span>
              )}
            </div>
            {settingsOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          <AnimatePresence>
            {settingsOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-6 pb-4 space-y-3">
                  <div className="flex items-end gap-4">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                        Tone
                      </label>
                      <div className="flex gap-1">
                        {(['casual', 'professional', 'edgy'] as const).map((t) => (
                          <Button
                            key={t}
                            variant={tone === t ? 'default' : 'outline'}
                            size="xs"
                            className="capitalize"
                            onClick={() => setTone(t)}
                          >
                            {t}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                        Length
                      </label>
                      <div className="flex gap-1">
                        {(['short', 'medium', 'long'] as const).map((l) => (
                          <Button
                            key={l}
                            variant={length === l ? 'default' : 'outline'}
                            size="xs"
                            className="capitalize"
                            onClick={() => setLength(l)}
                          >
                            {l}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      Additional Directions (optional)
                    </label>
                    <Textarea
                      value={additionalPrompt}
                      onChange={(e) => setAdditionalPrompt(e.target.value)}
                      placeholder="e.g. Focus on the free tier, mention a specific use case..."
                      rows={2}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Subreddit Picker Modal */}
      <Dialog
        open={subredditPickerOpen}
        onOpenChange={(open) => {
          // Only allow closing if a subreddit is already selected
          if (!open && targetSubreddit) {
            setSubredditPickerOpen(false);
            setSubredditSearch('');
          }
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={!!targetSubreddit}>
          <DialogHeader>
            <DialogTitle>Where are you posting?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Choose which subreddit this spliced post is for.
          </p>

          <Input
            value={subredditSearch}
            onChange={(e) => setSubredditSearch(e.target.value.replace(/^r\//, ''))}
            placeholder="Search or type a subreddit..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && subredditSearch.trim()) {
                setTargetSubreddit(subredditSearch.trim());
                setSubredditPickerOpen(false);
                setSubredditSearch('');
              }
            }}
          />

          {filteredSubreddits.length > 0 && (
            <div className="max-h-64 overflow-auto space-y-1">
              <p className="text-xs font-medium text-muted-foreground mb-1">Your subreddits</p>
              {filteredSubreddits.map((sub) => (
                <button
                  key={sub}
                  className={cn(
                    'flex w-full items-center rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-accent',
                    targetSubreddit === sub && 'bg-accent font-medium'
                  )}
                  onClick={() => {
                    setTargetSubreddit(sub);
                    setSubredditPickerOpen(false);
                    setSubredditSearch('');
                  }}
                >
                  r/{sub}
                </button>
              ))}
            </div>
          )}

          {subredditSearch.trim() && !subredditOptions.includes(subredditSearch.trim()) && (
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                setTargetSubreddit(subredditSearch.trim());
                setSubredditPickerOpen(false);
                setSubredditSearch('');
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Use r/{subredditSearch.trim()}
            </Button>
          )}
        </DialogContent>
      </Dialog>

      {/* Post Picker Dialog */}
      <Dialog
        open={pickerSlot !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPickerSlot(null);
            setUrlInput('');
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Choose a post</DialogTitle>
          </DialogHeader>

          <div className="flex gap-2">
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchFromUrl()}
              placeholder="Paste a Reddit URL..."
              disabled={fetchingUrl}
            />
            <Button
              onClick={fetchFromUrl}
              disabled={fetchingUrl || !urlInput.trim()}
              size="sm"
            >
              {fetchingUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Fetch'}
            </Button>
          </div>

          <div className="max-h-[400px] overflow-auto space-y-2">
            {bookmarksLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : bookmarks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No bookmarks yet. Bookmark posts from Inspiration to use them here.
              </p>
            ) : (
              bookmarks.map((bookmark) => {
                const disabled = isSelectedInOtherSlot(bookmark);
                return (
                  <div
                    key={bookmark.id}
                    className={cn(
                      'rounded-lg border p-3 transition-colors',
                      disabled
                        ? 'opacity-40 cursor-not-allowed'
                        : 'cursor-pointer hover:border-primary hover:bg-accent/50'
                    )}
                    onClick={() => !disabled && handlePickerSelect(bookmark)}
                  >
                    <p className="text-sm font-medium line-clamp-2">{bookmark.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      r/{bookmark.subreddit} · {bookmark.score} pts · {bookmark.num_comments}{' '}
                      comments
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
