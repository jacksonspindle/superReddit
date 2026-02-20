'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { KanbanLeadCard } from './KanbanLeadCard';
import type { OutreachDM } from '@/types';

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
            <ScrollArea className="flex-1 min-h-0 p-4">
              {dms.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground text-sm">
                  No leads in this stage yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {dms.map((dm) => (
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
