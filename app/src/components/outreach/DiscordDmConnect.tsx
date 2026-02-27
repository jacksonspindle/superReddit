'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, Unplug, MessageCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { OutreachConfig } from '@/types';

interface DiscordDmConnectProps {
  config: OutreachConfig | null;
  projectId: string;
  onDisconnect: () => void;
}

export function DiscordDmConnect({ config, projectId, onDisconnect }: DiscordDmConnectProps) {
  const [connecting, setConnecting] = useState(false);
  const [polling, setPolling] = useState(false);
  const pollCountRef = useRef(0);

  const isConnected = config?.discord_dm_connected && config?.discord_dm_user_id;

  useEffect(() => {
    if (!polling) return;

    pollCountRef.current = 0;

    const interval = setInterval(async () => {
      pollCountRef.current += 1;

      if (pollCountRef.current > 40) {
        setPolling(false);
        clearInterval(interval);
        toast.error('Discord DM connection timed out. Please try again.');
        return;
      }

      try {
        const res = await fetch(`/api/outreach/config?project_id=${projectId}`);
        const json = await res.json();

        if (json?.config?.discord_dm_connected) {
          setPolling(false);
          clearInterval(interval);
          toast.success('Discord DMs connected!');
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
      const res = await fetch(`/api/discord/dm-auth-url?project_id=${projectId}`);
      const json = await res.json();

      if (json.error) {
        toast.error(json.error);
      } else if (json.auth_url) {
        window.open(json.auth_url, '_blank', 'width=600,height=700');
        setPolling(true);
      }
    } catch {
      toast.error('Failed to start Discord DM connection');
    }
    setConnecting(false);
  }

  if (isConnected) {
    return (
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-green-500" />
              <span className="font-medium text-sm">Discord DMs</span>
              <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
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
          <div className="text-xs text-muted-foreground">
            <p>Receiving alerts via DM as <span className="font-medium text-foreground">{config?.discord_dm_username}</span></p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">Discord DMs</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Get alerts delivered directly to your Discord DMs. No server needed — just authorize your account.
        </p>
        <div className="flex items-center gap-2">
          <Button onClick={handleConnect} disabled={connecting || polling} size="sm">
            {connecting && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            Connect DMs
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
