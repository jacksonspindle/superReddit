'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, Send, Unplug, Wifi } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { OutreachConfig } from '@/types';

interface TelegramConnectProps {
  config: OutreachConfig | null;
  projectId: string;
  onDisconnect: () => void;
}

export function TelegramConnect({ config, projectId, onDisconnect }: TelegramConnectProps) {
  const [connecting, setConnecting] = useState(false);
  const [telegramLink, setTelegramLink] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const pollCountRef = useRef(0);

  const isConnected = config?.telegram_connected;

  // Polling effect: checks outreach config every 3s for up to 2 minutes
  useEffect(() => {
    if (!polling) return;

    pollCountRef.current = 0;

    const interval = setInterval(async () => {
      pollCountRef.current += 1;

      if (pollCountRef.current > 40) {
        setPolling(false);
        clearInterval(interval);
        toast.error('Telegram connection timed out. Please try again.');
        return;
      }

      try {
        const res = await fetch(
          `/api/outreach/config?project_id=${projectId}`
        );
        const json = await res.json();

        if (json?.config?.telegram_connected) {
          setPolling(false);
          clearInterval(interval);
          toast.success('Telegram connected!');
          window.location.reload();
        }
      } catch {
        // Silently retry on network errors
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [polling, projectId]);

  async function handleConnect() {
    setConnecting(true);
    try {
      const res = await fetch('/api/alerts/telegram/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId }),
      });
      const json = await res.json();

      if (json.error) {
        toast.error(json.error);
      } else if (json.link) {
        setTelegramLink(json.link);
        setPolling(true);
      }
    } catch {
      toast.error('Failed to start Telegram connection');
    }
    setConnecting(false);
  }

  // State 2: Connected
  if (isConnected) {
    return (
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wifi className="h-4 w-4 text-green-500" />
              <Send className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">Telegram Connected</span>
              <Badge
                variant="secondary"
                className="text-[10px] bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
              >
                Active
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={onDisconnect}
            >
              <Unplug className="mr-1 h-3 w-3" />
              Disconnect
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Connected as{' '}
            <span className="font-medium text-foreground">
              @{config?.telegram_username}
            </span>
          </p>
        </CardContent>
      </Card>
    );
  }

  // State 1: Disconnected (with link shown after initial connect)
  if (telegramLink) {
    return (
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">Connect Telegram</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Click the button below to open Telegram and authorize the bot.
            This page will update automatically once connected.
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => window.open(telegramLink, '_blank')}
            >
              Open in Telegram
            </Button>
            {polling && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Waiting for connection...
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // State 1: Disconnected (initial)
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Send className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">Telegram Alerts</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Connect Telegram to receive instant signal alerts via the SuperReddit
          bot.
        </p>
        <Button onClick={handleConnect} disabled={connecting} size="sm">
          {connecting && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
          Connect Telegram
        </Button>
      </CardContent>
    </Card>
  );
}
