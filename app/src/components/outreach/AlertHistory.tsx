'use client';

import { useState } from 'react';
import { ExternalLink, Clock, CheckCircle, AlertTriangle, Loader2, Hash, Mail, Send, MessageSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AlertDelivery, AlertChannel } from '@/types';

interface AlertHistoryProps {
  deliveries: AlertDelivery[];
  loading: boolean;
  onFilterChange?: (channel: AlertChannel | 'all') => void;
}

const statusConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; label: string }> = {
  pending: { icon: Clock, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300', label: 'Pending' },
  sent: { icon: CheckCircle, color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300', label: 'Sent' },
  failed: { icon: AlertTriangle, color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300', label: 'Failed' },
};

const channelConfig: Record<AlertChannel, { icon: React.ComponentType<{ className?: string }>; label: string; color: string }> = {
  discord: { icon: MessageSquare, label: 'Discord', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300' },
  discord_dm: { icon: MessageSquare, label: 'Discord DM', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300' },
  slack: { icon: Hash, label: 'Slack', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' },
  email: { icon: Mail, label: 'Email', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
  telegram: { icon: Send, label: 'Telegram', color: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300' },
};

const filterOptions: { value: AlertChannel | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'discord', label: 'Discord' },
  { value: 'discord_dm', label: 'Discord DM' },
  { value: 'slack', label: 'Slack' },
  { value: 'email', label: 'Email' },
  { value: 'telegram', label: 'Telegram' },
];

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function AlertHistory({ deliveries, loading, onFilterChange }: AlertHistoryProps) {
  const [filter, setFilter] = useState<AlertChannel | 'all'>('all');

  function handleFilter(value: AlertChannel | 'all') {
    setFilter(value);
    onFilterChange?.(value);
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm">Alert History</h3>
          <div className="flex gap-1">
            {filterOptions.map((opt) => (
              <Button
                key={opt.value}
                variant={filter === opt.value ? 'secondary' : 'ghost'}
                size="sm"
                className="text-[10px] h-6 px-2"
                onClick={() => handleFilter(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : deliveries.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            No alerts yet. Alerts will appear here when matched posts are sent to your connected channels.
          </p>
        ) : (
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {deliveries.map((delivery) => {
              const status = statusConfig[delivery.status] || statusConfig.pending;
              const StatusIcon = status.icon;
              const channel = channelConfig[delivery.channel];
              const ChannelIcon = channel.icon;
              const signal = delivery.signal;

              return (
                <div
                  key={delivery.id}
                  className="flex items-start gap-2 rounded-lg border px-3 py-2 text-xs"
                >
                  <StatusIcon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="font-medium line-clamp-1">
                      {signal?.title || 'Unknown signal'}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {signal?.subreddit && (
                        <span className="text-muted-foreground">r/{signal.subreddit}</span>
                      )}
                      <Badge
                        variant="secondary"
                        className={`text-[10px] px-1.5 py-0 gap-0.5 ${channel.color}`}
                      >
                        <ChannelIcon className="h-2.5 w-2.5" />
                        {channel.label}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] px-1.5 py-0 ${status.color}`}
                      >
                        {status.label}
                      </Badge>
                      {signal?.matched_keywords?.slice(0, 2).map((kw) => (
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
                      {timeAgo(delivery.created_at)}
                    </span>
                    {signal?.permalink && (
                      <a
                        href={`https://reddit.com${signal.permalink}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
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
