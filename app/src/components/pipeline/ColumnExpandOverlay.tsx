'use client';

import { useEffect, useState, useMemo } from 'react';
import { X, Search } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { KanbanLeadCard } from './KanbanLeadCard';
import type { OutreachDM, PermissionType } from '@/types';

type KanbanStage = 'ready' | 'sent' | 'followup' | 'converted';

interface ColumnExpandOverlayProps {
  stage: KanbanStage | null;
  title: string;
  colorClass: string;
  dms: OutreachDM[];
  onClose: () => void;
  onDraft?: (dm: OutreachDM) => void;
  onStageChange: (dmId: string, stage: string, outcome?: string) => void;
  onDismiss?: (dmId: string) => void;
  onOpenConversation?: (dm: OutreachDM) => void;
}

export function ColumnExpandOverlay({
  stage,
  title,
  colorClass,
  dms,
  onClose,
  onDraft,
  onStageChange,
  onDismiss,
  onOpenConversation,
}: ColumnExpandOverlayProps) {
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest_intent'>('newest');
  const [intentFilter, setIntentFilter] = useState<Set<PermissionType>>(new Set());
  const [subredditFilter, setSubredditFilter] = useState<string>('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (stage) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [stage, onClose]);

  const subreddits = useMemo(() => {
    const subs = new Set<string>();
    dms.forEach(dm => { if (dm.signal?.subreddit) subs.add(dm.signal.subreddit); });
    return Array.from(subs).sort();
  }, [dms]);

  const filteredDms = useMemo(() => {
    let result = dms;

    if (intentFilter.size > 0) {
      result = result.filter(dm => intentFilter.has(dm.permission_type));
    }

    if (subredditFilter) {
      result = result.filter(dm => dm.signal?.subreddit === subredditFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(dm => dm.reddit_username.toLowerCase().includes(q));
    }

    return [...result].sort((a, b) => {
      if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortBy === 'highest_intent') return b.permission_score - a.permission_score;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [dms, sortBy, intentFilter, subredditFilter, search]);

  const toggleIntent = (type: PermissionType) => {
    setIntentFilter(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const filtersActive = intentFilter.size > 0 || subredditFilter !== '' || search.trim() !== '';

  return (
    <AnimatePresence>
      {stage && (
        <motion.div
          key="column-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ duration: 0.25 }}
            className="w-[calc(100%-48px)] max-w-[1400px] h-[calc(100vh-48px)] mx-6 my-6 bg-card border rounded-2xl overflow-hidden flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div className="flex items-center gap-3">
                <h2 className={`text-lg font-bold ${colorClass}`}>{title}</h2>
                <Badge variant="secondary" className="text-xs font-semibold">
                  {filtersActive
                    ? `${filteredDms.length} of ${dms.length} lead${dms.length !== 1 ? 's' : ''}`
                    : `${dms.length} lead${dms.length !== 1 ? 's' : ''}`}
                </Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Filter toolbar */}
            <div className="flex flex-wrap items-center gap-3 px-6 py-3 border-b bg-muted/30">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search username..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 w-48 pl-8 text-xs"
                />
              </div>

              {/* Intent chip toggles */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => toggleIntent('explicit_dm_request')}
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors border ${
                    intentFilter.has('explicit_dm_request')
                      ? 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/40'
                      : 'bg-transparent text-muted-foreground border-border hover:border-green-500/40 hover:text-green-700 dark:hover:text-green-400'
                  }`}
                >
                  DM Requested
                </button>
                <button
                  onClick={() => toggleIntent('positive_reply')}
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors border ${
                    intentFilter.has('positive_reply')
                      ? 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/40'
                      : 'bg-transparent text-muted-foreground border-border hover:border-blue-500/40 hover:text-blue-700 dark:hover:text-blue-400'
                  }`}
                >
                  Positive Reply
                </button>
                <button
                  onClick={() => toggleIntent('passive_commenter')}
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors border ${
                    intentFilter.has('passive_commenter')
                      ? 'bg-gray-500/20 text-gray-700 dark:text-gray-300 border-gray-500/40'
                      : 'bg-transparent text-muted-foreground border-border hover:border-gray-500/40 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  Commenter
                </button>
              </div>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Subreddit dropdown */}
              {subreddits.length > 0 && (
                <Select value={subredditFilter} onValueChange={(v) => setSubredditFilter(v === 'all' ? '' : v)}>
                  <SelectTrigger size="sm" className="h-8 text-xs w-44">
                    <SelectValue placeholder="All subreddits" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All subreddits</SelectItem>
                    {subreddits.map(sub => (
                      <SelectItem key={sub} value={sub}>r/{sub}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Sort dropdown */}
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                <SelectTrigger size="sm" className="h-8 text-xs w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                  <SelectItem value="highest_intent">Highest Intent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Body */}
            <ScrollArea className="flex-1 min-h-0 p-4">
              {filteredDms.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground text-sm">
                  {dms.length === 0 ? 'No leads in this stage yet.' : 'No leads match the current filters.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredDms.map((dm) => (
                    <KanbanLeadCard
                      key={dm.id}
                      dm={dm}
                      stage={stage!}
                      onDraft={onDraft}
                      onStageChange={onStageChange}
                      onDismiss={onDismiss}
                      onOpenConversation={onOpenConversation}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
