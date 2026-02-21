'use client';

import { create } from 'zustand';
import type {
  OutreachConfig,
  OutreachKeyword,
  OutreachMonitoredSub,
  OutreachSignal,
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

  // Recent alerts (signals with discord_alert_status)
  recentAlerts: OutreachSignal[];
  alertsLoading: boolean;

  // Actions
  fetchConfig: (projectId: string) => Promise<void>;
  fetchKeywords: (projectId: string) => Promise<void>;
  fetchMonitoredSubs: (projectId: string) => Promise<void>;
  fetchRecentAlerts: (projectId: string) => Promise<void>;
  addKeyword: (projectId: string, phrases: string[]) => Promise<void>;
  removeKeyword: (keywordId: string) => Promise<void>;
  toggleKeyword: (keywordId: string, isActive: boolean) => Promise<void>;
  addMonitoredSub: (projectId: string, name: string) => Promise<void>;
  removeMonitoredSub: (subId: string) => Promise<void>;
  toggleMonitoredSub: (subId: string, isActive: boolean) => Promise<void>;
  syncSubsFromProject: (projectId: string) => Promise<void>;
  disconnectDiscord: (projectId: string) => Promise<void>;
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
    const prevConfig = get().config;
    if (prevConfig) {
      set({
        config: {
          ...prevConfig,
          discord_connected: false,
          discord_guild_id: null,
          discord_guild_name: null,
          discord_channel_id: null,
          discord_webhook_url: null,
        },
      });
    }

    try {
      await fetch('/api/outreach/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          discord_connected: false,
          discord_guild_id: null,
          discord_guild_name: null,
          discord_channel_id: null,
          discord_webhook_url: null,
        }),
      });
    } catch {
      if (prevConfig) set({ config: prevConfig });
    }
  },
}));
