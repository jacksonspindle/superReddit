'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, Check, Github, Loader2, Lock, Globe, Pencil, Search, Sparkles, Star, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { scaleFadeVariants } from '@/lib/motion';

interface AnalysisResult {
  productName: string;
  productDescription: string;
  productUrl: string;
  targetAudience: string;
}

interface GitHubRepo {
  full_name: string;
  name: string;
  owner: string;
  url: string;
  description: string | null;
  language: string | null;
  stars: number;
  isPrivate: boolean;
}

interface ProductStepProps {
  productName: string;
  productDescription: string;
  productUrl: string;
  targetAudience: string;
  onProductNameChange: (v: string) => void;
  onProductDescriptionChange: (v: string) => void;
  onProductUrlChange: (v: string) => void;
  onTargetAudienceChange: (v: string) => void;
  onRepoSelected?: (repoUrl: string, accessToken: string | null) => void;
  onNext: () => void;
}

export function ProductStep({
  productName,
  productDescription,
  productUrl,
  targetAudience,
  onProductNameChange,
  onProductDescriptionChange,
  onProductUrlChange,
  onTargetAudienceChange,
  onRepoSelected,
  onNext,
}: ProductStepProps) {
  const searchParams = useSearchParams();

  // GitHub state
  const [githubLoading, setGithubLoading] = useState(true);
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubToken, setGithubToken] = useState<string | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [repoSearch, setRepoSearch] = useState('');

  // Repo URL fallback (paste link)
  const [repoUrl, setRepoUrl] = useState('');
  const [analyzing, setAnalyzing] = useState<string | false>(false);
  const [analyzeError, setAnalyzeError] = useState('');
  const [suggestion, setSuggestion] = useState<AnalysisResult | null>(null);
  const [editingSuggestion, setEditingSuggestion] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');

  const canContinue = productName.trim() && productDescription.trim() && targetAudience.trim();

  useEffect(() => {
    loadGitHubStatus();
  }, []);

  // Re-check after OAuth redirect
  useEffect(() => {
    if (searchParams.get('github') === 'connected') {
      loadGitHubStatus();
    }
  }, [searchParams]);

  async function loadGitHubStatus() {
    setGithubLoading(true);
    try {
      const res = await fetch('/api/github/user-repos');
      const json = await res.json();
      if (json.connected) {
        setGithubConnected(true);
        setGithubToken(json.accessToken);
        setRepos(json.repos || []);
      }
    } catch {
      // Not connected
    }
    setGithubLoading(false);
  }

  function handleConnectGitHub() {
    const returnTo = window.location.pathname;
    window.location.href = `/api/auth/github?returnTo=${encodeURIComponent(returnTo)}`;
  }

  async function handleSelectRepo(repo: GitHubRepo) {
    setAnalyzing(repo.full_name);
    setAnalyzeError('');
    setSuggestion(null);
    try {
      const res = await fetch('/api/github/analyze-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: repo.url, accessToken: githubToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAnalyzeError(data.error || 'Failed to analyze repo');
        setAnalyzing(false);
        return;
      }
      if (data.productName) onProductNameChange(data.productName);
      if (data.productUrl) onProductUrlChange(data.productUrl);
      setSuggestion(data);
      setEditedDescription(data.productDescription || '');
      onRepoSelected?.(repo.url, githubToken);
    } catch {
      setAnalyzeError('Failed to analyze repo. Please try again.');
    }
    setAnalyzing(false);
  }

  async function handleAnalyzeUrl() {
    if (!repoUrl.trim()) return;
    setAnalyzing('url');
    setAnalyzeError('');
    setSuggestion(null);
    try {
      const res = await fetch('/api/github/analyze-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl, accessToken: githubToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAnalyzeError(data.error || 'Failed to analyze repo');
        setAnalyzing(false);
        return;
      }
      if (data.productName) onProductNameChange(data.productName);
      if (data.productUrl) onProductUrlChange(data.productUrl);
      setSuggestion(data);
      setEditedDescription(data.productDescription || '');
      onRepoSelected?.(repoUrl, githubToken);
    } catch {
      setAnalyzeError('Failed to analyze repo. Please try again.');
    }
    setAnalyzing(false);
  }

  function handleAccept() {
    if (suggestion) {
      onProductDescriptionChange(suggestion.productDescription);
    }
    setSuggestion(null);
    setEditingSuggestion(false);
  }

  function handleAcceptEdited() {
    onProductDescriptionChange(editedDescription);
    setSuggestion(null);
    setEditingSuggestion(false);
  }

  function handleDeny() {
    setSuggestion(null);
    setEditingSuggestion(false);
  }

  const filteredRepos = repoSearch
    ? repos.filter(
        (r) =>
          r.full_name.toLowerCase().includes(repoSearch.toLowerCase()) ||
          r.description?.toLowerCase().includes(repoSearch.toLowerCase())
      )
    : repos;

  return (
    <div className="w-full max-w-lg mx-auto">
      <h2 className="text-2xl font-bold tracking-tight">Your Product</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Tell us about what you&apos;re promoting. The AI uses this to find the right communities.
      </p>

      {/* GitHub section */}
      <div className="mt-6 rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <Github className="h-4 w-4" />
          <span className="text-sm font-medium">Import from GitHub</span>
        </div>

        {githubLoading ? (
          <div className="flex items-center gap-2 py-4 justify-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs">Checking GitHub connection...</span>
          </div>
        ) : githubConnected ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Select a repository to auto-fill your product details.
            </p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search repositories..."
                value={repoSearch}
                onChange={(e) => setRepoSearch(e.target.value)}
                className="pl-9 text-sm h-9"
              />
            </div>
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {filteredRepos.map((repo) => (
                <button
                  key={repo.full_name}
                  onClick={() => handleSelectRepo(repo)}
                  disabled={!!analyzing}
                  className="w-full flex items-center gap-3 rounded-lg border p-2.5 text-left transition-colors hover:border-primary/50 hover:bg-accent/50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate">{repo.full_name}</span>
                      {repo.isPrivate ? (
                        <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <Globe className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      )}
                    </div>
                    {repo.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{repo.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-0.5">
                      {repo.language && <span className="text-xs text-muted-foreground">{repo.language}</span>}
                      {repo.stars > 0 && (
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <Star className="h-3 w-3" /> {repo.stars}
                        </span>
                      )}
                    </div>
                  </div>
                  {analyzing === repo.full_name ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground flex-shrink-0" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  )}
                </button>
              ))}
              {filteredRepos.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {repoSearch ? 'No repositories match your search.' : 'No repositories found.'}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Connect your GitHub to import from any of your repositories, including private ones.
            </p>
            <Button variant="outline" size="sm" onClick={handleConnectGitHub} className="w-full">
              <Github className="mr-2 h-4 w-4" />
              Connect with GitHub
            </Button>
            <div className="relative flex items-center">
              <div className="flex-1 border-t" />
              <span className="px-3 text-xs text-muted-foreground">or paste a public repo link</span>
              <div className="flex-1 border-t" />
            </div>
            <div className="flex gap-2">
              <Input
                value={repoUrl}
                onChange={(e) => { setRepoUrl(e.target.value); setAnalyzeError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleAnalyzeUrl()}
                placeholder="https://github.com/owner/repo"
                className="text-sm"
                disabled={!!analyzing}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleAnalyzeUrl}
                disabled={!repoUrl.trim() || !!analyzing}
                className="shrink-0"
              >
                {analyzing === 'url' ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                )}
                {analyzing === 'url' ? 'Analyzing...' : 'Analyze'}
              </Button>
            </div>
          </div>
        )}

        {analyzeError && (
          <p className="mt-2 text-xs text-destructive">{analyzeError}</p>
        )}
      </div>

      {/* AI suggestion review card */}
      <AnimatePresence>
        {suggestion && (
          <motion.div
            variants={scaleFadeVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="mt-4 rounded-xl border border-orange-500/30 bg-orange-500/5 p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium">AI-Generated Description</span>
            </div>

            {editingSuggestion ? (
              <>
                <Textarea
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  rows={4}
                  className="mt-1 text-sm bg-background"
                />
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={handleAcceptEdited} disabled={!editedDescription.trim()}>
                    <Check className="mr-1.5 h-3.5 w-3.5" /> Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingSuggestion(false)}>
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {suggestion.productDescription}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={handleAccept}>
                    <Check className="mr-1.5 h-3.5 w-3.5" /> Accept
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingSuggestion(true)}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleDeny}>
                    <X className="mr-1.5 h-3.5 w-3.5" /> Dismiss
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative my-5 flex items-center">
        <div className="flex-1 border-t" />
        <span className="px-3 text-xs text-muted-foreground">or fill in manually</span>
        <div className="flex-1 border-t" />
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="ob-product-name" className="text-xs">
              Product Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ob-product-name"
              value={productName}
              onChange={(e) => onProductNameChange(e.target.value)}
              placeholder="My SaaS"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ob-product-url" className="text-xs">
              URL (optional)
            </Label>
            <Input
              id="ob-product-url"
              value={productUrl}
              onChange={(e) => onProductUrlChange(e.target.value)}
              placeholder="https://yourproduct.com"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ob-product-desc" className="text-xs">
            What does it do? <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="ob-product-desc"
            value={productDescription}
            onChange={(e) => onProductDescriptionChange(e.target.value)}
            placeholder="Describe your product in 2-3 sentences..."
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ob-audience" className="text-xs">
            Target Audience <span className="text-destructive">*</span>
          </Label>
          <Input
            id="ob-audience"
            value={targetAudience}
            onChange={(e) => onTargetAudienceChange(e.target.value)}
            placeholder="Indie hackers, SaaS founders, developers..."
          />
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <Button onClick={onNext} disabled={!canContinue}>
          Continue <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
