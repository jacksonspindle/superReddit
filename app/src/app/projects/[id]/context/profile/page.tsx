'use client';

import { useEffect, useState } from 'react';
import {
  Loader2, Save, Plus, X, Sparkles,
  Github, ExternalLink, RefreshCw, Star, GitCommit, Lock, Globe, CheckCircle2, Search,
  Server, Terminal, ClipboardPaste,
} from 'lucide-react';
import { useProject } from '@/contexts/project-context';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { POST_STYLES } from '@/lib/data/writing-styles';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { OutreachConfig, GitHubConnection } from '@/types';

const TONE_OPTIONS = ['Adaptive', 'Engaging', 'Humorous', 'Creative', 'Sarcastic', 'Inspirational', 'Concise'];

export default function ProfilePage() {
  const { project, refreshProject } = useProject();
  const [outreachConfig, setOutreachConfig] = useState<OutreachConfig | null>(null);
  const [loadingOutreach, setLoadingOutreach] = useState(true);

  // Project fields
  const [productName, setProductName] = useState(project.product_name);
  const [productDescription, setProductDescription] = useState(project.product_description);
  const [productUrl, setProductUrl] = useState(project.product_url || '');
  const [targetAudience, setTargetAudience] = useState(project.target_audience || '');
  const [tone, setTone] = useState(project.tone);
  const [writingStyles, setWritingStyles] = useState<Set<string>>(new Set(project.writing_styles));

  // Outreach fields
  const [keywords, setKeywords] = useState<string[]>([]);
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [redditUsername, setRedditUsername] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [competitorInput, setCompetitorInput] = useState('');

  // AI generation
  const [generatingKeywords, setGeneratingKeywords] = useState(false);

  // GitHub state
  const [ghConnection, setGhConnection] = useState<GitHubConnection | null>(null);
  const [ghLoading, setGhLoading] = useState(true);
  const [ghRefreshing, setGhRefreshing] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');
  const [ghConnecting, setGhConnecting] = useState(false);

  // Saving states
  const [savingProduct, setSavingProduct] = useState(false);
  const [savingAudience, setSavingAudience] = useState(false);
  const [savingStyles, setSavingStyles] = useState(false);
  const [savingKeywords, setSavingKeywords] = useState(false);
  const [savingOutreach, setSavingOutreach] = useState(false);

  useEffect(() => {
    async function loadGitHub() {
      try {
        const res = await fetch(`/api/context/github/activity?projectId=${project.id}`);
        const json = await res.json();
        if (json.connection?.repo_name) setGhConnection(json.connection);
      } catch { /* no connection */ }
      finally { setGhLoading(false); }
    }
    loadGitHub();
  }, [project.id]);

  useEffect(() => {
    async function loadOutreach() {
      try {
        const res = await fetch(`/api/outreach/config?project_id=${project.id}`);
        const json = await res.json();
        if (json.config) {
          setOutreachConfig(json.config);
          setKeywords(json.config.keywords || []);
          setCompetitors(json.config.competitors || []);
          setRedditUsername(json.config.reddit_username || '');
        }
      } catch {
        // No config yet
      } finally {
        setLoadingOutreach(false);
      }
    }
    loadOutreach();
  }, [project.id]);

  async function saveProjectFields(fields: Record<string, unknown>, setLoading: (v: boolean) => void) {
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('projects')
        .update(fields)
        .eq('id', project.id);
      if (error) throw error;
      await refreshProject();
      toast.success('Saved');
    } catch {
      toast.error('Failed to save');
    } finally {
      setLoading(false);
    }
  }

  async function saveOutreachFields(fields: Record<string, unknown>, setLoading: (v: boolean) => void) {
    setLoading(true);
    try {
      const res = await fetch('/api/context/outreach', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: project.id, ...fields }),
      });
      if (!res.ok) throw new Error();
      toast.success('Saved');
    } catch {
      toast.error('Failed to save');
    } finally {
      setLoading(false);
    }
  }

  async function handleConnectRepo() {
    if (!repoUrl.trim()) { toast.error('Enter a repository URL'); return; }
    setGhConnecting(true);
    try {
      const res = await fetch('/api/context/github/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, repoUrl }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || 'Failed to connect'); return; }
      setGhConnection(json.connection);
      toast.success('Repository connected');
    } catch { toast.error('Failed to connect'); }
    finally { setGhConnecting(false); }
  }

  async function handleRefreshRepo() {
    if (!ghConnection) return;
    setGhRefreshing(true);
    try {
      const res = await fetch('/api/context/github/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, repoUrl: ghConnection.repo_url }),
      });
      const json = await res.json();
      if (res.ok) { setGhConnection(json.connection); toast.success('Refreshed'); }
    } catch { toast.error('Failed to refresh'); }
    finally { setGhRefreshing(false); }
  }

  async function handleGenerateKeywords() {
    setGeneratingKeywords(true);
    try {
      const res = await fetch('/api/outreach/keywords/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: project.product_name,
          productDescription: project.product_description,
          targetAudience: project.target_audience,
        }),
      });

      const json = await res.json();
      if (json.error) {
        toast.error(json.error);
      } else {
        setKeywords(json.keywords || []);
        toast.success(`Generated ${json.keywords?.length || 0} keywords`);
      }
    } catch {
      toast.error('Failed to generate keywords');
    }
    setGeneratingKeywords(false);
  }

  function addKeyword() {
    const val = keywordInput.trim();
    if (val && !keywords.includes(val)) {
      setKeywords([...keywords, val]);
    }
    setKeywordInput('');
  }

  function removeKeyword(kw: string) {
    setKeywords(keywords.filter((k) => k !== kw));
  }

  function addCompetitor() {
    const val = competitorInput.trim();
    if (val && !competitors.includes(val)) {
      setCompetitors([...competitors, val]);
    }
    setCompetitorInput('');
  }

  function removeCompetitor(c: string) {
    setCompetitors(competitors.filter((x) => x !== c));
  }

  function toggleStyle(id: string) {
    const next = new Set(writingStyles);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setWritingStyles(next);
  }

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your product context. This data shapes all AI-generated content.
        </p>
      </div>

      {/* Product Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Product Info</CardTitle>
          <CardDescription>Basic information about your product.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="product-name">Product Name</Label>
            <Input
              id="product-name"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-description">Description</Label>
            <Textarea
              id="product-description"
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-url">Product URL</Label>
            <Input
              id="product-url"
              value={productUrl}
              onChange={(e) => setProductUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <Button
            size="sm"
            onClick={() =>
              saveProjectFields(
                {
                  product_name: productName,
                  product_description: productDescription,
                  product_url: productUrl || null,
                },
                setSavingProduct
              )
            }
            disabled={savingProduct}
          >
            {savingProduct ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save
          </Button>
        </CardContent>
      </Card>

      {/* Audience & Tone */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audience & Tone</CardTitle>
          <CardDescription>Who you're targeting and your voice.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="target-audience">Target Audience</Label>
            <Textarea
              id="target-audience"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              rows={2}
              placeholder="e.g. Indie hackers, SaaS founders, small dev teams..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tone">Tone</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONE_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            onClick={() =>
              saveProjectFields(
                { target_audience: targetAudience || null, tone },
                setSavingAudience
              )
            }
            disabled={savingAudience}
          >
            {savingAudience ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save
          </Button>
        </CardContent>
      </Card>

      {/* Writing Styles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Writing Styles</CardTitle>
          <CardDescription>
            Select the Reddit post styles that match your voice. These guide AI generation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {POST_STYLES.map((style) => {
              const selected = writingStyles.has(style.id);
              return (
                <button
                  key={style.id}
                  onClick={() => toggleStyle(style.id)}
                  className={cn(
                    'rounded-lg border p-3 text-left transition-colors',
                    selected
                      ? 'border-orange-500 bg-orange-500/5'
                      : 'border-border hover:border-muted-foreground/30'
                  )}
                >
                  <p className={cn('text-sm font-medium', selected && 'text-orange-600')}>
                    {style.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{style.description}</p>
                </button>
              );
            })}
          </div>
          <Button
            size="sm"
            onClick={() =>
              saveProjectFields({ writing_styles: Array.from(writingStyles) }, setSavingStyles)
            }
            disabled={savingStyles}
          >
            {savingStyles ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save
          </Button>
        </CardContent>
      </Card>

      {/* Outreach Keywords */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Outreach Keywords</CardTitle>
          <CardDescription>
            Keywords used to find relevant Reddit conversations for outreach.
            At least one keyword is required for signal detection.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingOutreach ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleGenerateKeywords}
                disabled={generatingKeywords}
                className="w-full"
              >
                {generatingKeywords ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                {generatingKeywords
                  ? 'Generating...'
                  : keywords.length > 0
                    ? 'Regenerate Keywords'
                    : 'Generate Keywords from Product Info'}
              </Button>
              <div className="flex gap-2">
                <Input
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
                  placeholder="Add a keyword..."
                  className="flex-1"
                />
                <Button size="sm" variant="outline" onClick={addKeyword}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {keywords.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {keywords.map((kw) => (
                    <span
                      key={kw}
                      className="inline-flex items-center gap-1 rounded-full border bg-muted px-3 py-1 text-xs font-medium"
                    >
                      {kw}
                      <button
                        onClick={() => removeKeyword(kw)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <Button
                size="sm"
                onClick={() => saveOutreachFields({ keywords }, setSavingKeywords)}
                disabled={savingKeywords}
              >
                {savingKeywords ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Outreach Config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Outreach Config</CardTitle>
          <CardDescription>
            Competitors and Reddit account for outreach tracking.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingOutreach ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Competitors</Label>
                <div className="flex gap-2">
                  <Input
                    value={competitorInput}
                    onChange={(e) => setCompetitorInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addCompetitor()}
                    placeholder="Add a competitor..."
                    className="flex-1"
                  />
                  <Button size="sm" variant="outline" onClick={addCompetitor}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {competitors.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {competitors.map((c) => (
                      <span
                        key={c}
                        className="inline-flex items-center gap-1 rounded-full border bg-muted px-3 py-1 text-xs font-medium"
                      >
                        {c}
                        <button
                          onClick={() => removeCompetitor(c)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="reddit-username">Reddit Username</Label>
                <Input
                  id="reddit-username"
                  value={redditUsername}
                  onChange={(e) => setRedditUsername(e.target.value)}
                  placeholder="u/your_username"
                />
              </div>
              <Button
                size="sm"
                onClick={() =>
                  saveOutreachFields(
                    { competitors, reddit_username: redditUsername || null },
                    setSavingOutreach
                  )
                }
                disabled={savingOutreach}
              >
                {savingOutreach ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* GitHub Connection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Github className="h-5 w-5" />
              <div>
                <CardTitle className="text-base">GitHub</CardTitle>
                <CardDescription>
                  {ghConnection
                    ? `Tracking ${ghConnection.owner}/${ghConnection.repo_name}`
                    : 'Connect a repository to track build activity.'}
                </CardDescription>
              </div>
            </div>
            {ghConnection && (
              <Button variant="outline" size="sm" onClick={handleRefreshRepo} disabled={ghRefreshing}>
                <RefreshCw className={cn('mr-2 h-3.5 w-3.5', ghRefreshing && 'animate-spin')} />
                Refresh
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {ghLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading...
            </div>
          ) : ghConnection ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <a
                  href={ghConnection.repo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium hover:underline inline-flex items-center gap-1"
                >
                  {ghConnection.owner}/{ghConnection.repo_name}
                  <ExternalLink className="h-3 w-3" />
                </a>
                {ghConnection.language && <Badge variant="secondary">{ghConnection.language}</Badge>}
                {ghConnection.stars > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    <Star className="h-3 w-3" /> {ghConnection.stars.toLocaleString()}
                  </Badge>
                )}
              </div>
              {ghConnection.description && (
                <p className="text-xs text-muted-foreground">{ghConnection.description}</p>
              )}
              {((ghConnection.recent_commits || []) as GitHubConnection['recent_commits']).length > 0 && (
                <div className="space-y-1 pt-2 border-t">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Recent Commits</p>
                  {((ghConnection.recent_commits || []) as GitHubConnection['recent_commits']).slice(0, 5).map((commit) => (
                    <div key={commit.sha} className="flex items-start gap-2 py-1">
                      <GitCommit className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <a
                          href={commit.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs hover:underline truncate block"
                        >
                          {commit.message}
                        </a>
                        <p className="text-[10px] text-muted-foreground">
                          <span className="font-mono">{commit.sha}</span> by {commit.author}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => { window.location.href = `/api/auth/github?projectId=${project.id}`; }}
              >
                <Github className="mr-2 h-4 w-4" />
                Connect with GitHub
              </Button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or paste a public repo URL</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Input
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleConnectRepo()}
                  placeholder="https://github.com/owner/repo"
                  className="flex-1"
                />
                <Button variant="outline" onClick={handleConnectRepo} disabled={ghConnecting}>
                  {ghConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Connect'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Claude Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="h-4 w-4" />
            Claude Integration
          </CardTitle>
          <CardDescription>
            Connect your Claude workflow to keep product context in sync.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { icon: Server, title: 'MCP Server', badge: 'Lowest friction', description: 'Add SuperReddit as an MCP server in your Claude Code config.' },
            { icon: Terminal, title: 'CLI Sync', badge: 'Automatic', description: 'Run `npx superreddit connect` to sync build context automatically.' },
            { icon: ClipboardPaste, title: 'Manual Paste', badge: 'No setup', description: 'Paste Claude conversation summaries or CLAUDE.md content directly.' },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-3 rounded-lg border p-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 shrink-0">
                <item.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{item.title}</p>
                  <Badge variant="secondary" className="text-[10px]">{item.badge}</Badge>
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">Coming Soon</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
