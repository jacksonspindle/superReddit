'use client';

import { Search, RefreshCw, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type SortOption = 'newest' | 'oldest' | 'highest_intent';

interface PipelineToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  scanning: boolean;
  onScan: () => void;
}

export function PipelineToolbar({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  scanning,
  onScan,
}: PipelineToolbarProps) {
  return (
    <div className="flex items-center gap-3">
      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search leads..."
          className="h-10 pl-9 text-sm"
        />
      </div>

      {/* Sort */}
      <Select value={sortBy} onValueChange={(v) => onSortChange(v as SortOption)}>
        <SelectTrigger className="h-10 w-40 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">Newest</SelectItem>
          <SelectItem value="oldest">Oldest</SelectItem>
          <SelectItem value="highest_intent">Highest Intent</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex-1" />

      {/* Refresh */}
      <Button
        size="lg"
        className="h-10 px-5 text-sm font-semibold"
        onClick={onScan}
        disabled={scanning}
      >
        {scanning ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="mr-2 h-4 w-4" />
        )}
        {scanning ? 'Refreshing...' : 'Refresh'}
      </Button>
    </div>
  );
}
