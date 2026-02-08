import Link from 'next/link';
import { ArrowRight, Sparkles, Target, MessageSquare, Compass, Zap, Shield } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500 text-white font-bold text-sm">
            SR
          </div>
          <span className="font-bold text-xl">SuperReddit</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
          >
            Get Started Free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 pt-20 pb-16 max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 rounded-full border bg-muted px-3 py-1 text-xs text-muted-foreground mb-6">
          <Sparkles className="h-3 w-3 text-orange-500" />
          AI-Powered Reddit Marketing
        </div>
        <h1 className="text-5xl font-bold tracking-tight leading-tight mb-6">
          Turn Reddit into your{' '}
          <span className="text-orange-500">growth engine</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
          Find winning Reddit posts, understand what makes them successful, and generate
          authentic content for your product — all on a visual canvas powered by AI.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-6 py-3 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
          >
            Start for free <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-lg border px-6 py-3 text-sm font-medium hover:bg-muted transition-colors"
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-16 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-12">How it works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
              <Target className="h-6 w-6" />
            </div>
            <h3 className="font-semibold">1. Find winning posts</h3>
            <p className="text-sm text-muted-foreground">
              Browse any subreddit and discover top-performing posts in your niche.
              See what gets upvotes and engagement.
            </p>
          </div>
          <div className="text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10 text-green-500">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="font-semibold">2. Generate with AI</h3>
            <p className="text-sm text-muted-foreground">
              Select 2-3 successful example posts. Our AI creates tailored content
              for your product that matches the winning style.
            </p>
          </div>
          <div className="text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
              <Zap className="h-6 w-6" />
            </div>
            <h3 className="font-semibold">3. Post & grow</h3>
            <p className="text-sm text-muted-foreground">
              Edit, rewrite with different tones, and copy your posts.
              Content that sounds authentic, not like marketing.
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-16 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-12">Everything you need</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-xl border p-5 space-y-2">
            <Target className="h-5 w-5 text-orange-500" />
            <h3 className="font-semibold">Visual Canvas</h3>
            <p className="text-sm text-muted-foreground">
              A node-based whiteboard to map your Reddit strategy. Connect products to subreddits to examples to generated posts.
            </p>
          </div>
          <div className="rounded-xl border p-5 space-y-2">
            <Compass className="h-5 w-5 text-blue-500" />
            <h3 className="font-semibold">Inspiration Engine</h3>
            <p className="text-sm text-muted-foreground">
              Browse top posts from any subreddit with filters for Hot, Top, Rising. Find what works in your niche.
            </p>
          </div>
          <div className="rounded-xl border p-5 space-y-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            <h3 className="font-semibold">AI Generation</h3>
            <p className="text-sm text-muted-foreground">
              Claude AI analyzes winning posts and generates Reddit-native content for your product. No marketing speak.
            </p>
          </div>
          <div className="rounded-xl border p-5 space-y-2">
            <MessageSquare className="h-5 w-5 text-green-500" />
            <h3 className="font-semibold">AI Chat Mode</h3>
            <p className="text-sm text-muted-foreground">
              Chat with an AI Reddit strategist. Get advice on subreddit targeting, timing, and engagement strategies.
            </p>
          </div>
          <div className="rounded-xl border p-5 space-y-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            <h3 className="font-semibold">Smart Rewrite</h3>
            <p className="text-sm text-muted-foreground">
              Rewrite generated content in different tones — Humorous, Engaging, Sarcastic, Concise, and more.
            </p>
          </div>
          <div className="rounded-xl border p-5 space-y-2">
            <Shield className="h-5 w-5 text-red-500" />
            <h3 className="font-semibold">Ban Prevention</h3>
            <p className="text-sm text-muted-foreground">
              Built-in knowledge about Reddit policies. Our AI avoids patterns that get flagged as spam.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 text-center">
        <div className="max-w-2xl mx-auto rounded-2xl border bg-card p-10">
          <h2 className="text-3xl font-bold mb-4">Ready to grow on Reddit?</h2>
          <p className="text-muted-foreground mb-6">
            Join the beta and start creating Reddit content that actually works.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-6 py-3 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
          >
            Get Started Free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-6 py-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500 text-white font-bold text-xs">
              SR
            </div>
            <span className="text-sm font-medium">SuperReddit</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Built with AI. Not affiliated with Reddit.
          </p>
        </div>
      </footer>
    </div>
  );
}
