'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { OutreachDM } from '@/types';

export interface ChatPreview {
  text: string;
  fromYou: boolean;
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

function sendToExtension<T = unknown>(type: string, timeoutMs = 10_000): Promise<T> {
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

    window.postMessage(
      { target: 'superreddit-extension', type, requestId },
      '*'
    );
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

  // Listen for EXTENSION_READY heartbeat
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== window) return;
      if (
        event.data?.source === 'superreddit-extension' &&
        event.data?.type === 'EXTENSION_READY'
      ) {
        detectedRef.current = true;
        checkStatus();
      }
    }

    window.addEventListener('message', onMessage);

    // Fallback probe after 1.5s if no heartbeat received
    const probeTimer = setTimeout(() => {
      if (!detectedRef.current) {
        checkStatus().catch(() => {
          setStatus((s) => ({ ...s, checking: false }));
        });
      }
    }, 1500);

    return () => {
      window.removeEventListener('message', onMessage);
      clearTimeout(probeTimer);
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
        error?: string;
      }>('CHECK_STATUS', 5000);

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
      }>('CHECK_YOU_SENT_TO', 15_000);

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
      }>('CHECK_THEY_REPLIED', 15_000);

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
      }>('CHECK_PREVIEWS', 15_000);

      const p = result.previews || {};
      setPreviews(p);
      return p;
    } catch {
      return {};
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
        // (user definitely messaged them — "You:" was detected in their conversation)
        const youSentToUsernames = await checkYouSentTo();
        const sentSet = new Set(youSentToUsernames.map((u) => u.toLowerCase()));

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
        // AND card is currently in dm_sent. This prevents people who messaged
        // the user first from being auto-advanced.
        const theyRepliedUsernames = await checkTheyReplied();
        const repliedSet = new Set(theyRepliedUsernames.map((u) => u.toLowerCase()));

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
    checkYouSentTo,
    checkTheyReplied,
    fetchPreviews,
    reconcile,
  };
}
