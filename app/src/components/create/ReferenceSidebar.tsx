'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Search, Shuffle, Bookmark, PanelRightClose } from 'lucide-react';
import { useCreateStore } from '@/stores/create-store';
import { InspirationPanel } from '@/components/create/sidebar/InspirationPanel';
import { FeedPanel } from '@/components/create/sidebar/FeedPanel';
import { BookmarksPanel } from '@/components/create/sidebar/BookmarksPanel';

interface ReferenceSidebarProps {
  onCollapse?: () => void;
}

export function ReferenceSidebar({ onCollapse }: ReferenceSidebarProps) {
  const { activeTab, setActiveTab } = useCreateStore();

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-3 py-2 flex items-center gap-2">
        {onCollapse && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={onCollapse}
          >
            <PanelRightClose className="h-4 w-4" />
          </Button>
        )}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'search' | 'feed' | 'bookmarks')} className="flex-1">
          <TabsList className="h-8 w-full">
            <TabsTrigger value="search" className="text-xs gap-1.5 flex-1 h-6">
              <Search className="h-3.5 w-3.5" />
              Search
            </TabsTrigger>
            <TabsTrigger value="feed" className="text-xs gap-1.5 flex-1 h-6">
              <Shuffle className="h-3.5 w-3.5" />
              Feed
            </TabsTrigger>
            <TabsTrigger value="bookmarks" className="text-xs gap-1.5 flex-1 h-6">
              <Bookmark className="h-3.5 w-3.5" />
              Saved
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <div className={activeTab === 'search' ? 'h-full' : 'hidden'}>
          <InspirationPanel />
        </div>
        <div className={activeTab === 'feed' ? 'h-full' : 'hidden'}>
          <FeedPanel />
        </div>
        <div className={activeTab === 'bookmarks' ? 'h-full' : 'hidden'}>
          <BookmarksPanel />
        </div>
      </div>
    </div>
  );
}
