'use client';

import { Search, Scan, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type SortOption = 'newest' | 'oldest' | 'highest_intent';

interface PipelineToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  selectedCount: number;
  onSelectAll: () => void;
  onDismissSelected: () => void;
  onDmSelected: () => void;
  onMarkSentSelected: () => void;
  scanning: boolean;
  onScan: () => void;
}

export function PipelineToolbar({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  selectedCount,
  onSelectAll,
  onDismissSelected,
  onDmSelected,
  onMarkSentSelected,
  scanning,
  onScan,
}: PipelineToolbarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search leads..."
          className="h-8 w-52 pl-8 text-xs"
        />
      </div>

      {/* Sort */}
      <Select value={sortBy} onValueChange={(v) => onSortChange(v as SortOption)}>
        <SelectTrigger className="h-8 w-36 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">Newest</SelectItem>
          <SelectItem value="oldest">Oldest</SelectItem>
          <SelectItem value="highest_intent">Highest Intent</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex-1" />

      {/* Bulk actions */}
      <span className="text-[11px] text-muted-foreground">Bulk:</span>
      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onSelectAll}>
        Select All
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs"
        onClick={onDismissSelected}
        disabled={selectedCount === 0}
      >
        Dismiss Selected
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs"
        onClick={onMarkSentSelected}
        disabled={selectedCount === 0}
      >
        Mark Sent ({selectedCount})
      </Button>
      <Button
        size="sm"
        className="h-8 text-xs"
        onClick={onDmSelected}
        disabled={selectedCount === 0}
      >
        DM Selected ({selectedCount})
      </Button>

      {/* Scan */}
      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs"
        onClick={onScan}
        disabled={scanning}
      >
        {scanning ? (
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
        ) : (
          <Scan className="mr-1 h-3 w-3" />
        )}
        {scanning ? 'Scanning...' : 'Scan Threads'}
      </Button>
    </div>
  );
}
