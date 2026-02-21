'use client';

import { useState } from 'react';
import { Hash, Loader2, Unplug, Wifi } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { OutreachConfig } from '@/types';

interface SlackConnectProps {
  config: OutreachConfig | null;
  projectId: string;
  onDisconnect: () => void;
}

export function SlackConnect({ config, projectId, onDisconnect }: SlackConnectProps) {
  const [connecting, setConnecting] = useState(false);

  const isConnected = config?.slack_connected;

  async function handleConnect() {
    setConnecting(true);
    try {
      const res = await fetch(`/api/slack/auth-url?project_id=${projectId}`);
      const json = await res.json();

      if (json.error) {
        toast.error(json.error);
      } else if (json.auth_url) {
        window.location.href = json.auth_url;
      }
    } catch {
      toast.error('Failed to start Slack connection');
    }
    setConnecting(false);
  }

  if (isConnected) {
    return (
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wifi className="h-4 w-4 text-green-500" />
              <Hash className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">Slack Connected</span>
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
          <div className="text-xs text-muted-foreground">
            <p>
              Workspace:{' '}
              <span className="font-medium text-foreground">
                {config?.slack_team_name}
              </span>
            </p>
            <p>
              Channel:{' '}
              <span className="font-medium text-foreground">
                #{config?.slack_channel_name}
              </span>
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Hash className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">Slack Alerts</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Connect your Slack workspace to receive real-time alerts when Reddit
          posts match your keywords.
        </p>
        <Button onClick={handleConnect} disabled={connecting} size="sm">
          {connecting && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
          Connect to Slack
        </Button>
      </CardContent>
    </Card>
  );
}
