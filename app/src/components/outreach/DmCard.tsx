'use client';

import { useState } from 'react';
import { MessageSquare, Clock, Mail, ExternalLink, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cardHover, cardTap } from '@/lib/motion';
import { DmPipelineBadge } from '@/components/outreach/DmPipelineBadge';
import { DmDraftBuilder } from '@/components/outreach/DmDraftBuilder';
import type { OutreachDM, PermissionType } from '@/types';

interface DmCardProps {
  dm: OutreachDM;
  projectId: string;
  onStageChange: (dmId: string, stage: string, outcome?: string) => void;
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

function timeAgo(dateStr: string | null) {
  if (!dateStr) return '';
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function isFollowUpDue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr).getTime() <= Date.now();
}

export function DmCard({ dm, projectId, onStageChange }: DmCardProps) {
  const [expanded, setExpanded] = useState(false);
  const permission = permissionConfig[dm.permission_type] || permissionConfig.passive_commenter;
  const subreddit = dm.signal?.subreddit || '';
  const threadTitle = dm.signal?.title || 'Thread';
  const followUpOverdue = isFollowUpDue(dm.follow_up_due);

  return (
    <motion.div whileHover={cardHover} whileTap={cardTap} className="h-full">
      <Card className="transition-shadow hover:shadow-md h-full flex flex-col">
        <CardContent className="p-4 flex flex-col flex-1 space-y-2.5">
          {/* Top row: pipeline badge + permission type + subreddit */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <DmPipelineBadge stage={dm.pipeline_stage} />
            <Badge
              variant="secondary"
              className={`text-[10px] px-1.5 py-0 ${permission.className}`}
            >
              {permission.label}
            </Badge>
            {subreddit && (
              <span className="text-[11px] text-muted-foreground">r/{subreddit}</span>
            )}
            {followUpOverdue && (
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300 ml-auto"
              >
                <AlertCircle className="mr-0.5 h-2.5 w-2.5" />
                Follow-up due
              </Badge>
            )}
          </div>

          {/* Username + thread context */}
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <span className="font-medium text-sm">u/{dm.reddit_username}</span>
              {dm.touch_number > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  ({dm.touch_number} touch{dm.touch_number !== 1 ? 'es' : ''})
                </span>
              )}
            </div>
            {dm.signal && (
              <a
                href={`https://reddit.com${dm.signal.permalink}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:underline line-clamp-1"
              >
                {threadTitle}
              </a>
            )}
          </div>

          {/* Comment preview */}
          {dm.comment_text && (
            <p className="text-xs text-muted-foreground line-clamp-2 italic">
              &ldquo;{dm.comment_text}&rdquo;
            </p>
          )}

          {/* Matched pattern indicator */}
          {dm.matched_pattern && (
            <span className="inline-flex rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium w-fit">
              matched: &ldquo;{dm.matched_pattern}&rdquo;
            </span>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Meta row */}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
            {dm.dm_sent_at && (
              <span className="flex items-center gap-0.5">
                <Mail className="h-3 w-3" />
                Sent {timeAgo(dm.dm_sent_at)}
              </span>
            )}
            <span className="flex items-center gap-0.5">
              <Clock className="h-3 w-3" />
              {timeAgo(dm.created_at)}
            </span>
            <span className="ml-auto font-mono text-[10px]">
              {dm.permission_score.toFixed(2)}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 pt-0.5 flex-wrap">
            {/* Generate/Expand DM Builder */}
            {dm.pipeline_stage !== 'dm_sent' && dm.pipeline_stage !== 'responded' && dm.pipeline_stage !== 'converted' && dm.pipeline_stage !== 'closed' && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[11px] px-2"
                onClick={() => setExpanded(!expanded)}
              >
                <MessageSquare className="mr-1 h-3 w-3" />
                {expanded ? 'Hide' : 'DM'}
                {expanded ? <ChevronUp className="ml-0.5 h-3 w-3" /> : <ChevronDown className="ml-0.5 h-3 w-3" />}
              </Button>
            )}

            {/* Quick actions based on pipeline stage */}
            {dm.pipeline_stage === 'dm_sent' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[11px] px-2 text-green-600"
                  onClick={() => onStageChange(dm.id, 'responded', 'replied')}
                >
                  Got a reply
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] px-2"
                  onClick={() => onStageChange(dm.id, 'closed', 'no_response')}
                >
                  No response
                </Button>
              </>
            )}

            {dm.pipeline_stage === 'responded' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[11px] px-2 text-amber-600"
                  onClick={() => onStageChange(dm.id, 'converted')}
                >
                  Converted
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] px-2"
                  onClick={() => onStageChange(dm.id, 'closed', 'moved_off_reddit')}
                >
                  Moved off-Reddit
                </Button>
              </>
            )}

            <a
              href={`https://www.reddit.com/user/${dm.reddit_username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto"
            >
              <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2">
                <ExternalLink className="h-3 w-3" />
              </Button>
            </a>
          </div>

          {/* Inline DM Draft Builder */}
          {expanded && (
            <DmDraftBuilder
              dmId={dm.id}
              projectId={projectId}
              username={dm.reddit_username}
              onSent={() => onStageChange(dm.id, 'dm_sent')}
            />
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
