'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { OutreachDM } from '@/types';

export interface ChatPreview {
  text: string;
  fromYou: boolean;
  theirText?: string | null;
}

export interface ConversationMessage {
  id: string;
  text: string;
  author: string;
  isFromYou: boolean;
  timestamp: number;
}

interface BridgeStatus {
  extensionInstalled: boolean;
  redditLoggedIn: boolean;
  redditUsername: string | null;
  checking: boolean;
  lastError: string | null;
  capturedCount: number;
  youSentToCount: number;
  theyRepliedCount: number;
}

const READY_STAGES = new Set(['detected', 'dm_ready', 'draft_generated']);

let requestCounter = 0;

function sendToExtension<T = unknown>(type: string, timeoutMs = 10_000, data?: Record<string, unknown>): Promise<T> {
  return new Promise((resolve, reject) => {
    const requestId = `sr_${++requestCounter}_${Date.now()}`;

    const timer = setTimeout(() => {
      window.removeEventListener('message', handler);
      reject(new Error('Extension response timeout'));
    }, timeoutMs);

    function handler(event: MessageEvent) {
      if (event.source !== window) return;
      if (!event.data || event.data.source !== 'superreddit-extension') return;
      if (event.data.requestId !== requestId) return;

      window.removeEventListener('message', handler);
      clearTimeout(timer);

      if (event.data.error) {
        reject(new Error(event.data.error));
      } else {
        resolve(event.data.data as T);
      }
    }

    window.addEventListener('message', handler);

    const msg: Record<string, unknown> = { target: 'superreddit-extension', type, requestId };
    if (data) msg.data = data;

    window.postMessage(msg, '*');
  });
}

export function useRedditBridge() {
  const [status, setStatus] = useState<BridgeStatus>({
    extensionInstalled: false,
    redditLoggedIn: false,
    redditUsername: null,
    checking: true,
    lastError: null,
    capturedCount: 0,
    youSentToCount: 0,
    theyRepliedCount: 0,
  });

  const [reconciling, setReconciling] = useState(false);
  const [previews, setPreviews] = useState<Record<string, ChatPreview>>({});
  const detectedRef = useRef(false);
  // Store full username arrays from status polling as state (triggers re-renders for sync)
  const [youSentToList, setYouSentToList] = useState<string[]>([]);
  const [theyRepliedList, setTheyRepliedList] = useState<string[]>([]);

  // Listen for EXTENSION_READY heartbeat + poll status while scanning
  useEffect(() => {
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let pollCount = 0;
    const MAX_POLLS = 20; // 20 × 3s = 60s max polling

    function startPolling() {
      if (pollTimer) return;
      console.log('[SR Bridge] Starting status polling (every 3s)');
      pollTimer = setInterval(() => {
        pollCount++;
        console.log('[SR Bridge] Poll #' + pollCount);
        checkStatus();
        if (pollCount >= MAX_POLLS) {
          console.log('[SR Bridge] Polling complete (' + MAX_POLLS + ' polls)');
          if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
        }
      }, 3000);
    }

    function onMessage(event: MessageEvent) {
      if (event.source !== window) return;
      if (
        event.data?.source === 'superreddit-extension' &&
        event.data?.type === 'EXTENSION_READY'
      ) {
        detectedRef.current = true;
        checkStatus();
        startPolling();
      }
    }

    window.addEventListener('message', onMessage);

    // Fallback probe after 1.5s if no heartbeat received
    const probeTimer = setTimeout(() => {
      if (!detectedRef.current) {
        checkStatus().then(() => {
          startPolling();
        }).catch(() => {
          setStatus((s) => ({ ...s, checking: false }));
        });
      }
    }, 1500);

    return () => {
      window.removeEventListener('message', onMessage);
      clearTimeout(probeTimer);
      if (pollTimer) clearInterval(pollTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkStatus() {
    try {
      const result = await sendToExtension<{
        installed: boolean;
        redditLoggedIn: boolean;
        username: string | null;
        capturedCount?: number;
        youSentToCount?: number;
        theyRepliedCount?: number;
        youSentTo?: string[];
        theyReplied?: string[];
        error?: string;
      }>('CHECK_STATUS', 5000);

      console.log('[SR Bridge] CHECK_STATUS:', { captured: result.capturedCount, sent: result.youSentToCount, replied: result.theyRepliedCount, hasArrays: !!(result.youSentTo?.length) });
      // Save full username arrays for bridge sync (state so pipeline effect triggers)
      if (result.youSentTo && result.youSentTo.length > 0) {
        setYouSentToList(result.youSentTo);
      }
      if (result.theyReplied && result.theyReplied.length > 0) {
        setTheyRepliedList(result.theyReplied);
      }

      // If extension returned counts but not arrays, fetch arrays explicitly
      if ((result.youSentToCount || 0) > 0 && (!result.youSentTo || result.youSentTo.length === 0)) {
        try {
          const sentResult = await sendToExtension<{ usernames: string[] }>('CHECK_YOU_SENT_TO', 3000);
          if (sentResult.usernames?.length > 0) {
            console.log('[SR Bridge] Fetched youSentTo arrays explicitly:', sentResult.usernames.length);
            setYouSentToList(sentResult.usernames);
          }
        } catch { /* extension may not support this command */ }
      }
      if ((result.theyRepliedCount || 0) > 0 && (!result.theyReplied || result.theyReplied.length === 0)) {
        try {
          const repliedResult = await sendToExtension<{ usernames: string[] }>('CHECK_THEY_REPLIED', 3000);
          if (repliedResult.usernames?.length > 0) {
            console.log('[SR Bridge] Fetched theyReplied arrays explicitly:', repliedResult.usernames.length);
            setTheyRepliedList(repliedResult.usernames);
          }
        } catch { /* extension may not support this command */ }
      }

      setStatus({
        extensionInstalled: true,
        redditLoggedIn: result.redditLoggedIn,
        redditUsername: result.username,
        checking: false,
        lastError: result.error || null,
        capturedCount: result.capturedCount || 0,
        youSentToCount: result.youSentToCount || 0,
        theyRepliedCount: result.theyRepliedCount || 0,
      });
    } catch {
      setStatus((s) => ({
        ...s,
        extensionInstalled: detectedRef.current,
        checking: false,
        lastError: detectedRef.current ? 'Failed to check Reddit status' : null,
      }));
    }
  }

  const checkYouSentTo = useCallback(async (): Promise<string[]> => {
    try {
      const result = await sendToExtension<{
        usernames: string[];
        error?: string;
      }>('CHECK_YOU_SENT_TO', 3_000);

      const usernames = result.usernames || [];
      if (usernames.length > 0) {
        setStatus((s) => ({ ...s, youSentToCount: usernames.length }));
      }
      return usernames;
    } catch {
      return [];
    }
  }, []);

  const checkTheyReplied = useCallback(async (): Promise<string[]> => {
    try {
      const result = await sendToExtension<{
        usernames: string[];
        error?: string;
      }>('CHECK_THEY_REPLIED', 3_000);

      const usernames = result.usernames || [];
      if (usernames.length > 0) {
        setStatus((s) => ({ ...s, theyRepliedCount: usernames.length }));
      }
      return usernames;
    } catch {
      return [];
    }
  }, []);

  const fetchPreviews = useCallback(async (): Promise<Record<string, ChatPreview>> => {
    try {
      const result = await sendToExtension<{
        previews: Record<string, ChatPreview>;
        error?: string;
      }>('CHECK_PREVIEWS', 3_000);

      const p = result.previews || {};
      setPreviews(p);
      return p;
    } catch {
      return {};
    }
  }, []);

  const sendDm = useCallback(async (username: string, subject: string, body: string): Promise<{
    success: boolean;
    error?: string;
    rateLimited?: boolean;
    retryAfterMs?: number;
  }> => {
    try {
      const result = await sendToExtension<{
        success: boolean;
        error?: string;
        rateLimited?: boolean;
        retryAfterMs?: number;
      }>('SEND_DM', 35_000, { username, subject, body });

      return result;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error sending DM' };
    }
  }, []);

  const fetchConversation = useCallback(async (username: string): Promise<ConversationMessage[]> => {
    try {
      const result = await sendToExtension<{
        messages: ConversationMessage[];
        lastUpdated: number | null;
        source: string | null;
        error?: string;
      }>('GET_FULL_CONVERSATION', 5_000, { username: username.toLowerCase() });

      return result.messages || [];
    } catch {
      return [];
    }
  }, []);

  const reconcile = useCallback(
    async (
      allDms: OutreachDM[],
      onStageChange: (dmId: string, stage: string) => Promise<void> | void
    ): Promise<{ sent: number; replied: number }> => {
      setReconciling(true);
      try {
        // Step 1: Advance "ready" → "dm_sent" ONLY if username is in youSentTo
        const youSentToUsernames = await checkYouSentTo();
        const sentSet = new Set(youSentToUsernames.map((u) => u.toLowerCase()));

        const readyDms = allDms.filter((dm) => READY_STAGES.has(dm.pipeline_stage));
        const readyUsernames = readyDms.map((dm) => dm.reddit_username.toLowerCase());
        const matchedSent = readyUsernames.filter((u) => sentSet.has(u));
        const unmatchedSent = Array.from(sentSet).filter((u) => !readyUsernames.includes(u) && !allDms.some((dm) => dm.reddit_username.toLowerCase() === u));
        console.log('[SR Reconcile] Extension youSentTo:', sentSet.size, '| Pipeline READY:', readyDms.length, '| Matched:', matchedSent.length, '| Not in pipeline:', unmatchedSent.length);
        if (unmatchedSent.length > 0 && unmatchedSent.length <= 20) console.log('[SR Reconcile] youSentTo not in pipeline:', unmatchedSent);

        let sentCount = 0;
        if (sentSet.size > 0) {
          const toAdvance = allDms.filter(
            (dm) =>
              READY_STAGES.has(dm.pipeline_stage) &&
              sentSet.has(dm.reddit_username.toLowerCase())
          );

          for (const dm of toAdvance) {
            await onStageChange(dm.id, 'dm_sent');
          }
          sentCount = toAdvance.length;
        }

        // Step 2: Advance "dm_sent" → "responded" ONLY if username is in theyReplied
        const theyRepliedUsernames = await checkTheyReplied();
        const repliedSet = new Set(theyRepliedUsernames.map((u) => u.toLowerCase()));
        console.log('[SR Reconcile] Extension theyReplied:', repliedSet.size, '| allDms:', allDms.length, '| sentCount just advanced:', sentCount);

        let repliedCount = 0;
        if (repliedSet.size > 0) {
          const toMarkReplied = allDms.filter(
            (dm) => {
              const uLower = dm.reddit_username.toLowerCase();
              if (!repliedSet.has(uLower)) return false;
              // Already in dm_sent from a previous reconciliation
              if (dm.pipeline_stage === 'dm_sent') return true;
              // Just moved to dm_sent in Step 1 above (allDms has stale stage)
              if (READY_STAGES.has(dm.pipeline_stage) && sentSet.has(uLower)) return true;
              return false;
            }
          );

          for (const dm of toMarkReplied) {
            await onStageChange(dm.id, 'responded');
          }
          repliedCount = toMarkReplied.length;
        }

        // Step 3: Fetch message previews for display on cards
        await fetchPreviews();

        setReconciling(false);
        return { sent: sentCount, replied: repliedCount };
      } catch {
        setReconciling(false);
        return { sent: 0, replied: 0 };
      }
    },
    [checkYouSentTo, checkTheyReplied, fetchPreviews]
  );

  return {
    status,
    reconciling,
    previews,
    youSentToList,
    theyRepliedList,
    sendDm,
    fetchConversation,
    checkYouSentTo,
    checkTheyReplied,
    fetchPreviews,
    reconcile,
  };
}
