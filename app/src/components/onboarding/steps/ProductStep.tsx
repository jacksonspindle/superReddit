'use client';

import { useState } from 'react';
import { ArrowRight, Check, Github, Loader2, Pencil, Sparkles, X } from 'lucide-react';
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

interface ProductStepProps {
  productName: string;
  productDescription: string;
  productUrl: string;
  targetAudience: string;
  onProductNameChange: (v: string) => void;
  onProductDescriptionChange: (v: string) => void;
  onProductUrlChange: (v: string) => void;
  onTargetAudienceChange: (v: string) => void;
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
  onNext,
}: ProductStepProps) {
  const [repoUrl, setRepoUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState('');
  const [suggestion, setSuggestion] = useState<AnalysisResult | null>(null);
  const [editingSuggestion, setEditingSuggestion] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');

  const canContinue = productName.trim() && productDescription.trim() && targetAudience.trim();

  async function handleAnalyzeRepo() {
    if (!repoUrl.trim()) return;
    setAnalyzing(true);
    setAnalyzeError('');
    setSuggestion(null);
    try {
      const res = await fetch('/api/github/analyze-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAnalyzeError(data.error || 'Failed to analyze repo');
        setAnalyzing(false);
        return;
      }
      // Auto-fill name and URL immediately — description goes to review
      if (data.productName) onProductNameChange(data.productName);
      if (data.productUrl) onProductUrlChange(data.productUrl);
      setSuggestion(data);
      setEditedDescription(data.productDescription || '');
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

  return (
    <div className="w-full max-w-lg mx-auto">
      <h2 className="text-2xl font-bold tracking-tight">Your Product</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Tell us about what you&apos;re promoting. The AI uses this to find the right communities.
      </p>

      {/* GitHub import */}
      <div className="mt-6 rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <Github className="h-4 w-4" />
          <span className="text-sm font-medium">Import from GitHub</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Paste a public repo link and we&apos;ll analyze it to auto-fill your product details.
        </p>
        <div className="flex gap-2">
          <Input
            value={repoUrl}
            onChange={(e) => { setRepoUrl(e.target.value); setAnalyzeError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && handleAnalyzeRepo()}
            placeholder="https://github.com/owner/repo"
            className="text-sm"
            disabled={analyzing}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleAnalyzeRepo}
            disabled={!repoUrl.trim() || analyzing}
            className="shrink-0"
          >
            {analyzing ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            )}
            {analyzing ? 'Analyzing...' : 'Analyze'}
          </Button>
        </div>
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
