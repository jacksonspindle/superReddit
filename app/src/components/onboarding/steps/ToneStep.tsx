'use client';

import { useState, useCallback } from 'react';
import { ArrowLeft, X, Heart, Pen } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform, type PanInfo } from 'motion/react';
import { Button } from '@/components/ui/button';

import { POST_STYLES } from '@/lib/data/writing-styles';

const SWIPE_THRESHOLD = 100;

interface ToneStepProps {
  likedStyles: Set<string>;
  onLikedStylesChange: (styles: Set<string>) => void;
  completed: boolean;
  onComplete: () => void;
  onReset: () => void;
  onBack: () => void;
  onNext: () => void;
}

function PostCard({
  style,
  onPass,
  onLike,
  active,
}: {
  style: (typeof POST_STYLES)[number];
  onPass: () => void;
  onLike: () => void;
  active: boolean;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-12, 12]);
  const passOpacity = useTransform(x, [-200, -50], [1, 0]);
  const likeOpacity = useTransform(x, [50, 200], [0, 1]);

  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      if (info.offset.x < -SWIPE_THRESHOLD) {
        onPass();
      } else if (info.offset.x > SWIPE_THRESHOLD) {
        onLike();
      }
    },
    [onPass, onLike]
  );

  if (!active) return null;

  return (
    <motion.div
      className="absolute inset-0 cursor-grab active:cursor-grabbing"
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.8}
      onDragEnd={handleDragEnd}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      {/* Swipe indicators */}
      <motion.div
        className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/90 text-white shadow-lg"
        style={{ opacity: passOpacity }}
      >
        <X className="h-6 w-6" />
      </motion.div>
      <motion.div
        className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/90 text-white shadow-lg"
        style={{ opacity: likeOpacity }}
      >
        <Heart className="h-6 w-6" />
      </motion.div>

      {/* Card */}
      <div className="h-full rounded-2xl border bg-card shadow-xl overflow-hidden flex flex-col">
        {/* Style header */}
        <div className="px-5 pt-5 pb-3 border-b">
          <div className="flex items-center gap-2">
            <Pen className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-semibold text-orange-500">{style.name}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{style.description}</p>
        </div>

        {/* Example post */}
        <div className="flex-1 p-5 overflow-y-auto">
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-6 w-6 rounded-full bg-orange-500/20 flex items-center justify-center">
                <span className="text-[10px] font-bold text-orange-500">OP</span>
              </div>
              <span className="text-xs text-muted-foreground">{style.exampleSubreddit}</span>
            </div>
            <h3 className="font-semibold text-sm leading-snug">{style.exampleTitle}</h3>
            <p className="text-sm text-muted-foreground mt-2.5 leading-relaxed">{style.exampleBody}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function ToneStep({ likedStyles, onLikedStylesChange, completed, onComplete, onReset, onBack, onNext }: ToneStepProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const isSwiping = !completed && currentIndex < POST_STYLES.length;
  const currentStyle = POST_STYLES[currentIndex];

  function handlePass() {
    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    if (nextIndex >= POST_STYLES.length) onComplete();
  }

  function handleLike() {
    const next = new Set(likedStyles);
    next.add(currentStyle.id);
    onLikedStylesChange(next);
    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    if (nextIndex >= POST_STYLES.length) onComplete();
  }

  function handleRedo() {
    setCurrentIndex(0);
    onReset();
  }

  // Get the names of liked styles for the summary
  const likedStyleNames = POST_STYLES.filter((s) => likedStyles.has(s.id));

  // Completed state — show summary with redo option
  if (completed) {
    return (
      <div className="w-full max-w-lg mx-auto flex flex-col" style={{ minHeight: '520px' }}>
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight">Your Writing DNA</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your preferred Reddit post styles
          </p>
        </div>

        <div className="flex-1 mt-6 mb-4 flex flex-col items-center justify-center text-center gap-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-500/10">
            <Heart className="h-7 w-7 text-orange-500" />
          </div>
          <div>
            <p className="text-lg font-semibold">
              {likedStyles.size === 0 ? 'No styles selected' : `${likedStyles.size} style${likedStyles.size === 1 ? '' : 's'} selected`}
            </p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
              {likedStyles.size === 0
                ? 'You passed on all styles. Your posts will use default formatting.'
                : 'These styles will shape how your AI-generated posts sound.'}
            </p>
          </div>

          {likedStyleNames.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 max-w-sm">
              {likedStyleNames.map((style) => (
                <span
                  key={style.id}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-orange-500/5 border-orange-500/20 px-3 py-1.5 text-xs font-medium text-orange-600"
                >
                  <Pen className="h-3 w-3" />
                  {style.name}
                </span>
              ))}
            </div>
          )}

          <button
            onClick={handleRedo}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
          >
            Redo choices
          </button>
        </div>

        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <Button onClick={onNext}>
            Continue
          </Button>
        </div>
      </div>
    );
  }

  // Swiping state — show cards
  return (
    <div className="w-full max-w-lg mx-auto flex flex-col" style={{ minHeight: '520px' }}>
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight">Your Writing DNA</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Like the Reddit post styles you want to write in
        </p>
      </div>

      {/* Card area */}
      <div className="relative flex-1 mt-6 mb-4" style={{ minHeight: '320px' }}>
        <AnimatePresence mode="wait">
          {isSwiping && currentStyle && (
            <PostCard
              key={currentStyle.id}
              style={currentStyle}
              onPass={handlePass}
              onLike={handleLike}
              active
            />
          )}
        </AnimatePresence>
      </div>

      {/* Pass/Like buttons */}
      {isSwiping && (
        <div className="flex items-center justify-center gap-8 mb-4">
          <button
            onClick={handlePass}
            className="flex flex-col items-center gap-1.5 group"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-muted-foreground/20 text-muted-foreground transition-colors group-hover:border-red-500/50 group-hover:text-red-500">
              <X className="h-5 w-5" />
            </div>
            <span className="text-xs text-muted-foreground group-hover:text-red-500 transition-colors">Pass</span>
          </button>
          <button
            onClick={handleLike}
            className="flex flex-col items-center gap-1.5 group"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500 text-white transition-transform group-hover:scale-105">
              <Heart className="h-5 w-5" />
            </div>
            <span className="text-xs text-orange-500 font-medium">Like</span>
          </button>
        </div>
      )}

      {/* Progress */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-muted-foreground">
          {currentIndex + 1} of {POST_STYLES.length}
        </span>
        {likedStyles.size > 0 && (
          <span className="text-xs text-muted-foreground">
            {likedStyles.size} liked
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mb-6">
        <motion.div
          className="h-full bg-orange-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${(currentIndex / POST_STYLES.length) * 100}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        {likedStyles.size > 0 && (
          <Button onClick={() => { onComplete(); onNext(); }}>
            Continue
          </Button>
        )}
      </div>
    </div>
  );
}
