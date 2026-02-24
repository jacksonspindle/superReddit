'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { X, ExternalLink, ArrowRight, Clock, AlertCircle, MessageSquare, Undo2 } from 'lucide-react';
import { motion } from 'motion/react';
import { Badge } from '@/components/ui/badge';
import { cardHover, cardTap } from '@/lib/motion';
import { timeAgo, followUpStatus } from '@/lib/time';
import type { OutreachDM, PermissionType } from '@/types';
import type { ChatPreview } from '@/hooks/useRedditBridge';

type KanbanStage = 'ready' | 'sent' | 'followup' | 'converted';

interface KanbanLeadCardProps {
  dm: OutreachDM;
  stage: KanbanStage;
  chatPreview?: ChatPreview;
  selected?: boolean;
  isDragging?: boolean;
  onSelect?: (id: string) => void;
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

export function KanbanLeadCard({
  dm,
  stage,
  chatPreview,
  selected,
  isDragging,
  onSelect,
  onDraft,
  onStageChange,
  onDismiss,
  onOpenConversation,
}: KanbanLeadCardProps) {
  const { setNodeRef, transform, listeners, attributes } = useDraggable({ id: dm.id });
  const permission = permissionConfig[dm.permission_type] || permissionConfig.passive_commenter;
  const subreddit = dm.signal?.subreddit || '';
  const threadTitle = dm.signal?.title || 'Thread';
  const fuStatus = followUpStatus(dm.follow_up_due);

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      whileHover={isDragging ? undefined : cardHover}
      whileTap={isDragging ? undefined : cardTap}
      className={`w-full min-w-0 ${isDragging ? 'opacity-30' : ''}`}
    >
      <div
        className="w-full rounded-lg border border-border bg-card/80 p-3 transition-shadow hover:shadow-md cursor-pointer"
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('button, a, input, [role="button"]')) return;
          onOpenConversation?.(dm);
        }}
      >
        {/* Header: checkbox + avatar + name + actions */}
        <div className="flex items-center gap-2 mb-2">
          {stage === 'ready' && onSelect && (
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onSelect(dm.id)}
              className="h-3.5 w-3.5 rounded border-border cursor-pointer shrink-0"
            />
          )}
          <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
            <span className="text-[10px] font-semibold text-muted-foreground">
              {getInitials(dm.reddit_username)}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium text-sm truncate">u/{dm.reddit_username}</div>
            {subreddit && (
              <div className="text-xs text-muted-foreground truncate">r/{subreddit}</div>
            )}
          </div>
          {dm.touch_number > 0 && stage !== 'ready' && (
            <Badge
              variant="secondary"
              className={`text-[10px] px-1.5 py-0 shrink-0 ${
                dm.touch_number >= 3
                  ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                  : dm.touch_number >= 2
                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
              }`}
            >
              {dm.touch_number === 1 ? '1st' : dm.touch_number === 2 ? '2nd' : dm.touch_number === 3 ? '3rd' : `${dm.touch_number}th`} DM
            </Badge>
          )}
          {stage === 'ready' && onDismiss && (
            <button
              type="button"
              className="h-5 w-5 flex items-center justify-center text-muted-foreground hover:text-destructive shrink-0 cursor-pointer"
              onClick={() => onDismiss(dm.id)}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Thread link */}
        {dm.signal && (
          <a
            href={`https://reddit.com${dm.signal.permalink}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1 mb-2 hover:bg-muted transition-colors overflow-hidden"
          >
            <ExternalLink className="h-3 w-3 shrink-0" />
            <span className="truncate">{threadTitle}</span>
          </a>
        )}

        {/* Comment quote (only in ready stage — not relevant in follow-up/sent/converted) */}
        {dm.comment_text && stage === 'ready' && (
          <p className="text-sm text-muted-foreground italic mb-2 line-clamp-3 break-all overflow-hidden">
            &ldquo;{dm.comment_text}&rdquo;
          </p>
        )}

        {/* Permission badge + time (ready) */}
        {stage === 'ready' && (
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${permission.className}`}>
              {permission.label}
            </Badge>
            <span className="text-[10px] text-muted-foreground ml-auto">
              <Clock className="inline h-2.5 w-2.5 mr-0.5" />
              {timeAgo(dm.created_at)}
            </span>
          </div>
        )}

        {/* Follow-up: show their last message (theirText → last_reply_text → dm_body fallback) */}
        {stage === 'followup' && (() => {
          // Priority: theirText from live preview (never lost) → DB last_reply_text → DB dm_body
          const theirMsg = chatPreview?.theirText || dm.last_reply_text;
          const fallbackMsg = chatPreview?.text || dm.dm_body;
          const displayText = theirMsg || fallbackMsg;
          if (!displayText) return null;
          const isFromThem = !!theirMsg;
          const label = isFromThem ? `${dm.reddit_username}:` : 'You:';
          return (
            <div className={`rounded px-2 py-1.5 mb-2 overflow-hidden ${isFromThem ? 'bg-blue-50 dark:bg-blue-950/30' : 'bg-muted/50'}`}>
              <p className="text-[10px] font-medium text-muted-foreground mb-0.5">{label}</p>
              <p className="text-xs line-clamp-3 break-all">{displayText}</p>
            </div>
          );
        })()}

        {/* Follow-up status */}
        {stage === 'followup' && fuStatus && (
          <div
            className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded mb-2 ${
              fuStatus.overdue
                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
            }`}
          >
            <AlertCircle className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{fuStatus.label}</span>
          </div>
        )}

        {/* Sent DM info */}
        {stage === 'sent' && (
          <div className="mb-2">
            {chatPreview ? (
              <div className={`rounded px-2 py-1 overflow-hidden ${chatPreview.fromYou ? 'bg-muted/50' : 'bg-blue-50 dark:bg-blue-950/30'}`}>
                <p className="text-[10px] font-medium text-muted-foreground">
                  {chatPreview.fromYou ? 'You:' : `${dm.reddit_username}:`}
                </p>
                <p className="text-xs line-clamp-2 break-all">{chatPreview.text}</p>
              </div>
            ) : (dm.dm_body || dm.dm_subject) ? (
              <div className="bg-muted/50 rounded px-2 py-1 overflow-hidden">
                {dm.dm_subject && (
                  <p className="text-xs font-medium truncate">{dm.dm_subject}</p>
                )}
                {dm.dm_body && (
                  <p className="text-xs text-muted-foreground line-clamp-2 break-all">{dm.dm_body}</p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
                <MessageSquare className="h-2.5 w-2.5 shrink-0" />
                <span>Awaiting reply</span>
              </div>
            )}
            {dm.dm_sent_at && (
              <span className="text-[10px] text-muted-foreground mt-1 block">
                Sent {timeAgo(dm.dm_sent_at)}
              </span>
            )}
          </div>
        )}

        {/* Converted info */}
        {stage === 'converted' && (
          <div className="mb-2">
            {dm.outcome && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 mb-1 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                {dm.outcome}
              </Badge>
            )}
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              {dm.touch_number > 0 && <span>{dm.touch_number} touch{dm.touch_number !== 1 ? 'es' : ''}</span>}
              {dm.dm_sent_at && <span className="truncate">DM to conversion: {timeAgo(dm.dm_sent_at)}</span>}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1.5 border-t border-border/50">
          {stage === 'ready' && (
            <button
              type="button"
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline cursor-pointer"
              onClick={() => onDraft?.(dm)}
            >
              Draft DM <ArrowRight className="h-3 w-3" />
            </button>
          )}

          {stage === 'sent' && (
            <>
              <button
                type="button"
                className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
                onClick={() => onStageChange(dm.id, 'dm_ready')}
              >
                <Undo2 className="h-3 w-3" /> Not sent
              </button>
              <button
                type="button"
                className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-destructive hover:underline cursor-pointer"
                onClick={() => onStageChange(dm.id, 'closed', 'no_response')}
              >
                <X className="h-3 w-3" /> Close
              </button>
            </>
          )}

          {stage === 'followup' && (
            <>
              <button
                type="button"
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline cursor-pointer"
                onClick={() => onDraft?.(dm)}
              >
                Follow-up <ArrowRight className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
