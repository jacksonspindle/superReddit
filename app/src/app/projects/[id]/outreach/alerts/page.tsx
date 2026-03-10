'use client';

import { useEffect, useCallback, useState } from 'react';
import { Loader2, Wifi, Hash, Mail, Send, Plus, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react';
import { useProject } from '@/contexts/project-context';
import { PageTransition } from '@/components/motion';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DiscordConnect } from '@/components/outreach/DiscordConnect';
import { DiscordDmConnect } from '@/components/outreach/DiscordDmConnect';
import { SlackConnect } from '@/components/outreach/SlackConnect';
import { EmailConnect } from '@/components/outreach/EmailConnect';
import { TelegramConnect } from '@/components/outreach/TelegramConnect';
import { KeywordCards } from '@/components/outreach/KeywordCards';
import { ManageKeywordsDialog } from '@/components/outreach/ManageKeywordsDialog';
import { PostGrid } from '@/components/outreach/PostGrid';
import { MonitoredSubreddits } from '@/components/outreach/MonitoredSubreddits';
import { useOutreachStore } from '@/stores/outreach-store';
import { toast } from 'sonner';
import type { AlertChannel } from '@/types';

const channelMeta: Record<AlertChannel, { icon: React.ComponentType<{ className?: string }>; label: string }> = {
  discord: { icon: Wifi, label: 'Discord' },
  discord_dm: { icon: MessageCircle, label: 'Discord DM' },
  slack: { icon: Hash, label: 'Slack' },
  email: { icon: Mail, label: 'Email' },
  telegram: { icon: Send, label: 'Telegram' },
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
    addMonitoredSub,
    removeMonitoredSub,
    toggleMonitoredSub,
    syncSubsFromProject,
    disconnectChannel,
  } = useOutreachStore();

  const [activeKeyword, setActiveKeyword] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [channelsDialogOpen, setChannelsDialogOpen] = useState(false);
  const [subsExpanded, setSubsExpanded] = useState(false);
  const [expandedChannel, setExpandedChannel] = useState<AlertChannel | null>(null);

  useEffect(() => {
    fetchConfig(project.id);
    fetchKeywords(project.id);
    fetchMonitoredSubs(project.id);
    fetchAlertDeliveries(project.id);
  }, [project.id, fetchConfig, fetchKeywords, fetchMonitoredSubs, fetchAlertDeliveries]);

  const connectedChannels: AlertChannel[] = (['discord', 'discord_dm', 'slack', 'email', 'telegram'] as AlertChannel[]).filter((ch) => {
    switch (ch) {
      case 'discord': return !!config?.discord_connected;
      case 'discord_dm': return !!config?.discord_dm_connected;
      case 'slack': return !!config?.slack_connected;
      case 'email': return !!config?.email_connected;
      case 'telegram': return !!config?.telegram_connected;
    }
  });

  const setupChannels: AlertChannel[] = ['discord_dm', 'slack', 'email', 'telegram'];

  const isChannelConnected = (ch: AlertChannel) => {
    switch (ch) {
      case 'discord': return !!config?.discord_connected;
      case 'discord_dm': return !!config?.discord_dm_connected;
      case 'slack': return !!config?.slack_connected;
      case 'email': return !!config?.email_connected;
      case 'telegram': return !!config?.telegram_connected;
    }
  };

  const renderChannelConnect = (ch: AlertChannel) => {
    switch (ch) {
      case 'discord_dm':
        return <DiscordDmConnect config={config} projectId={project.id} onDisconnect={() => handleDisconnect('discord_dm')} />;
      case 'slack':
        return <SlackConnect config={config} projectId={project.id} onDisconnect={() => handleDisconnect('slack')} />;
      case 'email':
        return <EmailConnect config={config} projectId={project.id} onDisconnect={() => handleDisconnect('email')} />;
      case 'telegram':
        return <TelegramConnect config={config} projectId={project.id} onDisconnect={() => handleDisconnect('telegram')} />;
      default:
        return null;
    }
  };

  const handleDisconnect = useCallback(
    (channel: AlertChannel) => {
      disconnectChannel(project.id, channel);
      toast.success(`${channel.charAt(0).toUpperCase() + channel.slice(1)} disconnected`);
    },
    [disconnectChannel, project.id]
  );

  // Compute filter context line
  const filteredCount = activeKeyword
    ? alertDeliveries.filter((d) => {
        const kw = keywords.find((k) => k.id === activeKeyword);
        if (!kw) return false;
        const phrases = kw.phrases.map((p) => p.toLowerCase());
        return d.signal?.matched_keywords?.some((mk) => phrases.includes(mk.toLowerCase()));
      }).length
    : alertDeliveries.length;

  const activeLabel = activeKeyword
    ? keywords.find((k) => k.id === activeKeyword)?.phrases.join(', ') || 'keyword'
    : null;

  return (
    <PageTransition>
      <div className="flex h-full flex-col">
        <Header title="Alerts" />
        <div className="flex-1 overflow-auto">
          {configLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
          <div className="mx-auto max-w-6xl p-6 space-y-5">
            {/* Top bar: title + channel indicator */}
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold">Keyword Alerts</h1>
              <div className="flex items-center gap-1.5">
                {connectedChannels.length > 0 ? (
                  <button
                    onClick={() => setChannelsDialogOpen(true)}
                    className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs hover:bg-muted/50 transition-colors"
                  >
                    {connectedChannels.map((ch) => {
                      const Icon = channelMeta[ch].icon;
                      return (
                        <Icon
                          key={ch}
                          className="h-3 w-3 text-green-500"
                        />
                      );
                    })}
                    <span className="text-muted-foreground ml-0.5">
                      {connectedChannels.length} connected
                    </span>
                  </button>
                ) : (
                  <Badge variant="outline" className="text-[11px] text-muted-foreground">
                    No channels
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setChannelsDialogOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {connectedChannels.length === 0 ? (
              /* Glassmorphism channel setup */
              <div className="relative flex flex-col items-center justify-center py-16">
                {/* Background glow blobs */}
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                  <div className="absolute -top-20 left-1/4 h-64 w-64 rounded-full bg-emerald-500/20 blur-[100px]" />
                  <div className="absolute -bottom-10 right-1/4 h-48 w-48 rounded-full bg-emerald-400/15 blur-[80px]" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-32 w-32 rounded-full bg-green-500/10 blur-[60px]" />
                </div>

                {/* Glass card */}
                <div className="relative z-10 w-full max-w-lg rounded-2xl border border-white/[0.08] bg-white/[0.04] p-8 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] space-y-6">
                  <div className="text-center space-y-1.5">
                    <h2 className="text-lg font-semibold">Set up your alerts</h2>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                      Connect a channel to start receiving alerts when relevant posts appear on Reddit.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {setupChannels.map((ch) => {
                      const meta = channelMeta[ch];
                      const Icon = meta.icon;
                      const connected = isChannelConnected(ch);
                      const isExpanded = expandedChannel === ch;
                      return (
                        <button
                          key={ch}
                          onClick={() => setExpandedChannel(isExpanded ? null : ch)}
                          className={`flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-left transition-all hover:bg-white/[0.07] hover:border-white/[0.15] ${
                            isExpanded ? 'border-emerald-500/40 bg-emerald-500/[0.06]' : ''
                          }`}
                        >
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.06] border border-white/[0.06]">
                            <Icon className="h-4.5 w-4.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{meta.label}</p>
                            {connected ? (
                              <p className="text-xs text-emerald-400 flex items-center gap-1">
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                Active
                              </p>
                            ) : (
                              <p className="text-xs text-muted-foreground">Set up &rarr;</p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {expandedChannel && (
                    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
                      {renderChannelConnect(expandedChannel)}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Keyword cards strip */}
                <KeywordCards
                  keywords={keywords}
                  deliveries={alertDeliveries}
                  activeKeyword={activeKeyword}
                  onSelect={setActiveKeyword}
                  onManageOpen={() => setManageOpen(true)}
                />

                {/* Monitored Subreddits — collapsible */}
                <div className="border rounded-lg">
                  <button
                    onClick={() => setSubsExpanded(!subsExpanded)}
                    className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium hover:bg-muted/30 transition-colors"
                  >
                    <span>Monitored Subreddits ({monitoredSubs.length})</span>
                    {subsExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  {subsExpanded && (
                    <div className="px-1 pb-1">
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
                    </div>
                  )}
                </div>

                {/* Filter context line */}
                <p className="text-xs text-muted-foreground">
                  {activeLabel
                    ? `Showing ${filteredCount} posts matching "${activeLabel}"`
                    : `Showing all ${filteredCount} posts`}
                </p>

                {/* Post grid */}
                <PostGrid
                  deliveries={alertDeliveries}
                  keywords={keywords}
                  filterKeywordId={activeKeyword}
                  loading={deliveriesLoading}
                />
              </>
            )}
          </div>
          )}
        </div>
      </div>

      {/* Manage Keywords Dialog */}
      <ManageKeywordsDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        keywords={keywords}
        deliveries={alertDeliveries}
        onAdd={(phrases) => addKeyword(project.id, phrases)}
        onRemove={removeKeyword}
      />

      {/* Channels Dialog */}
      <Dialog open={channelsDialogOpen} onOpenChange={setChannelsDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Alert Channels</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <DiscordConnect
              config={config}
              projectId={project.id}
              onDisconnect={() => handleDisconnect('discord')}
            />
            <DiscordDmConnect
              config={config}
              projectId={project.id}
              onDisconnect={() => handleDisconnect('discord_dm')}
            />
            <SlackConnect
              config={config}
              projectId={project.id}
              onDisconnect={() => handleDisconnect('slack')}
            />
            <EmailConnect
              config={config}
              projectId={project.id}
              onDisconnect={() => handleDisconnect('email')}
            />
            <TelegramConnect
              config={config}
              projectId={project.id}
              onDisconnect={() => handleDisconnect('telegram')}
            />
          </div>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
