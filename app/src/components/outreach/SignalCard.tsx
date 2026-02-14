'use client';

import { useState } from 'react';
import { ArrowUpRight, MessageSquare, Clock, ExternalLink, Reply, X } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cardHover, cardTap } from '@/lib/motion';
import { ComplianceBadge } from '@/components/outreach/ComplianceBadge';
import { ReplyBuilder } from '@/components/outreach/ReplyBuilder';
import { getSafetyLevel } from '@/lib/outreach/compliance';
import type { OutreachSignal } from '@/types';

interface SignalCardProps {
  signal: OutreachSignal;
  projectId: string;
  safetyScore: number | null;
  onStatusChange: (signalId: string, status: string) => void;
}

const intentColors: Record<string, string> = {
  question: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  comparison: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  problem: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  discussion: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
  showcase: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
};

const timeAgo = (timestamp: number) => {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(timestamp * 1000).toLocaleDateString();
};

const formatNumber = (n: number) => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
};

export function SignalCard({ signal, projectId, safetyScore, onStatusChange }: SignalCardProps) {
  const [showReply, setShowReply] = useState(false);

  return (
    <motion.div whileHover={cardHover} whileTap={cardTap} className="h-full">
      <Card className="transition-shadow hover:shadow-md h-full flex flex-col">
        <CardContent className="p-4 flex flex-col flex-1 space-y-2.5">
          {/* Top row: intent badge + subreddit + safety */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {signal.intent_type && (
              <Badge
                variant="secondary"
                className={`text-[10px] px-1.5 py-0 ${intentColors[signal.intent_type] || intentColors.discussion}`}
              >
                {signal.intent_type}
              </Badge>
            )}
            <span className="text-[11px] text-muted-foreground">r/{signal.subreddit}</span>
            <ComplianceBadge level={getSafetyLevel(safetyScore)} />
            {signal.competitor_mentioned && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300">
                competitor
              </Badge>
            )}
          </div>

          {/* Title */}
          <a
            href={`https://reddit.com${signal.permalink}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            <h3 className="font-medium text-sm leading-snug line-clamp-2">{signal.title}</h3>
          </a>

          {/* Body preview */}
          {signal.body && (
            <p className="text-xs text-muted-foreground line-clamp-3">
              {signal.body}
            </p>
          )}

          {/* Matched keywords */}
          {signal.matched_keywords.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {signal.matched_keywords.map((kw) => (
                <span
                  key={kw}
                  className="inline-flex rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium"
                >
                  {kw}
                </span>
              ))}
            </div>
          )}

          {/* Spacer to push meta + actions to bottom */}
          <div className="flex-1" />

          {/* Meta row */}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
            <span className="flex items-center gap-0.5">
              <ArrowUpRight className="h-3 w-3 text-orange-500" />
              {formatNumber(signal.score)}
            </span>
            <span className="flex items-center gap-0.5">
              <MessageSquare className="h-3 w-3" />
              {formatNumber(signal.num_comments)}
            </span>
            <span className="flex items-center gap-0.5">
              <Clock className="h-3 w-3" />
              {timeAgo(signal.created_utc)}
            </span>
            <span className="ml-auto font-mono text-[10px]">
              {signal.combined_score.toFixed(2)}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 pt-0.5">
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[11px] px-2"
              onClick={() => setShowReply(!showReply)}
            >
              <Reply className="mr-1 h-3 w-3" />
              {showReply ? 'Hide' : 'Reply'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[11px] px-2"
              onClick={() => onStatusChange(signal.id, 'dismissed')}
            >
              <X className="mr-1 h-3 w-3" />
              Dismiss
            </Button>
            <a
              href={`https://reddit.com${signal.permalink}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto"
            >
              <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2">
                <ExternalLink className="h-3 w-3" />
              </Button>
            </a>
          </div>

          {/* Inline reply builder */}
          {showReply && (
            <ReplyBuilder
              signalId={signal.id}
              projectId={projectId}
              permalink={signal.permalink}
              onCopied={() => onStatusChange(signal.id, 'replied')}
            />
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
