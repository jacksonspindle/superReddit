'use client';

import { useEffect, useCallback, useState } from 'react';
import { Loader2, Wifi, Hash, Mail, Send, Unplug } from 'lucide-react';
import { useProject } from '@/contexts/project-context';
import { PageTransition } from '@/components/motion';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DiscordConnect } from '@/components/outreach/DiscordConnect';
import { SlackConnect } from '@/components/outreach/SlackConnect';
import { EmailConnect } from '@/components/outreach/EmailConnect';
import { TelegramConnect } from '@/components/outreach/TelegramConnect';
import { KeywordManager } from '@/components/outreach/KeywordManager';
import { MonitoredSubreddits } from '@/components/outreach/MonitoredSubreddits';
import { AlertHistory } from '@/components/outreach/AlertHistory';
import { useOutreachStore } from '@/stores/outreach-store';
import { toast } from 'sonner';
import type { AlertChannel } from '@/types';

const channelMeta: Record<AlertChannel, { icon: React.ComponentType<{ className?: string }>; label: string; description: string }> = {
  discord: { icon: Wifi, label: 'Discord', description: 'Get alerts in a private Discord channel' },
  slack: { icon: Hash, label: 'Slack', description: 'Send alerts to a Slack channel' },
  email: { icon: Mail, label: 'Email', description: 'Receive alerts in your inbox' },
  telegram: { icon: Send, label: 'Telegram', description: 'Instant alerts via Telegram bot' },
};

export default function OutreachAlertsPage() {
  const { project } = useProject();
  const {
    config,
    configLoading,
    keywords,
    monitoredSubs,
    alertDeliveries,
    deliveriesLoading,
    fetchConfig,
    fetchKeywords,
    fetchMonitoredSubs,
    fetchAlertDeliveries,
    addKeyword,
    removeKeyword,
    toggleKeyword,
    addMonitoredSub,
    removeMonitoredSub,
    toggleMonitoredSub,
    syncSubsFromProject,
    disconnectChannel,
  } = useOutreachStore();

  const [expandedChannel, setExpandedChannel] = useState<AlertChannel | null>(null);

  useEffect(() => {
    fetchConfig(project.id);
    fetchKeywords(project.id);
    fetchMonitoredSubs(project.id);
    fetchAlertDeliveries(project.id);
  }, [project.id, fetchConfig, fetchKeywords, fetchMonitoredSubs, fetchAlertDeliveries]);

  const anyConnected =
    config?.discord_connected ||
    config?.slack_connected ||
    config?.email_connected ||
    config?.telegram_connected;

  const isChannelConnected = (ch: AlertChannel): boolean => {
    switch (ch) {
      case 'discord': return !!config?.discord_connected;
      case 'slack': return !!config?.slack_connected;
      case 'email': return !!config?.email_connected;
      case 'telegram': return !!config?.telegram_connected;
    }
  };

  const getChannelDetail = (ch: AlertChannel): string | null => {
    switch (ch) {
      case 'discord': return config?.discord_guild_name || null;
      case 'slack': return config?.slack_team_name ? `${config.slack_team_name}` : null;
      case 'email': return config?.email_address || null;
      case 'telegram': return config?.telegram_username ? `@${config.telegram_username}` : null;
    }
  };

  const handleDisconnect = useCallback(
    (channel: AlertChannel) => {
      disconnectChannel(project.id, channel);
      toast.success(`${channel.charAt(0).toUpperCase() + channel.slice(1)} disconnected`);
    },
    [disconnectChannel, project.id]
  );

  const handleDeliveryFilter = useCallback(
    (channel: AlertChannel | 'all') => {
      fetchAlertDeliveries(project.id, channel === 'all' ? undefined : channel);
    },
    [fetchAlertDeliveries, project.id]
  );

  if (configLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const channels: AlertChannel[] = ['discord', 'slack', 'email', 'telegram'];

  return (
    <PageTransition>
      <div className="flex h-full flex-col">
        <Header title="Alert Channels" />
        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-3xl p-6 flex flex-col gap-3 min-h-full justify-center">
            {/* Header text */}
            <div className="text-center space-y-1">
              <h2 className="text-lg font-semibold">Connect a channel to receive keyword alerts</h2>
              <p className="text-sm text-muted-foreground">
                Choose where you want to be notified when Reddit posts match your keywords.
              </p>
            </div>

            {/* Channel cards — 2x2 grid filling available space */}
            <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-3 max-h-[65vh]">
            {channels.map((ch) => {
              const meta = channelMeta[ch];
              const Icon = meta.icon;
              const connected = isChannelConnected(ch);
              const detail = getChannelDetail(ch);
              const isExpanded = expandedChannel === ch;

              return (
                <Card
                  key={ch}
                  className={`cursor-pointer transition-colors ${
                    isExpanded ? 'ring-2 ring-primary' : 'hover:bg-muted/30'
                  }`}
                  onClick={() => setExpandedChannel(isExpanded ? null : ch)}
                >
                  <CardContent className="p-0 h-full flex flex-col items-center justify-center text-center gap-2">
                    <div className={`rounded-full p-2.5 ${
                      connected
                        ? 'bg-green-500/10 text-green-500'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{meta.label}</p>
                      {connected && detail ? (
                        <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
                      )}
                    </div>
                    <Badge
                      variant="secondary"
                      className={`text-[10px] px-2 py-0.5 ${
                        connected
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                          : ''
                      }`}
                    >
                      {connected ? 'Connected' : 'Not connected'}
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
            </div>

            {/* Expanded channel config */}
            {expandedChannel && (
              <div>
                {expandedChannel === 'discord' && (
                  <DiscordConnect
                    config={config}
                    projectId={project.id}
                    onDisconnect={() => handleDisconnect('discord')}
                  />
                )}
                {expandedChannel === 'slack' && (
                  <SlackConnect
                    config={config}
                    projectId={project.id}
                    onDisconnect={() => handleDisconnect('slack')}
                  />
                )}
                {expandedChannel === 'email' && (
                  <EmailConnect
                    config={config}
                    projectId={project.id}
                    onDisconnect={() => handleDisconnect('email')}
                  />
                )}
                {expandedChannel === 'telegram' && (
                  <TelegramConnect
                    config={config}
                    projectId={project.id}
                    onDisconnect={() => handleDisconnect('telegram')}
                  />
                )}
              </div>
            )}

            {/* Show config sections when any channel is connected */}
            {anyConnected && (
              <>
                {/* Keywords */}
                <KeywordManager
                  keywords={keywords}
                  onAdd={(phrases) => addKeyword(project.id, phrases)}
                  onRemove={removeKeyword}
                  onToggle={toggleKeyword}
                />

                {/* Monitored subreddits */}
                <MonitoredSubreddits
                  subs={monitoredSubs}
                  onAdd={(name) => addMonitoredSub(project.id, name)}
                  onRemove={removeMonitoredSub}
                  onToggle={toggleMonitoredSub}
                  onSync={() => {
                    syncSubsFromProject(project.id);
                    toast.success('Subreddits synced from project');
                  }}
                />

                {/* Alert history - multi-channel */}
                <AlertHistory
                  deliveries={alertDeliveries}
                  loading={deliveriesLoading}
                  onFilterChange={handleDeliveryFilter}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
