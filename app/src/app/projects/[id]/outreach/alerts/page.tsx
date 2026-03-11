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
import type { AlertChannel, OutreachKeyword, AlertDelivery, OutreachMonitoredSub } from '@/types';

const USE_MOCK = false; // flip to false when done previewing

const MOCK_KEYWORDS: OutreachKeyword[] = [
  { id: 'mk1', project_id: '', phrases: ['CRM alternative', 'best CRM'], exclusions: [], is_active: true, source: 'manual', silenced_until: null, tier: null, created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z' },
  { id: 'mk2', project_id: '', phrases: ['cold outreach tool'], exclusions: [], is_active: true, source: 'manual', silenced_until: null, tier: null, created_at: '2026-03-02T00:00:00Z', updated_at: '2026-03-02T00:00:00Z' },
  { id: 'mk3', project_id: '', phrases: ['lead generation', 'find leads'], exclusions: [], is_active: true, source: 'manual', silenced_until: null, tier: null, created_at: '2026-03-03T00:00:00Z', updated_at: '2026-03-03T00:00:00Z' },
];

const mockD = (id: string, title: string, sub: string, kws: string[], hoursAgo: number): AlertDelivery => {
  const ts = new Date(Date.now() - hoursAgo * 3600000).toISOString();
  return { id, signal_id: id, project_id: '', channel: 'email', status: 'sent', error_message: null, sent_at: ts, created_at: ts, signal: { title, subreddit: sub, permalink: `/r/${sub}/comments/${id}`, matched_keywords: kws, fetched_at: ts } };
};

const MOCK_DELIVERIES: AlertDelivery[] = [
  // Today (0-12h ago)
  mockD('d01', 'Looking for a CRM alternative that doesn\'t cost a fortune', 'SaaS', ['CRM alternative'], 0.5),
  mockD('d02', 'Best cold outreach tool for small teams?', 'Entrepreneur', ['cold outreach tool'], 1),
  mockD('d03', 'How do you find leads on Reddit without being spammy?', 'GrowthHacking', ['find leads'], 1.5),
  mockD('d04', 'Ditching Salesforce — what\'s the best CRM for a 10-person team?', 'startups', ['best CRM'], 2),
  mockD('d05', 'Cold outreach tool that integrates with Gmail?', 'SaaS', ['cold outreach tool'], 3),
  mockD('d06', 'We need better lead generation — budget is $200/mo', 'smallbusiness', ['lead generation'], 3.5),
  mockD('d07', 'Any CRM alternative that actually has good mobile support?', 'Entrepreneur', ['CRM alternative'], 4),
  mockD('d08', 'How are you guys finding leads for B2B SaaS in 2026?', 'SaaS', ['find leads'], 5),
  mockD('d09', 'Recommendations for cold outreach tool with sequences?', 'marketing', ['cold outreach tool'], 6),
  mockD('d10', 'Tired of HubSpot pricing — best CRM for bootstrapped founders?', 'startups', ['best CRM', 'CRM alternative'], 7),
  mockD('d11', 'Lead generation on Reddit: what actually converts?', 'GrowthHacking', ['lead generation'], 8),
  mockD('d12', 'Is there a CRM alternative that does outreach + pipeline?', 'SaaS', ['CRM alternative', 'cold outreach tool'], 9),
  // Yesterday (24-36h ago)
  mockD('d13', 'We switched from HubSpot — here\'s the best CRM we found', 'startups', ['best CRM'], 26),
  mockD('d14', 'Lead generation strategies that actually work in 2026', 'marketing', ['lead generation'], 28),
  mockD('d15', 'Any good CRM alternative to Salesforce for bootstrapped startups?', 'smallbusiness', ['CRM alternative'], 30),
  mockD('d16', 'Cold outreach tool showdown: Lemlist vs Instantly vs Apollo', 'Entrepreneur', ['cold outreach tool'], 32),
  mockD('d17', 'How to find leads without buying sketchy lists', 'GrowthHacking', ['find leads'], 34),
  // Last week (3-6 days ago)
  mockD('d18', 'Best CRM for agencies managing 50+ clients?', 'SaaS', ['best CRM'], 80),
  mockD('d19', 'Our lead generation playbook after 2 years of Reddit marketing', 'marketing', ['lead generation'], 100),
  mockD('d20', 'Simple CRM alternative for freelancers?', 'smallbusiness', ['CRM alternative'], 120),
];

const MOCK_SUBS: OutreachMonitoredSub[] = [
  { id: 'ms1', project_id: '', name: 'SaaS', is_active: true, safety_level: 'safe', last_polled_at: '2026-03-10T14:00:00Z', created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-10T14:00:00Z' },
  { id: 'ms2', project_id: '', name: 'Entrepreneur', is_active: true, safety_level: 'safe', last_polled_at: '2026-03-10T14:00:00Z', created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-10T14:00:00Z' },
  { id: 'ms3', project_id: '', name: 'startups', is_active: true, safety_level: 'caution', last_polled_at: '2026-03-10T14:00:00Z', created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-10T14:00:00Z' },
  { id: 'ms4', project_id: '', name: 'smallbusiness', is_active: true, safety_level: 'safe', last_polled_at: '2026-03-10T14:00:00Z', created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-10T14:00:00Z' },
  { id: 'ms5', project_id: '', name: 'marketing', is_active: false, safety_level: 'safe', last_polled_at: null, created_at: '2026-03-02T00:00:00Z', updated_at: '2026-03-02T00:00:00Z' },
];

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
  const [setupSkipped, setSetupSkipped] = useState(false);

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

  // Use mock data when real data is empty and USE_MOCK is on
  const displayKeywords = USE_MOCK && keywords.length === 0 ? MOCK_KEYWORDS : keywords;
  const displayDeliveries = USE_MOCK && alertDeliveries.length === 0 ? MOCK_DELIVERIES : alertDeliveries;
  const displaySubs = USE_MOCK && monitoredSubs.length === 0 ? MOCK_SUBS : monitoredSubs;

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
    ? displayDeliveries.filter((d) => {
        const kw = displayKeywords.find((k) => k.id === activeKeyword);
        if (!kw) return false;
        const phrases = kw.phrases.map((p) => p.toLowerCase());
        return d.signal?.matched_keywords?.some((mk) => phrases.includes(mk.toLowerCase()));
      }).length
    : displayDeliveries.length;

  const activeLabel = activeKeyword
    ? displayKeywords.find((k) => k.id === activeKeyword)?.phrases.join(', ') || 'keyword'
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

            {connectedChannels.length === 0 && !setupSkipped ? (
              /* Channel setup */
              <div className="flex flex-1 flex-col items-center justify-center min-h-[60vh]">
                <div className="w-full max-w-lg rounded-2xl border bg-card p-8 space-y-6">
                  <div className="text-center space-y-1.5">
                    <h2 className="text-lg font-semibold">Set up your alerts</h2>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                      Connect a channel to start receiving alerts when relevant posts appear on Reddit.
                    </p>
                  </div>
                  {expandedChannel ? (
                    <div className="space-y-3">
                      <button
                        onClick={() => setExpandedChannel(null)}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        &larr; Back to channels
                      </button>
                      <div className="rounded-xl border bg-muted/50 p-4">
                        {renderChannelConnect(expandedChannel)}
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {setupChannels.map((ch) => {
                        const meta = channelMeta[ch];
                        const Icon = meta.icon;
                        const connected = isChannelConnected(ch);
                        return (
                          <button
                            key={ch}
                            onClick={() => setExpandedChannel(ch)}
                            className="flex items-center gap-3 rounded-xl border bg-muted/30 p-4 text-left transition-all hover:bg-muted/60 hover:border-muted-foreground/20"
                          >
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted border">
                              <Icon className="h-4.5 w-4.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{meta.label}</p>
                              {connected ? (
                                <p className="text-xs text-orange-400 flex items-center gap-1">
                                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-orange-400" />
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
                  )}
                </div>
                <button
                  onClick={() => setSetupSkipped(true)}
                  className="mt-4 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Skip for now
                </button>
              </div>
            ) : (
              <>
                {/* Keyword cards strip */}
                <KeywordCards
                  keywords={displayKeywords}
                  deliveries={displayDeliveries}
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
                    <span>Monitored Subreddits ({displaySubs.length})</span>
                    {subsExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  {subsExpanded && (
                    <div className="px-1 pb-1">
                      <MonitoredSubreddits
                        subs={displaySubs}
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
                  deliveries={displayDeliveries}
                  keywords={displayKeywords}
                  filterKeywordId={activeKeyword}
                  projectId={project.id}
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
        keywords={displayKeywords}
        deliveries={displayDeliveries}
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
