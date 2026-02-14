'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Github,
  ExternalLink,
  RefreshCw,
  Star,
  Loader2,
  GitCommit,
  Lock,
  Globe,
  CheckCircle2,
  Search,
  Plus,
} from 'lucide-react';
import { useProject } from '@/contexts/project-context';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { GitHubConnection } from '@/types';

interface GitHubRepo {
  full_name: string;
  name: string;
  owner: string;
  url: string;
  description: string | null;
  language: string | null;
  stars: number;
  isPrivate: boolean;
  updated_at: string;
}

type PageState = 'loading' | 'disconnected' | 'picking' | 'connected';

export default function GitHubPage() {
  const { project } = useProject();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [connection, setConnection] = useState<GitHubConnection | null>(null);
  const [pageState, setPageState] = useState<PageState>('loading');
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [creatingProject, setCreatingProject] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');
  const [repoSearch, setRepoSearch] = useState('');

  useEffect(() => {
    async function load() {
      try {
        // 1. Check project-specific connection
        const res = await fetch(`/api/context/github/activity?projectId=${project.id}`);
        const json = await res.json();
        const conn = json.connection;

        if (conn && conn.repo_name) {
          setConnection(conn);
          setPageState('connected');
          return;
        }
        if (conn && conn.access_token) {
          setPageState('picking');
          return;
        }

        // 2. Fallback: check if user is connected globally (other project or cookie)
        const globalRes = await fetch('/api/github/user-repos');
        const globalJson = await globalRes.json();
        if (globalJson.connected) {
          // User has a GitHub token — go to repo picker
          setPageState('picking');
          return;
        }

        if (searchParams.get('oauth') === 'success') {
          setPageState('picking');
          return;
        }

        setPageState('disconnected');
      } catch {
        setPageState('disconnected');
      }
    }
    load();
  }, [project.id, searchParams]);

  // Load repos when entering the picking state
  useEffect(() => {
    if (pageState !== 'picking') return;

    async function loadRepos() {
      setReposLoading(true);
      try {
        const res = await fetch(`/api/context/github/repos?projectId=${project.id}`);
        const json = await res.json();
        if (json.repos) setRepos(json.repos);
      } catch {
        toast.error('Failed to load repositories');
      } finally {
        setReposLoading(false);
      }
    }
    loadRepos();
  }, [pageState, project.id]);

  async function handleSelectRepo(repo: GitHubRepo) {
    setConnecting(repo.full_name);
    try {
      const res = await fetch('/api/context/github/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, repoUrl: repo.url }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Failed to connect repository');
        return;
      }
      setConnection(json.connection);
      setPageState('connected');
      toast.success(`Connected ${repo.full_name}`);
    } catch {
      toast.error('Failed to connect repository');
    } finally {
      setConnecting(null);
    }
  }

  async function handleConnectPublic() {
    if (!repoUrl.trim()) {
      toast.error('Please enter a repository URL');
      return;
    }
    setConnecting('public');
    try {
      const res = await fetch('/api/context/github/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, repoUrl }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Failed to connect repository');
        return;
      }
      setConnection(json.connection);
      setPageState('connected');
      toast.success('Repository connected');
    } catch {
      toast.error('Failed to connect repository');
    } finally {
      setConnecting(null);
    }
  }

  async function handleRefresh() {
    if (!connection) return;
    setRefreshing(true);
    try {
      const res = await fetch('/api/context/github/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, repoUrl: connection.repo_url }),
      });
      const json = await res.json();
      if (res.ok) {
        setConnection(json.connection);
        toast.success('Repository data refreshed');
      }
    } catch {
      toast.error('Failed to refresh');
    } finally {
      setRefreshing(false);
    }
  }

  async function handleCreateProjectFromRepo(repo: GitHubRepo) {
    setCreatingProject(repo.full_name);
    try {
      // Get the access token from existing connection
      const activityRes = await fetch(`/api/context/github/activity?projectId=${project.id}`);
      const activityJson = await activityRes.json();
      const token = activityJson.connection?.access_token;

      // Analyze repo with AI
      toast.info('Analyzing repository...');
      const analyzeRes = await fetch('/api/github/analyze-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: repo.url, accessToken: token }),
      });
      const analysis = await analyzeRes.json();
      if (!analyzeRes.ok) {
        toast.error(analysis.error || 'Failed to analyze repository');
        return;
      }

      // Create project
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: newProject, error } = await supabase.from('projects').insert({
        user_id: user.id,
        name: `${analysis.productName} Campaign`,
        product_name: analysis.productName,
        product_description: analysis.productDescription || '',
        product_url: analysis.productUrl || repo.url,
        tone: 'Professional',
      }).select().single();

      if (error || !newProject) {
        toast.error('Failed to create project');
        return;
      }

      // Auto-connect GitHub repo to the new project
      if (token) {
        await supabase.from('github_connections').upsert({
          project_id: newProject.id,
          access_token: token,
          repo_url: '',
          owner: '',
          repo_name: '',
        }, { onConflict: 'project_id' });
      }

      await fetch('/api/context/github/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: newProject.id, repoUrl: repo.url }),
      });

      // Bootstrap: auto-discover subreddits and set up canvas
      toast.info('Finding subreddits and setting up your project...');
      await fetch('/api/projects/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: newProject.id }),
      });

      toast.success(`Created project for ${analysis.productName}`);
      router.push(`/projects/${newProject.id}`);
    } catch {
      toast.error('Failed to create project');
    } finally {
      setCreatingProject(null);
    }
  }

  // Loading
  if (pageState === 'loading') {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Disconnected — no GitHub account connected
  if (pageState === 'disconnected') {
    return (
      <div className="mx-auto max-w-2xl p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">GitHub</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect a GitHub repository to track build activity and keep context in sync.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Connect Your GitHub</CardTitle>
            <CardDescription>
              Sign in with GitHub to browse your repositories, or paste a public repo URL directly.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Button
              onClick={() => {
                window.location.href = `/api/auth/github?projectId=${project.id}`;
              }}
              className="w-full"
            >
              <Github className="mr-2 h-4 w-4" />
              Connect with GitHub
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or connect a public repo</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="repo-url">Repository URL</Label>
              <div className="flex gap-2">
                <Input
                  id="repo-url"
                  placeholder="https://github.com/owner/repo"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleConnectPublic()}
                />
                <Button
                  variant="outline"
                  onClick={handleConnectPublic}
                  disabled={connecting === 'public'}
                >
                  {connecting === 'public' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Connect'
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Picking — GitHub authenticated, choose a repo
  if (pageState === 'picking') {
    const filteredRepos = repoSearch
      ? repos.filter(
          (r) =>
            r.full_name.toLowerCase().includes(repoSearch.toLowerCase()) ||
            r.description?.toLowerCase().includes(repoSearch.toLowerCase())
        )
      : repos;

    return (
      <div className="mx-auto max-w-2xl p-6 space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <h1 className="text-2xl font-bold tracking-tight">GitHub Connected</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Choose a repository to track for this project.
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search repositories..."
            value={repoSearch}
            onChange={(e) => setRepoSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {reposLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading your repositories...</span>
          </div>
        ) : filteredRepos.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            {repoSearch ? 'No repositories match your search.' : 'No repositories found.'}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredRepos.map((repo) => (
              <Card
                key={repo.full_name}
                className={cn(
                  'cursor-pointer transition-colors hover:border-primary/50',
                  connecting === repo.full_name && 'opacity-70 pointer-events-none'
                )}
                onClick={() => !connecting && handleSelectRepo(repo)}
              >
                <CardContent className="flex items-center gap-3 py-3 px-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{repo.full_name}</p>
                      {repo.isPrivate ? (
                        <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <Globe className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      )}
                    </div>
                    {repo.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {repo.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      {repo.language && (
                        <span className="text-xs text-muted-foreground">{repo.language}</span>
                      )}
                      {repo.stars > 0 && (
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <Star className="h-3 w-3" />
                          {repo.stars}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {connecting === repo.full_name ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); handleSelectRepo(repo); }}
                      >
                        Select
                      </Button>
                    )}
                    {creatingProject === repo.full_name ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Create new project from this repo"
                        onClick={(e) => { e.stopPropagation(); handleCreateProjectFromRepo(repo); }}
                        disabled={creatingProject !== null || connecting !== null}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Connected — repo selected, show details
  if (!connection) return null;
  const commits = (connection.recent_commits || []) as GitHubConnection['recent_commits'];

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">GitHub</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tracking {connection.owner}/{connection.repo_name}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Repo info */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <Github className="h-5 w-5" />
            <div className="flex-1">
              <CardTitle className="text-base">
                <a
                  href={connection.repo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline inline-flex items-center gap-1"
                >
                  {connection.owner}/{connection.repo_name}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </CardTitle>
              {connection.description && (
                <CardDescription className="mt-1">{connection.description}</CardDescription>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {connection.language && (
              <Badge variant="secondary">{connection.language}</Badge>
            )}
            {connection.stars > 0 && (
              <Badge variant="secondary" className="gap-1">
                <Star className="h-3 w-3" />
                {connection.stars.toLocaleString()}
              </Badge>
            )}
            {connection.topics?.map((topic) => (
              <Badge key={topic} variant="outline" className="text-xs">
                {topic}
              </Badge>
            ))}
          </div>
          {connection.last_synced_at && (
            <p className="text-xs text-muted-foreground mt-3">
              Last synced: {new Date(connection.last_synced_at).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* README summary */}
      {connection.readme_summary && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">README</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm text-muted-foreground font-mono max-h-64 overflow-y-auto">
              {connection.readme_summary}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Recent commits */}
      {commits.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent Commits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {commits.map((commit, i) => (
                <div
                  key={commit.sha}
                  className="flex items-start gap-3 py-2.5 border-b last:border-0"
                >
                  <div className="mt-0.5 flex flex-col items-center">
                    <GitCommit className="h-4 w-4 text-muted-foreground" />
                    {i < commits.length - 1 && (
                      <div className="w-px flex-1 bg-border mt-1" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <a
                      href={commit.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium hover:underline truncate block"
                    >
                      {commit.message}
                    </a>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <span className="font-mono">{commit.sha}</span>
                      {' by '}
                      {commit.author}
                      {' \u00b7 '}
                      {new Date(commit.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
