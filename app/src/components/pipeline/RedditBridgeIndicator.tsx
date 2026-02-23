'use client';

import { useEffect, useRef, useState } from 'react';
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
  configRedditUsername?: string;
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
  configRedditUsername,
}: RedditBridgeIndicatorProps) {
  const [dismissed, setDismissed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect account mismatch: extension Reddit user vs project config user
  const accountMismatch = (() => {
    if (!redditUsername || !configRedditUsername) return false;
    const extUser = redditUsername.replace(/^\/?u\//, '').trim().toLowerCase();
    const cfgUser = configRedditUsername.replace(/^\/?u\//, '').trim().toLowerCase();
    return extUser !== cfgUser;
  })();

  // Auto-dismiss the "connected" banner after 4s
  const isConnectedIdle = extensionInstalled && redditLoggedIn && !checking && !reconciling;
  useEffect(() => {
    if (isConnectedIdle && !dismissed) {
      timerRef.current = setTimeout(() => setDismissed(true), 4000);
      return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }
    // Reset if state goes back to non-idle (e.g. reconciling again)
    if (!isConnectedIdle && dismissed) {
      setDismissed(false);
    }
  }, [isConnectedIdle, dismissed]);
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

  // Account mismatch — block sync and warn the user
  if (accountMismatch) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span>
          You&apos;re logged into Reddit as <strong>u/{redditUsername}</strong>, but this project uses{' '}
          <strong>u/{configRedditUsername}</strong>. Switch Reddit accounts or open the correct project.
          DM sync is paused.
        </span>
      </div>
    );
  }

  const totalFound = (youSentToCount || 0) + (theyRepliedCount || 0);
  const hasData = totalFound > 0 || (capturedCount && capturedCount > 0);

  // Reconciling — updating pipeline cards
  if (reconciling) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs text-blue-600 dark:text-blue-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Updating pipeline{hasData ? ` — ${totalFound} conversations found` : ''}...
      </div>
    );
  }

  // No data yet — waiting for extension to scan Reddit chat
  if (!hasData) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs text-blue-600 dark:text-blue-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Reddit Connected — loading chat data...
      </div>
    );
  }

  // Have some data — show live counts with scanning indicator if still growing
  const parts: string[] = [];
  if (youSentToCount && youSentToCount > 0) {
    parts.push(`${youSentToCount} DM${youSentToCount !== 1 ? 's' : ''} sent`);
  }
  if (theyRepliedCount && theyRepliedCount > 0) {
    parts.push(`${theyRepliedCount} replied`);
  }
  if (parts.length === 0 && capturedCount) {
    parts.push(`${capturedCount} chat${capturedCount !== 1 ? 's' : ''} found`);
  }

  // Auto-dismiss: fade out then hide
  if (dismissed) return null;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs text-green-600 dark:text-green-400 animate-in fade-in duration-300">
      <CheckCircle2 className="h-3.5 w-3.5" />
      Reddit Connected · {parts.join(' · ')}
    </div>
  );
}
