'use client';

import { useState } from 'react';
import { Filter, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';

function getSubredditColor(sub: string): string {
  const colors = [
    'bg-purple-500', 'bg-orange-500', 'bg-cyan-500', 'bg-blue-500',
    'bg-pink-500', 'bg-green-500', 'bg-red-500', 'bg-yellow-500',
  ];
  let hash = 0;
  for (let i = 0; i < sub.length; i++) hash = sub.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

interface SubredditFilterPopoverProps {
  trackedSubreddits: string[];
  selectedSubreddits: Set<string>;
  onToggle: (sub: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onAddSubreddit?: (sub: string) => void;
}

export function SubredditFilterPopover({
  trackedSubreddits,
  selectedSubreddits,
  onToggle,
  onSelectAll,
  onDeselectAll,
  onAddSubreddit,
}: SubredditFilterPopoverProps) {
  const allSelected = selectedSubreddits.size === trackedSubreddits.length;
  const noneSelected = selectedSubreddits.size === 0;
  const [inputValue, setInputValue] = useState('');

  function handleAdd() {
    const raw = inputValue.trim().replace(/^\/?r\//, '').toLowerCase();
    if (!raw) return;
    if (trackedSubreddits.includes(raw)) {
      // Already tracked — just select it
      if (!selectedSubreddits.has(raw)) onToggle(raw);
    } else {
      onAddSubreddit?.(raw);
    }
    setInputValue('');
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md transition-colors',
            allSelected
              ? 'text-muted-foreground hover:bg-muted'
              : 'text-primary bg-primary/10 hover:bg-primary/15'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <Filter className="h-3 w-3" />
          {allSelected ? 'Filter' : `${selectedSubreddits.size}/${trackedSubreddits.length}`}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-56 p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-2 border-b flex items-center justify-between">
          <span className="text-xs font-semibold">Filter Subreddits</span>
          <div className="flex gap-1.5">
            <button
              onClick={onSelectAll}
              disabled={allSelected}
              className="text-[10px] font-medium text-primary hover:underline disabled:opacity-40 disabled:no-underline"
            >
              All
            </button>
            <span className="text-muted-foreground text-[10px]">/</span>
            <button
              onClick={onDeselectAll}
              disabled={noneSelected}
              className="text-[10px] font-medium text-primary hover:underline disabled:opacity-40 disabled:no-underline"
            >
              None
            </button>
          </div>
        </div>
        <div className="max-h-48 overflow-y-auto py-1">
          {trackedSubreddits.map((sub) => {
            const checked = selectedSubreddits.has(sub);
            return (
              <button
                key={sub}
                onClick={() => onToggle(sub)}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-muted/50 transition-colors"
              >
                <div
                  className={cn(
                    'h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 transition-colors',
                    checked
                      ? 'bg-primary border-primary'
                      : 'border-muted-foreground/30'
                  )}
                >
                  {checked && (
                    <svg className="h-2.5 w-2.5 text-primary-foreground" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', getSubredditColor(sub))} />
                <span className="text-xs truncate">r/{sub}</span>
              </button>
            );
          })}
        </div>
        {onAddSubreddit && (
          <div className="px-2 py-2 border-t">
            <form
              onSubmit={(e) => { e.preventDefault(); handleAdd(); }}
              className="flex items-center gap-1.5"
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Add subreddit..."
                className="flex-1 min-w-0 text-xs bg-muted/50 rounded-md px-2 py-1.5 outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary/30"
              />
              <button
                type="submit"
                disabled={!inputValue.trim()}
                className="shrink-0 h-6 w-6 rounded-md bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        )}
        {noneSelected && (
          <div className="px-3 py-2 border-t">
            <p className="text-[10px] text-muted-foreground">Select at least one subreddit to see leads.</p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
