'use client';

import { Loader2, Unplug, Wifi } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { AlertChannel } from '@/types';

interface AlertChannelCardProps {
  channel: AlertChannel;
  title: string;
  description: string;
  icon: React.ReactNode;
  connected: boolean;
  connectionDetail?: string;
  onConnect: () => void;
  onDisconnect: () => void;
  connecting?: boolean;
  children?: React.ReactNode;
}

export function AlertChannelCard({
  channel,
  title,
  description,
  icon,
  connected,
  connectionDetail,
  onConnect,
  onDisconnect,
  connecting,
  children,
}: AlertChannelCardProps) {
  if (connected) {
    return (
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wifi className="h-4 w-4 text-green-500" />
              {icon}
              <span className="font-medium text-sm">{title}</span>
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
          {connectionDetail && (
            <p className="text-xs text-muted-foreground">{connectionDetail}</p>
          )}
          {children}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-sm">{title}</span>
          <Badge
            variant="secondary"
            className="text-[10px] bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
          >
            Not connected
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
        <Button onClick={onConnect} disabled={connecting} size="sm">
          {connecting && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
          Connect
        </Button>
      </CardContent>
    </Card>
  );
}
