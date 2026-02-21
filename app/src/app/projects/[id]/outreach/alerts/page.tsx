'use client';

import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useProject } from '@/contexts/project-context';
import { PageTransition } from '@/components/motion';
import { Header } from '@/components/layout/header';
import { DiscordConnect } from '@/components/outreach/DiscordConnect';
import { KeywordManager } from '@/components/outreach/KeywordManager';
import { MonitoredSubreddits } from '@/components/outreach/MonitoredSubreddits';
import { AlertHistory } from '@/components/outreach/AlertHistory';
import { useOutreachStore } from '@/stores/outreach-store';
import { toast } from 'sonner';

export default function OutreachAlertsPage() {
  const { project } = useProject();
  const {
    config,
    configLoading,
    keywords,
    monitoredSubs,
    recentAlerts,
    alertsLoading,
    fetchConfig,
    fetchKeywords,
    fetchMonitoredSubs,
    fetchRecentAlerts,
    addKeyword,
    removeKeyword,
    toggleKeyword,
    addMonitoredSub,
    removeMonitoredSub,
    toggleMonitoredSub,
    syncSubsFromProject,
    disconnectDiscord,
  } = useOutreachStore();

  useEffect(() => {
    fetchConfig(project.id);
    fetchKeywords(project.id);
    fetchMonitoredSubs(project.id);
    fetchRecentAlerts(project.id);
  }, [project.id, fetchConfig, fetchKeywords, fetchMonitoredSubs, fetchRecentAlerts]);

  const isConnected = config?.discord_connected && config?.discord_guild_id;

  function handleDisconnect() {
    disconnectDiscord(project.id);
    toast.success('Discord disconnected');
  }

  if (configLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="flex h-full flex-col">
        <Header title="Discord Alerts" />
        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-3xl p-6 space-y-4">
            {/* Discord connection */}
            <DiscordConnect
              config={config}
              projectId={project.id}
              onDisconnect={handleDisconnect}
            />

            {/* Show config sections when connected */}
            {isConnected && (
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

                {/* Alert history */}
                <AlertHistory alerts={recentAlerts} loading={alertsLoading} />
              </>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
