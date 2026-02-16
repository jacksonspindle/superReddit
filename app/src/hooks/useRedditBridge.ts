'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { OutreachDM } from '@/types';

interface BridgeStatus {
  extensionInstalled: boolean;
  redditLoggedIn: boolean;
  redditUsername: string | null;
  checking: boolean;
  lastError: string | null;
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
  });

  const [reconciling, setReconciling] = useState(false);
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
        error?: string;
      }>('CHECK_STATUS', 5000);

      setStatus({
        extensionInstalled: true,
        redditLoggedIn: result.redditLoggedIn,
        redditUsername: result.username,
        checking: false,
        lastError: result.error || null,
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

  const checkSentMessages = useCallback(async (): Promise<string[]> => {
    try {
      const result = await sendToExtension<{
        usernames: string[];
        error?: string;
        after?: string | null;
      }>('CHECK_SENT_MESSAGES', 15_000);

      return result.usernames || [];
    } catch {
      return [];
    }
  }, []);

  const reconcile = useCallback(
    async (
      allDms: OutreachDM[],
      onStageChange: (dmId: string, stage: string) => Promise<void> | void
    ): Promise<number> => {
      setReconciling(true);
      try {
        const sentUsernames = await checkSentMessages();
        if (sentUsernames.length === 0) {
          setReconciling(false);
          return 0;
        }

        const sentSet = new Set(sentUsernames.map((u) => u.toLowerCase()));

        const toAdvance = allDms.filter(
          (dm) =>
            READY_STAGES.has(dm.pipeline_stage) &&
            sentSet.has(dm.reddit_username.toLowerCase())
        );

        for (const dm of toAdvance) {
          await onStageChange(dm.id, 'dm_sent');
        }

        setReconciling(false);
        return toAdvance.length;
      } catch {
        setReconciling(false);
        return 0;
      }
    },
    [checkSentMessages]
  );

  return {
    status,
    reconciling,
    checkSentMessages,
    reconcile,
  };
}
