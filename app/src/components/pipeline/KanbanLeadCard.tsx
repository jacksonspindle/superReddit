'use client';

import { X, ExternalLink, ArrowRight, Check, Clock, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cardHover, cardTap } from '@/lib/motion';
import { timeAgo, followUpStatus } from '@/lib/time';
import type { OutreachDM, PermissionType } from '@/types';

type KanbanStage = 'ready' | 'sent' | 'followup' | 'converted';

interface KanbanLeadCardProps {
  dm: OutreachDM;
  stage: KanbanStage;
  selected?: boolean;
  onSelect?: (id: string) => void;
  onDraft?: (dm: OutreachDM) => void;
  onStageChange: (dmId: string, stage: string, outcome?: string) => void;
  onDismiss?: (dmId: string) => void;
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
  selected,
  onSelect,
  onDraft,
  onStageChange,
  onDismiss,
}: KanbanLeadCardProps) {
  const permission = permissionConfig[dm.permission_type] || permissionConfig.passive_commenter;
  const subreddit = dm.signal?.subreddit || '';
  const threadTitle = dm.signal?.title || 'Thread';
  const fuStatus = followUpStatus(dm.follow_up_due);

  return (
    <motion.div whileHover={cardHover} whileTap={cardTap}>
      <Card className="p-3 space-y-2 transition-shadow hover:shadow-md bg-card/80 border border-border overflow-hidden">
        {/* Top row: avatar + username + subreddit */}
        <div className="flex items-center gap-2">
          {stage === 'ready' && onSelect && (
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onSelect(dm.id)}
              className="h-3.5 w-3.5 rounded border-border cursor-pointer shrink-0"
            />
          )}
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-[10px] font-semibold">
              {getInitials(dm.reddit_username)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-sm truncate">u/{dm.reddit_username}</span>
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
                  Touch {dm.touch_number}
                </Badge>
              )}
            </div>
            {subreddit && (
              <span className="text-[11px] text-muted-foreground">r/{subreddit}</span>
            )}
          </div>
          {stage === 'ready' && onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive shrink-0"
              onClick={() => onDismiss(dm.id)}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Source thread */}
        {dm.signal && (
          <a
            href={`https://reddit.com${dm.signal.permalink}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 rounded px-2 py-1 hover:bg-muted transition-colors"
          >
            <ExternalLink className="h-2.5 w-2.5 shrink-0" />
            <span className="line-clamp-1">{threadTitle}</span>
          </a>
        )}

        {/* Comment quote */}
        {dm.comment_text && (
          <p className="text-xs text-muted-foreground line-clamp-2 italic">
            &ldquo;{dm.comment_text}&rdquo;
          </p>
        )}

        {/* Permission badge (ready) */}
        {stage === 'ready' && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${permission.className}`}>
              {permission.label}
            </Badge>
            <span className="text-[10px] text-muted-foreground ml-auto">
              <Clock className="inline h-2.5 w-2.5 mr-0.5" />
              {timeAgo(dm.created_at)}
            </span>
          </div>
        )}

        {/* Follow-up status (followup) */}
        {stage === 'followup' && fuStatus && (
          <div
            className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded ${
              fuStatus.overdue
                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
            }`}
          >
            <AlertCircle className="h-2.5 w-2.5" />
            {fuStatus.label}
          </div>
        )}

        {/* Sent time (sent) */}
        {stage === 'sent' && dm.dm_sent_at && (
          <span className="text-[10px] text-muted-foreground">
            Sent {timeAgo(dm.dm_sent_at)}
          </span>
        )}

        {/* Converted info */}
        {stage === 'converted' && (
          <div className="space-y-1">
            {dm.outcome && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                {dm.outcome}
              </Badge>
            )}
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              {dm.touch_number > 0 && <span>{dm.touch_number} touch{dm.touch_number !== 1 ? 'es' : ''}</span>}
              {dm.dm_sent_at && (
                <span>
                  DM to conversion: {timeAgo(dm.dm_sent_at)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 pt-0.5 min-w-0">
          {stage === 'ready' && (
            <Button
              variant="default"
              size="sm"
              className="h-7 text-[11px] px-2.5 w-full"
              onClick={() => onDraft?.(dm)}
            >
              Draft DM
              <ArrowRight className="ml-1 h-3 w-3 shrink-0" />
            </Button>
          )}

          {stage === 'sent' && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px] px-2 flex-1 text-green-600"
                onClick={() => onStageChange(dm.id, 'responded', 'replied')}
              >
                <Check className="mr-0.5 h-3 w-3" />
                Got Reply
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px] px-2"
                onClick={() => onStageChange(dm.id, 'closed', 'no_response')}
              >
                No Response
              </Button>
            </>
          )}

          {stage === 'followup' && (
            <>
              <Button
                variant="default"
                size="sm"
                className="h-7 text-[11px] px-2 flex-1"
                onClick={() => onDraft?.(dm)}
              >
                Send Follow-up
                <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px] px-2 text-green-600"
                onClick={() => onStageChange(dm.id, 'converted')}
              >
                <Check className="mr-0.5 h-3 w-3" />
                Converted
              </Button>
            </>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
