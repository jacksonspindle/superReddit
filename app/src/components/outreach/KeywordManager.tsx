'use client';

import { useState } from 'react';
import { Plus, X, Power, PowerOff } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { OutreachKeyword } from '@/types';

interface KeywordManagerProps {
  keywords: OutreachKeyword[];
  onAdd: (phrases: string[]) => void;
  onRemove: (id: string) => void;
  onToggle: (id: string, isActive: boolean) => void;
}

export function KeywordManager({ keywords, onAdd, onRemove, onToggle }: KeywordManagerProps) {
  const [input, setInput] = useState('');

  function handleAdd() {
    const phrases = input
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    if (phrases.length === 0) return;

    onAdd(phrases);
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
        <h3 className="font-medium text-sm">Keywords</h3>
        <p className="text-xs text-muted-foreground">
          Add comma-separated phrases to monitor. Posts matching these phrases trigger Discord alerts.
        </p>

        {/* Add input */}
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g., alternative to, best tool for, tired of"
            className="text-xs h-8"
          />
          <Button onClick={handleAdd} size="sm" className="h-8 px-3" disabled={!input.trim()}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>

        {/* Keyword list */}
        {keywords.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No keywords added yet.</p>
        ) : (
          <div className="space-y-1.5">
            {keywords.map((kw) => (
              <div
                key={kw.id}
                className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs"
              >
                <button
                  onClick={() => onToggle(kw.id, !kw.is_active)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {kw.is_active ? (
                    <Power className="h-3 w-3 text-green-500" />
                  ) : (
                    <PowerOff className="h-3 w-3 text-red-400" />
                  )}
                </button>
                <div className="flex flex-wrap gap-1 flex-1">
                  {kw.phrases.map((phrase) => (
                    <Badge
                      key={phrase}
                      variant="secondary"
                      className={`text-[10px] px-1.5 py-0 ${
                        kw.is_active ? '' : 'opacity-50'
                      }`}
                    >
                      {phrase}
                    </Badge>
                  ))}
                </div>
                <span className="text-[10px] text-muted-foreground">{kw.source}</span>
                <button
                  onClick={() => onRemove(kw.id)}
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
