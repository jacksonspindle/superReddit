'use client';

import { ArrowUpRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface CompetitorCardProps {
  name: string;
  totalMentions: number;
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
  switchingIntentCount: number;
  topSubreddits: string[];
  selected: boolean;
  onClick: () => void;
}

export function CompetitorCard({
  name,
  totalMentions,
  sentimentBreakdown,
  switchingIntentCount,
  topSubreddits,
  selected,
  onClick,
}: CompetitorCardProps) {
  const total = sentimentBreakdown.positive + sentimentBreakdown.neutral + sentimentBreakdown.negative;
  const positivePct = total > 0 ? Math.round((sentimentBreakdown.positive / total) * 100) : 0;
  const neutralPct = total > 0 ? Math.round((sentimentBreakdown.neutral / total) * 100) : 0;
  const negativePct = total > 0 ? Math.round((sentimentBreakdown.negative / total) * 100) : 0;

  const opportunityScore = total > 0
    ? Math.round(((sentimentBreakdown.negative + switchingIntentCount) / total) * 100)
    : 0;

  return (
    <Card
      className={`cursor-pointer transition-shadow hover:shadow-md ${selected ? 'ring-2 ring-primary' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm">{name}</p>
          <Badge variant="secondary" className="text-[10px]">
            {totalMentions} mentions
          </Badge>
        </div>

        {/* Sentiment bar */}
        <div className="space-y-1">
          <div className="flex h-2 rounded-full overflow-hidden bg-muted">
            {positivePct > 0 && (
              <div
                className="bg-green-500"
                style={{ width: `${positivePct}%` }}
              />
            )}
            {neutralPct > 0 && (
              <div
                className="bg-gray-400"
                style={{ width: `${neutralPct}%` }}
              />
            )}
            {negativePct > 0 && (
              <div
                className="bg-red-500"
                style={{ width: `${negativePct}%` }}
              />
            )}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span className="flex items-center gap-0.5">
              <TrendingUp className="h-2.5 w-2.5 text-green-500" />
              {positivePct}%
            </span>
            <span className="flex items-center gap-0.5">
              <Minus className="h-2.5 w-2.5 text-gray-400" />
              {neutralPct}%
            </span>
            <span className="flex items-center gap-0.5">
              <TrendingDown className="h-2.5 w-2.5 text-red-500" />
              {negativePct}%
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="text-center">
            <p className="text-lg font-bold">{switchingIntentCount}</p>
            <p className="text-[10px] text-muted-foreground">Switching Intent</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold flex items-center justify-center gap-0.5">
              {opportunityScore}%
              <ArrowUpRight className="h-3 w-3 text-orange-500" />
            </p>
            <p className="text-[10px] text-muted-foreground">Opportunity</p>
          </div>
        </div>

        {/* Top subreddits */}
        {topSubreddits.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {topSubreddits.slice(0, 3).map((sub) => (
              <span
                key={sub}
                className="inline-flex rounded-full bg-muted px-1.5 py-0.5 text-[10px]"
              >
                r/{sub}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
