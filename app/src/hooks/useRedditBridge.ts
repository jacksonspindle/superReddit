'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { OutreachDM } from '@/types';

interface BridgeStatus {
  extensionInstalled: boolean;
  redditLoggedIn: boolean;
  redditUsername: string | null;
  checking: boolean;
  lastError: string | null;
  capturedCount: number;
  replyCount: number;
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
    replyCount: 0,
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
        capturedCount?: number;
        replyCount?: number;
        error?: string;
      }>('CHECK_STATUS', 5000);

      setStatus({
        extensionInstalled: true,
        redditLoggedIn: result.redditLoggedIn,
        redditUsername: result.username,
        checking: false,
        lastError: result.error || null,
        capturedCount: result.capturedCount || 0,
        replyCount: result.replyCount || 0,
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
      }>('CHECK_SENT_MESSAGES', 15_000);

      return result.usernames || [];
    } catch {
      return [];
    }
  }, []);

  const checkReplies = useCallback(async (): Promise<string[]> => {
    try {
      const result = await sendToExtension<{
        replies: string[];
        error?: string;
      }>('CHECK_REPLIES', 15_000);

      return result.replies || [];
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
        // Step 1: Advance "ready" → "dm_sent" for users we've messaged
        const sentUsernames = await checkSentMessages();
        const sentSet = new Set(sentUsernames.map((u) => u.toLowerCase()));

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

        // Step 2: Advance "dm_sent" → "responded" for users who replied
        const repliedUsernames = await checkReplies();
        const repliedSet = new Set(repliedUsernames.map((u) => u.toLowerCase()));

        let repliedCount = 0;
        if (repliedSet.size > 0) {
          // Re-read allDms state after sent advances (use the updated stages)
          // We need to check against dm_sent stage
          const toMarkReplied = allDms.filter(
            (dm) =>
              // Check both original dm_sent AND ones we just advanced
              (dm.pipeline_stage === 'dm_sent' || (READY_STAGES.has(dm.pipeline_stage) && sentSet.has(dm.reddit_username.toLowerCase()))) &&
              repliedSet.has(dm.reddit_username.toLowerCase())
          );

          for (const dm of toMarkReplied) {
            await onStageChange(dm.id, 'responded');
          }
          repliedCount = toMarkReplied.length;
        }

        setReconciling(false);
        return { sent: sentCount, replied: repliedCount };
      } catch {
        setReconciling(false);
        return { sent: 0, replied: 0 };
      }
    },
    [checkSentMessages, checkReplies]
  );

  return {
    status,
    reconciling,
    checkSentMessages,
    checkReplies,
    reconcile,
  };
}
