'use client';

import { ExternalLink, Clock, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { OutreachSignal } from '@/types';

interface AlertHistoryProps {
  alerts: OutreachSignal[];
  loading: boolean;
}

const statusConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; label: string }> = {
  pending: { icon: Clock, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300', label: 'Pending' },
  sent: { icon: CheckCircle, color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300', label: 'Sent' },
  failed: { icon: AlertTriangle, color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300', label: 'Failed' },
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function AlertHistory({ alerts, loading }: AlertHistoryProps) {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <h3 className="font-medium text-sm">Recent Alerts</h3>

        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : alerts.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            No Discord alerts yet. Alerts will appear here when matched posts are sent to Discord.
          </p>
        ) : (
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {alerts.map((alert) => {
              const status = statusConfig[alert.discord_alert_status || 'pending'] || statusConfig.pending;
              const StatusIcon = status.icon;
              return (
                <div
                  key={alert.id}
                  className="flex items-start gap-2 rounded-lg border px-3 py-2 text-xs"
                >
                  <StatusIcon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="font-medium line-clamp-1">{alert.title}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-muted-foreground">r/{alert.subreddit}</span>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] px-1.5 py-0 ${status.color}`}
                      >
                        {status.label}
                      </Badge>
                      {alert.matched_keywords.slice(0, 2).map((kw) => (
                        <span
                          key={kw}
                          className="inline-flex rounded-full bg-muted px-1.5 py-0 text-[10px]"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-muted-foreground">
                      {timeAgo(alert.fetched_at)}
                    </span>
                    <a
                      href={`https://reddit.com${alert.permalink}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
