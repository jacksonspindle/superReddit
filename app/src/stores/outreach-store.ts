'use client';

import { create } from 'zustand';
import type {
  OutreachConfig,
  OutreachKeyword,
  OutreachMonitoredSub,
  OutreachSignal,
  AlertDelivery,
  AlertChannel,
} from '@/types';

interface OutreachState {
  // Config
  config: OutreachConfig | null;
  configLoading: boolean;

  // Keywords
  keywords: OutreachKeyword[];
  keywordsLoading: boolean;

  // Monitored subreddits
  monitoredSubs: OutreachMonitoredSub[];
  subsLoading: boolean;

  // Recent alerts (signals with discord_alert_status) — legacy
  recentAlerts: OutreachSignal[];
  alertsLoading: boolean;

  // Alert deliveries (multi-channel)
  alertDeliveries: AlertDelivery[];
  deliveriesLoading: boolean;

  // Actions
  fetchConfig: (projectId: string) => Promise<void>;
  fetchKeywords: (projectId: string) => Promise<void>;
  fetchMonitoredSubs: (projectId: string) => Promise<void>;
  fetchRecentAlerts: (projectId: string) => Promise<void>;
  fetchAlertDeliveries: (projectId: string, channel?: AlertChannel) => Promise<void>;
  addKeyword: (projectId: string, phrases: string[]) => Promise<void>;
  removeKeyword: (keywordId: string) => Promise<void>;
  toggleKeyword: (keywordId: string, isActive: boolean) => Promise<void>;
  addMonitoredSub: (projectId: string, name: string) => Promise<void>;
  removeMonitoredSub: (subId: string) => Promise<void>;
  toggleMonitoredSub: (subId: string, isActive: boolean) => Promise<void>;
  syncSubsFromProject: (projectId: string) => Promise<void>;
  disconnectDiscord: (projectId: string) => Promise<void>;
  disconnectChannel: (projectId: string, channel: AlertChannel) => Promise<void>;
  connectEmail: (projectId: string, email: string) => Promise<{ success: boolean; error?: string }>;
  updateEmailPreferences: (projectId: string, prefs: {
    realtime_enabled?: boolean;
    digest_enabled?: boolean;
    digest_frequency?: 'daily' | 'weekly';
  }) => Promise<void>;
  connectTelegram: (projectId: string) => Promise<{ link: string; token: string } | null>;
}

export const useOutreachStore = create<OutreachState>((set, get) => ({
  config: null,
  configLoading: false,
  keywords: [],
  keywordsLoading: false,
  monitoredSubs: [],
  subsLoading: false,
  recentAlerts: [],
  alertsLoading: false,
  alertDeliveries: [],
  deliveriesLoading: false,

  fetchConfig: async (projectId) => {
    set({ configLoading: true });
    try {
      const res = await fetch(`/api/outreach/config?project_id=${projectId}`);
      const json = await res.json();
      set({ config: json.config || null });
    } catch {
      set({ config: null });
    }
    set({ configLoading: false });
  },

  fetchKeywords: async (projectId) => {
    set({ keywordsLoading: true });
    try {
      const res = await fetch(`/api/outreach/keywords?project_id=${projectId}`);
      const json = await res.json();
      set({ keywords: json.keywords || [] });
    } catch {
      set({ keywords: [] });
    }
    set({ keywordsLoading: false });
  },

  fetchMonitoredSubs: async (projectId) => {
    set({ subsLoading: true });
    try {
      const res = await fetch(`/api/outreach/monitored-subs?project_id=${projectId}`);
      const json = await res.json();
      set({ monitoredSubs: json.subs || [] });
    } catch {
      set({ monitoredSubs: [] });
    }
    set({ subsLoading: false });
  },

  fetchRecentAlerts: async (projectId) => {
    set({ alertsLoading: true });
    try {
      const res = await fetch(
        `/api/outreach/signals?project_id=${projectId}&discord_alert=true&limit=20`
      );
      const json = await res.json();
      set({ recentAlerts: json.signals || [] });
    } catch {
      set({ recentAlerts: [] });
    }
    set({ alertsLoading: false });
  },

  fetchAlertDeliveries: async (projectId, channel?) => {
    set({ deliveriesLoading: true });
    try {
      const params = new URLSearchParams({ project_id: projectId, limit: '50' });
      if (channel) params.set('channel', channel);
      const res = await fetch(`/api/alerts/deliveries?${params}`);
      const json = await res.json();
      set({ alertDeliveries: json.deliveries || [] });
    } catch {
      set({ alertDeliveries: [] });
    }
    set({ deliveriesLoading: false });
  },

  addKeyword: async (projectId, phrases) => {
    const keyword: Partial<OutreachKeyword> = {
      project_id: projectId,
      phrases,
      exclusions: [],
      is_active: true,
      source: 'manual',
    };

    // Optimistic
    const tempId = crypto.randomUUID();
    const optimistic: OutreachKeyword = {
      id: tempId,
      project_id: projectId,
      phrases,
      exclusions: [],
      is_active: true,
      source: 'manual',
      silenced_until: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    set((s) => ({ keywords: [...s.keywords, optimistic] }));

    try {
      const res = await fetch('/api/outreach/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(keyword),
      });
      const json = await res.json();
      if (json.keyword) {
        set((s) => ({
          keywords: s.keywords.map((k) => (k.id === tempId ? json.keyword : k)),
        }));
      }
    } catch {
      // Rollback
      set((s) => ({ keywords: s.keywords.filter((k) => k.id !== tempId) }));
    }
  },

  removeKeyword: async (keywordId) => {
    const prev = get().keywords;
    set((s) => ({ keywords: s.keywords.filter((k) => k.id !== keywordId) }));

    try {
      await fetch(`/api/outreach/keywords?id=${keywordId}`, { method: 'DELETE' });
    } catch {
      set({ keywords: prev });
    }
  },

  toggleKeyword: async (keywordId, isActive) => {
    set((s) => ({
      keywords: s.keywords.map((k) =>
        k.id === keywordId ? { ...k, is_active: isActive } : k
      ),
    }));

    try {
      await fetch('/api/outreach/keywords', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: keywordId, is_active: isActive }),
      });
    } catch {
      set((s) => ({
        keywords: s.keywords.map((k) =>
          k.id === keywordId ? { ...k, is_active: !isActive } : k
        ),
      }));
    }
  },

  addMonitoredSub: async (projectId, name) => {
    const cleanName = name.toLowerCase().replace(/^r\//, '').trim();
    if (!cleanName) return;

    const tempId = crypto.randomUUID();
    const optimistic: OutreachMonitoredSub = {
      id: tempId,
      project_id: projectId,
      name: cleanName,
      is_active: true,
      safety_level: 'caution',
      last_polled_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    set((s) => ({ monitoredSubs: [...s.monitoredSubs, optimistic] }));

    try {
      const res = await fetch('/api/outreach/monitored-subs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, name: cleanName }),
      });
      const json = await res.json();
      if (json.sub) {
        set((s) => ({
          monitoredSubs: s.monitoredSubs.map((sub) =>
            sub.id === tempId ? json.sub : sub
          ),
        }));
      }
    } catch {
      set((s) => ({ monitoredSubs: s.monitoredSubs.filter((sub) => sub.id !== tempId) }));
    }
  },

  removeMonitoredSub: async (subId) => {
    const prev = get().monitoredSubs;
    set((s) => ({ monitoredSubs: s.monitoredSubs.filter((sub) => sub.id !== subId) }));

    try {
      await fetch(`/api/outreach/monitored-subs?id=${subId}`, { method: 'DELETE' });
    } catch {
      set({ monitoredSubs: prev });
    }
  },

  toggleMonitoredSub: async (subId, isActive) => {
    set((s) => ({
      monitoredSubs: s.monitoredSubs.map((sub) =>
        sub.id === subId ? { ...sub, is_active: isActive } : sub
      ),
    }));

    try {
      await fetch('/api/outreach/monitored-subs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: subId, is_active: isActive }),
      });
    } catch {
      set((s) => ({
        monitoredSubs: s.monitoredSubs.map((sub) =>
          sub.id === subId ? { ...sub, is_active: !isActive } : sub
        ),
      }));
    }
  },

  syncSubsFromProject: async (projectId) => {
    try {
      const res = await fetch('/api/outreach/monitored-subs/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId }),
      });
      const json = await res.json();
      if (json.subs) {
        set({ monitoredSubs: json.subs });
      }
    } catch {
      // ignore
    }
  },

  disconnectDiscord: async (projectId) => {
    return get().disconnectChannel(projectId, 'discord');
  },

  disconnectChannel: async (projectId, channel) => {
    const prevConfig = get().config;
    if (prevConfig) {
      const updates: Partial<OutreachConfig> = {};
      switch (channel) {
        case 'discord':
          Object.assign(updates, {
            discord_connected: false,
            discord_guild_id: null,
            discord_guild_name: null,
            discord_channel_id: null,
            discord_webhook_url: null,
          });
          break;
        case 'slack':
          Object.assign(updates, {
            slack_connected: false,
            slack_team_id: null,
            slack_team_name: null,
            slack_channel_id: null,
            slack_channel_name: null,
            slack_webhook_url: null,
            slack_access_token: null,
          });
          break;
        case 'email':
          Object.assign(updates, {
            email_connected: false,
            email_verified: false,
            email_address: null,
            email_realtime_enabled: true,
            email_digest_enabled: false,
          });
          break;
        case 'telegram':
          Object.assign(updates, {
            telegram_connected: false,
            telegram_chat_id: null,
            telegram_username: null,
          });
          break;
      }
      set({ config: { ...prevConfig, ...updates } as OutreachConfig });
    }

    try {
      await fetch('/api/alerts/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, channel }),
      });
    } catch {
      if (prevConfig) set({ config: prevConfig });
    }
  },

  connectEmail: async (projectId, email) => {
    try {
      const res = await fetch('/api/alerts/email/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, email }),
      });
      const json = await res.json();
      if (json.error) return { success: false, error: json.error };
      return { success: true };
    } catch {
      return { success: false, error: 'Failed to connect email' };
    }
  },

  updateEmailPreferences: async (projectId, prefs) => {
    const prevConfig = get().config;
    if (prevConfig) {
      set({
        config: {
          ...prevConfig,
          ...(prefs.realtime_enabled !== undefined && { email_realtime_enabled: prefs.realtime_enabled }),
          ...(prefs.digest_enabled !== undefined && { email_digest_enabled: prefs.digest_enabled }),
          ...(prefs.digest_frequency !== undefined && { email_digest_frequency: prefs.digest_frequency }),
        },
      });
    }

    try {
      await fetch('/api/alerts/email/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, ...prefs }),
      });
    } catch {
      if (prevConfig) set({ config: prevConfig });
    }
  },

  connectTelegram: async (projectId) => {
    try {
      const res = await fetch('/api/alerts/telegram/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId }),
      });
      const json = await res.json();
      if (json.link) return { link: json.link, token: json.token };
      return null;
    } catch {
      return null;
    }
  },
}));
