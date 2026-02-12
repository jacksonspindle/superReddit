'use client';

import { useState, useEffect } from 'react';
import { Scissors, X, Link2, Loader2, Copy, Save, RefreshCw, Check } from 'lucide-react';
import { useProject } from '@/contexts/project-context';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { PageTransition } from '@/components/motion';
import { StaggerList, StaggerItem } from '@/components/motion';
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
  const project = useProject();
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

  useEffect(() => {
    fetchBookmarks();
  }, []);

  // Sync output to editable fields
  useEffect(() => {
    if (output) {
      setEditedTitle(output.title);
      setEditedBody(output.body);
    }
  }, [output]);

  function isSelected(bookmark: Bookmark) {
    return selectedPosts.some((p) => p.id === bookmark.reddit_id);
  }

  function selectBookmark(bookmark: Bookmark) {
    if (selectedPosts.length >= 3) {
      toast.error('Maximum 3 posts allowed');
      return;
    }
    if (isSelected(bookmark)) return;

    setSelectedPosts((prev) => [
      ...prev,
      {
        id: bookmark.reddit_id,
        title: bookmark.title,
        body: bookmark.body,
        score: bookmark.score,
        subreddit: bookmark.subreddit,
        numComments: bookmark.num_comments,
      },
    ]);
  }

  function removePost(id: string) {
    setSelectedPosts((prev) => prev.filter((p) => p.id !== id));
  }

  async function fetchFromUrl() {
    const url = urlInput.trim();
    if (!url) return;

    // Parse Reddit URL to get the JSON endpoint
    const redditUrlMatch = url.match(
      /(?:https?:\/\/)?(?:www\.)?(?:old\.)?reddit\.com(\/r\/\w+\/comments\/\w+)/
    );
    if (!redditUrlMatch) {
      toast.error('Invalid Reddit URL. Paste a link to a Reddit post.');
      return;
    }

    if (selectedPosts.length >= 3) {
      toast.error('Maximum 3 posts allowed');
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

      // Check for duplicate
      if (selectedPosts.some((p) => p.id === post.id)) {
        toast.error('This post is already selected');
        setFetchingUrl(false);
        return;
      }

      setSelectedPosts((prev) => [
        ...prev,
        {
          id: post.id,
          title: post.title,
          body: post.selftext || null,
          score: post.score,
          subreddit: post.subreddit,
          numComments: post.num_comments,
        },
      ]);
      setUrlInput('');
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

  const canGenerate = selectedPosts.length > 0 && targetSubreddit.trim() && !generating;

  return (
    <PageTransition>
      <div className="flex h-full flex-col">
        <Header title="Splicer" />
        <div className="flex flex-1 overflow-hidden">
          {/* Left column — Post Selection */}
          <div className="w-1/2 border-r overflow-auto p-6 space-y-6">
            {/* Selected Posts */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Scissors className="h-4 w-4" />
                  Selected Posts
                </h3>
                <span className="text-xs text-muted-foreground">
                  {selectedPosts.length}/3 posts selected
                </span>
              </div>

              {selectedPosts.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Select posts from your bookmarks or paste a Reddit URL
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedPosts.map((post) => (
                    <div
                      key={post.id}
                      className="flex items-start gap-2 rounded-lg border bg-accent/50 p-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{post.title}</p>
                        <p className="text-xs text-muted-foreground">
                          r/{post.subreddit} · {post.score} pts · {post.numComments} comments
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 shrink-0"
                        onClick={() => removePost(post.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* URL Paste */}
            <div>
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Paste Reddit URL
              </h3>
              <div className="flex gap-2">
                <Input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchFromUrl()}
                  placeholder="https://reddit.com/r/..."
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
            </div>

            {/* Bookmarks List */}
            <div>
              <h3 className="font-semibold text-sm mb-3">Your Bookmarks</h3>
              {bookmarksLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : bookmarks.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No bookmarks yet. Bookmark posts from Inspiration to use them here.
                </p>
              ) : (
                <StaggerList className="space-y-2">
                  {bookmarks.map((bookmark) => {
                    const selected = isSelected(bookmark);
                    return (
                      <StaggerItem key={bookmark.id}>
                        <div
                          className={cn(
                            'flex items-start gap-3 rounded-lg border p-3 transition-colors',
                            selected && 'border-primary bg-primary/5'
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium line-clamp-2">{bookmark.title}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              r/{bookmark.subreddit} · {bookmark.score} pts · {bookmark.num_comments} comments
                            </p>
                          </div>
                          <Button
                            variant={selected ? 'default' : 'outline'}
                            size="sm"
                            className="shrink-0 text-xs h-7"
                            disabled={!selected && selectedPosts.length >= 3}
                            onClick={() =>
                              selected
                                ? removePost(bookmark.reddit_id)
                                : selectBookmark(bookmark)
                            }
                          >
                            {selected ? (
                              <>
                                <Check className="h-3 w-3 mr-1" />
                                Selected
                              </>
                            ) : (
                              'Select'
                            )}
                          </Button>
                        </div>
                      </StaggerItem>
                    );
                  })}
                </StaggerList>
              )}
            </div>
          </div>

          {/* Right column — Controls + Output */}
          <div className="w-1/2 overflow-auto p-6 space-y-6">
            {/* AI Controls */}
            <Card>
              <CardContent className="space-y-4">
                <h3 className="font-semibold text-sm">AI Controls</h3>

                {/* Tone */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Tone
                  </label>
                  <div className="flex gap-1">
                    {(['casual', 'professional', 'edgy'] as const).map((t) => (
                      <Button
                        key={t}
                        variant={tone === t ? 'default' : 'outline'}
                        size="sm"
                        className="flex-1 text-xs capitalize"
                        onClick={() => setTone(t)}
                      >
                        {t}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Length */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Length
                  </label>
                  <div className="flex gap-1">
                    {(['short', 'medium', 'long'] as const).map((l) => (
                      <Button
                        key={l}
                        variant={length === l ? 'default' : 'outline'}
                        size="sm"
                        className="flex-1 text-xs capitalize"
                        onClick={() => setLength(l)}
                      >
                        {l}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Target Subreddit */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Target Subreddit
                  </label>
                  <Input
                    value={targetSubreddit}
                    onChange={(e) => setTargetSubreddit(e.target.value)}
                    placeholder="e.g. SaaS, startups, webdev"
                  />
                </div>

                {/* Additional Prompt */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Additional Directions (optional)
                  </label>
                  <Textarea
                    value={additionalPrompt}
                    onChange={(e) => setAdditionalPrompt(e.target.value)}
                    placeholder="e.g. Focus on the free tier, mention a specific use case..."
                    rows={3}
                  />
                </div>

                {/* Generate Button */}
                <Button
                  className="w-full"
                  disabled={!canGenerate}
                  onClick={() => handleGenerate()}
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Scissors className="h-4 w-4 mr-2" />
                      Generate Spliced Post
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Output */}
            {output && (
              <Card>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Generated Post</h3>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={handleCopy}>
                        {copied ? (
                          <Check className="h-3 w-3 mr-1" />
                        ) : (
                          <Copy className="h-3 w-3 mr-1" />
                        )}
                        {copied ? 'Copied' : 'Copy'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
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

                  {/* Editable Title */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      Title
                    </label>
                    <Input
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                    />
                  </div>

                  {/* Editable Body */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      Body
                    </label>
                    <Textarea
                      value={editedBody}
                      onChange={(e) => setEditedBody(e.target.value)}
                      rows={12}
                      className="font-mono text-sm"
                    />
                  </div>

                  {/* Regenerate */}
                  <div className="border-t pt-4 space-y-2">
                    <label className="text-xs font-medium text-muted-foreground block">
                      Regenerate with directions
                    </label>
                    <Textarea
                      value={regenDirections}
                      onChange={(e) => setRegenDirections(e.target.value)}
                      placeholder="e.g. Make it more personal, add a question at the end..."
                      rows={2}
                    />
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={generating}
                      onClick={handleRegenerate}
                    >
                      {generating ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Regenerate
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
