'use client';

import { Server, Terminal, ClipboardPaste } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const integrations = [
  {
    icon: Server,
    title: 'MCP Server',
    badge: 'Lowest friction',
    description:
      'Add SuperReddit as an MCP server in your Claude Code config. Claude can access your product context and subreddit data directly.',
  },
  {
    icon: Terminal,
    title: 'CLI Sync',
    badge: 'Automatic',
    description:
      'Run `npx superreddit connect` to automatically sync your build context from Claude Code to SuperReddit.',
  },
  {
    icon: ClipboardPaste,
    title: 'Manual Paste',
    badge: 'No setup',
    description:
      'Paste Claude conversation summaries or your CLAUDE.md content directly.',
  },
];

export default function ClaudePage() {
  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Claude Integration</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your Claude workflow to keep product context in sync automatically.
        </p>
      </div>

      <div className="space-y-4">
        {integrations.map((item) => (
          <Card key={item.title} className="relative overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base">{item.title}</CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">
                      {item.badge}
                    </Badge>
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      Coming Soon
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm">
                {item.description}
              </CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
