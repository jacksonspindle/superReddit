'use client';

import { useEffect } from 'react';
import { X, ExternalLink, Check, ArrowRight, Clock, AlertCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { timeAgo, followUpStatus } from '@/lib/time';
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

const permissionConfig: Record<PermissionType, { label: string; className: string }> = {
  explicit_dm_request: {
    label: 'DM requested',
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  },
  positive_reply: {
    label: 'Positive reply',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  },
  passive_commenter: {
    label: 'Commenter',
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
  },
};

function getInitials(username: string): string {
  return username.slice(0, 2).toUpperCase();
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
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (stage) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [stage, onClose]);

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
                  {dms.length} lead{dms.length !== 1 ? 's' : ''}
                </Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Body */}
            <ScrollArea className="flex-1 p-4">
              {dms.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground text-sm">
                  No leads in this stage yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {dms.map((dm) => {
                    const permission = permissionConfig[dm.permission_type] || permissionConfig.passive_commenter;
                    const fuStatus = followUpStatus(dm.follow_up_due);

                    return (
                      <div
                        key={dm.id}
                        className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-card/80 hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={(e) => {
                          const target = e.target as HTMLElement;
                          if (target.closest('button, a, input, [role="button"]')) return;
                          onOpenConversation?.(dm);
                        }}
                      >
                        {/* Avatar */}
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="text-[10px] font-semibold">
                            {getInitials(dm.reddit_username)}
                          </AvatarFallback>
                        </Avatar>

                        {/* User info */}
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">u/{dm.reddit_username}</span>
                            {dm.signal?.subreddit && (
                              <span className="text-[11px] text-muted-foreground">r/{dm.signal.subreddit}</span>
                            )}
                            <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${permission.className}`}>
                              {permission.label}
                            </Badge>
                            {dm.touch_number > 0 && stage !== 'ready' && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                Touch {dm.touch_number}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 min-w-0">
                            {dm.signal && (
                              <a
                                href={`https://reddit.com${dm.signal.permalink}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] text-muted-foreground hover:underline flex items-center gap-0.5 truncate"
                              >
                                <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                                {dm.signal.title}
                              </a>
                            )}
                          </div>
                          {dm.comment_text && (
                            <p className="text-[11px] text-muted-foreground italic line-clamp-1">
                              &ldquo;{dm.comment_text}&rdquo;
                            </p>
                          )}
                        </div>

                        {/* Time */}
                        <div className="shrink-0 text-right space-y-0.5">
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 justify-end">
                            <Clock className="h-2.5 w-2.5" />
                            {timeAgo(dm.dm_sent_at || dm.created_at)}
                          </span>
                          {stage === 'followup' && fuStatus && (
                            <div className={`text-[10px] flex items-center gap-0.5 justify-end ${fuStatus.overdue ? 'text-red-500' : 'text-yellow-600'}`}>
                              <AlertCircle className="h-2.5 w-2.5" />
                              {fuStatus.label}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          {stage === 'ready' && (
                            <>
                              <Button size="sm" className="h-7 text-[11px] px-2" onClick={() => onDraft?.(dm)}>
                                Draft DM <ArrowRight className="ml-0.5 h-3 w-3" />
                              </Button>
                              {onDismiss && (
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => onDismiss(dm.id)}>
                                  <X className="h-3 w-3" />
                                </Button>
                              )}
                            </>
                          )}
                          {stage === 'sent' && (
                            <>
                              <Button variant="outline" size="sm" className="h-7 text-[11px] px-2 text-green-600" onClick={() => onStageChange(dm.id, 'responded', 'replied')}>
                                <Check className="mr-0.5 h-3 w-3" /> Got Reply
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 text-[11px] px-2" onClick={() => onStageChange(dm.id, 'closed', 'no_response')}>
                                No Response
                              </Button>
                            </>
                          )}
                          {stage === 'followup' && (
                            <>
                              <Button size="sm" className="h-7 text-[11px] px-2" onClick={() => onDraft?.(dm)}>
                                Follow-up <ArrowRight className="ml-0.5 h-3 w-3" />
                              </Button>
                              <Button variant="outline" size="sm" className="h-7 text-[11px] px-2 text-green-600" onClick={() => onStageChange(dm.id, 'converted')}>
                                <Check className="mr-0.5 h-3 w-3" /> Converted
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
