'use client';

import { Loader2, Unplug, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface RedditBridgeIndicatorProps {
  extensionInstalled: boolean;
  redditLoggedIn: boolean;
  redditUsername: string | null;
  checking: boolean;
  reconciling: boolean;
}

export function RedditBridgeIndicator({
  extensionInstalled,
  redditLoggedIn,
  redditUsername,
  checking,
  reconciling,
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
      <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-1.5 text-xs text-yellow-600 dark:text-yellow-400">
        <AlertTriangle className="h-3.5 w-3.5" />
        Reddit not logged in
      </div>
    );
  }

  if (reconciling) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs text-blue-600 dark:text-blue-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Syncing sent DMs...
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs text-green-600 dark:text-green-400">
      <CheckCircle2 className="h-3.5 w-3.5" />
      Reddit Connected u/{redditUsername}
    </div>
  );
}
