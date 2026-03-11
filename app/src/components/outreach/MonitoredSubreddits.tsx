'use client';

import { useState } from 'react';
import { Plus, X, Power, PowerOff } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { OutreachMonitoredSub } from '@/types';

interface MonitoredSubredditsProps {
  subs: OutreachMonitoredSub[];
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
  onToggle: (id: string, isActive: boolean) => void;
  onSync?: () => void;
}

const safetyColors: Record<string, string> = {
  safe: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  caution: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  strict: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

function timeAgo(date: string | null): string {
  if (!date) return 'never';
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function MonitoredSubreddits({
  subs,
  onAdd,
  onRemove,
  onToggle,
  onSync,
}: MonitoredSubredditsProps) {
  const [input, setInput] = useState('');

  function handleAdd() {
    if (!input.trim()) return;
    onAdd(input.trim());
    setInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <h3 className="font-medium text-sm">Monitored Subreddits</h3>
        <p className="text-xs text-muted-foreground">
          Subreddits polled for keyword matches. Automatically synced from your project.
        </p>

        {/* Add input */}
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g., SaaS, startups, entrepreneur"
            className="text-xs h-8"
          />
          <Button onClick={handleAdd} size="sm" className="h-8 px-3" disabled={!input.trim()}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>

        {/* Sub list */}
        {subs.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            No subreddits monitored. Add manually or set them up in your project.
          </p>
        ) : (
          <div className="space-y-1.5">
            {subs.map((sub) => (
              <div
                key={sub.id}
                className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs"
              >
                <button
                  onClick={() => onToggle(sub.id, !sub.is_active)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {sub.is_active ? (
                    <Power className="h-3 w-3 text-green-500" />
                  ) : (
                    <PowerOff className="h-3 w-3 text-red-400" />
                  )}
                </button>
                <span className={`font-medium ${sub.is_active ? '' : 'opacity-50'}`}>
                  r/{sub.name}
                </span>
                <span className="text-[10px] text-muted-foreground ml-auto">
                  polled {timeAgo(sub.last_polled_at)}
                </span>
                <button
                  onClick={() => onRemove(sub.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
