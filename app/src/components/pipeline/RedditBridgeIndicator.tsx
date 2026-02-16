'use client';

import { Loader2, Unplug, AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react';

interface RedditBridgeIndicatorProps {
  extensionInstalled: boolean;
  redditLoggedIn: boolean;
  redditUsername: string | null;
  checking: boolean;
  reconciling: boolean;
  capturedCount?: number;
  youSentToCount?: number;
  theyRepliedCount?: number;
}

export function RedditBridgeIndicator({
  extensionInstalled,
  redditLoggedIn,
  redditUsername,
  checking,
  reconciling,
  capturedCount,
  youSentToCount,
  theyRepliedCount,
}: RedditBridgeIndicatorProps) {
  if (checking) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Checking Reddit connection...
      </div>
    );
  }

  if (!extensionInstalled) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground/60">
        <Unplug className="h-3.5 w-3.5" />
        Reddit Bridge not detected
      </div>
    );
  }

  if (!redditLoggedIn) {
    return (
      <a
        href="https://www.reddit.com/login"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-1.5 text-xs text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/20 transition-colors cursor-pointer"
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        Reddit not logged in — click to sign in
        <ExternalLink className="h-3 w-3" />
      </a>
    );
  }

  if (reconciling) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs text-blue-600 dark:text-blue-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Syncing sent DMs &amp; replies...
      </div>
    );
  }

  // Connected but no chat data yet — scanning in background
  if (capturedCount === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs text-blue-600 dark:text-blue-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Reddit Connected — scanning chat data...
      </div>
    );
  }

  const parts: string[] = [];
  if (youSentToCount && youSentToCount > 0) {
    parts.push(`${youSentToCount} DM${youSentToCount !== 1 ? 's' : ''} sent`);
  }
  if (theyRepliedCount && theyRepliedCount > 0) {
    parts.push(`${theyRepliedCount} replied`);
  }
  if (parts.length === 0) {
    parts.push(`${capturedCount} chat${capturedCount !== 1 ? 's' : ''} found`);
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs text-green-600 dark:text-green-400">
      <CheckCircle2 className="h-3.5 w-3.5" />
      Reddit Connected · {parts.join(' · ')}
    </div>
  );
}
