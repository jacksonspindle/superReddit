'use client';

import { useState, useCallback } from 'react';
import { ArrowLeft, X, Heart, Pen } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform, type PanInfo } from 'motion/react';
import { Button } from '@/components/ui/button';

// 12 Reddit post styles from research, each with a short example post
const POST_STYLES = [
  {
    id: 'struggle-discovery',
    name: 'The Struggle & Discovery',
    description: 'Personal story with a problem-solution arc',
    exampleTitle: 'I was mass-sending cold emails for 6 months and getting zero replies. Here\'s what finally worked.',
    exampleBody: 'I run a small consultancy and honestly, my outreach was embarrassing. I was blasting 200 cold emails a week with generic templates and getting maybe 1-2 replies a month. Last month I started personalizing the first line of every email automatically. My reply rate went from under 1% to 14% in three weeks. Happy to share my exact workflow if anyone\'s interested.',
    exampleSubreddit: 'r/Entrepreneur',
  },
  {
    id: 'curious-crowd',
    name: 'The Curious Crowd',
    description: 'Question that invites community discussion',
    exampleTitle: 'Does anyone else feel like project management tools have gotten way too bloated?',
    exampleBody: 'Genuine question — I manage a team of 8 and we\'ve cycled through Asana, Monday, and ClickUp over the past year. Every single one feels like it was designed for a 500-person enterprise, not a small team. Are we the only ones drowning in feature bloat, or is this just the state of PM tools now?',
    exampleSubreddit: 'r/startups',
  },
  {
    id: 'builders-showcase',
    name: 'The Builder\'s Showcase',
    description: '"I built this" maker post with feedback ask',
    exampleTitle: 'Spent the last 4 months building a tool that turns meeting recordings into action items automatically. Would love honest feedback.',
    exampleBody: 'I\'m a PM who was sick of leaving meetings with vague notes and no follow-through. It records your calls, transcribes them, and extracts actual action items with owners and deadlines. It\'s been running on my team of 12 for a month and has genuinely changed how we operate. I\'d love brutal feedback — here\'s a 2-minute demo.',
    exampleSubreddit: 'r/SideProject',
  },
  {
    id: 'psa-drop',
    name: 'The PSA Drop',
    description: 'Urgent insider tip or public service announcement',
    exampleTitle: 'PSA: If you\'re still paying for Zapier\'s premium tier, you\'re probably overspending by 60%',
    exampleBody: 'I just did an audit of our team\'s automation stack and realized we were paying $120/month when 90% of our workflows could run on a free tier alternative. Not affiliated at all — just frustrated with the pricing hike and started looking around. Check your usage before your next billing cycle.',
    exampleSubreddit: 'r/SaaS',
  },
  {
    id: 'showdown',
    name: 'The Showdown',
    description: 'Side-by-side comparison with a clear verdict',
    exampleTitle: 'I tested Notion, Coda, and DocuFlow for 30 days each. Here\'s my brutally honest ranking.',
    exampleBody: 'My 4-person startup was drowning in docs. Notion is powerful but overkill. Coda was flexible but the learning curve lost us a week. DocuFlow was the simplest — we migrated in 2 hours and the AI search actually works. Winner for small teams: DocuFlow. Winner for power users: Notion.',
    exampleSubreddit: 'r/software',
  },
  {
    id: 'open-floor',
    name: 'The Open Floor',
    description: 'Open-ended discussion starter, product in comments',
    exampleTitle: 'What\'s your team using for async communication that actually works? Slack isn\'t cutting it anymore.',
    exampleBody: 'We\'re 15 people, fully remote, and Slack has become a nightmare. Important messages get buried, threads go nowhere. What\'s actually working for your team? Especially from other remote teams in the 10-30 person range. Not looking for "just use email" — we tried that.',
    exampleSubreddit: 'r/remotework',
  },
  {
    id: 'playbook',
    name: 'The Playbook',
    description: 'Step-by-step tutorial with product woven in',
    exampleTitle: 'How I automated 80% of my social media posting in under an hour (step-by-step)',
    exampleBody: 'I run social for three clients and was spending 10+ hours a week scheduling. Here\'s my workflow: (1) Batch-create ideas with AI. (2) Auto-generate platform-specific variations. (3) Schedule everything in one sitting. (4) 15 min/day on engagement only. Total weekly time: 10 hours → 2.',
    exampleSubreddit: 'r/marketing',
  },
  {
    id: 'contrarian',
    name: 'The Contrarian',
    description: 'Hot take that challenges conventional wisdom',
    exampleTitle: 'Unpopular opinion: Most A/B testing is a complete waste of time for startups under $1M ARR',
    exampleBody: 'I know this sub loves A/B testing everything, but hear me out. I spent 200 hours on tests and never had enough traffic for statistical significance. What actually moved the needle? Talking to 10 customers and building what they asked for. I\'m not saying it\'s bad — I\'m saying it\'s premature optimization. Fight me.',
    exampleSubreddit: 'r/Entrepreneur',
  },
  {
    id: 'experiment-log',
    name: 'The Experiment Log',
    description: 'Data-driven "I tracked X for 30 days" format',
    exampleTitle: 'I replaced our $200/month email stack with a $29 tool and tracked everything for 60 days. Here are the real numbers.',
    exampleBody: 'Open rates went from 22.1% to 24.8%. Click rates stayed roughly the same (3.1% vs 3.3%). Revenue per email actually went up 11% but I think that\'s noise. Only downside: clunkier template builder. Net savings of $171/mo for basically the same performance. Full spreadsheet in comments.',
    exampleSubreddit: 'r/SaaS',
  },
  {
    id: 'casual-drop',
    name: 'The Casual Drop',
    description: 'Natural, offhand product mention within a broader topic',
    exampleTitle: 'Remote team managers: how are you handling the "always online" burnout problem?',
    exampleBody: 'The biggest issue isn\'t productivity — it\'s that everyone feels like they need to be online all the time. We\'ve tried no-meeting Fridays and async standups through BriefKit, which helped a bit, but the real problem is cultural. Has anyone found tactics that actually shift the always-on mentality?',
    exampleSubreddit: 'r/management',
  },
  {
    id: 'confessional-ama',
    name: 'The Confessional AMA',
    description: 'Transparent founder Q&A sharing real numbers',
    exampleTitle: 'I bootstrapped a SaaS to $18K MRR in 14 months while working full-time. AMA about the messy reality.',
    exampleBody: 'I launched 14 months ago, still have my day job, and just crossed $18K MRR with zero paid marketing. I\'ve made every mistake in the book — pricing too low, building features nobody wanted, almost burning out twice. I\'m going to be brutally honest. Revenue, costs, mistakes, everything. Ask me anything.',
    exampleSubreddit: 'r/startups',
  },
  {
    id: 'empathy-hook',
    name: 'The Empathy Hook',
    description: 'Emotional validation before a gentle solution',
    exampleTitle: 'If your side project is moving slowly, it\'s probably not because you\'re lazy. It\'s because your tools are fighting you.',
    exampleBody: 'I see so many posts from people beating themselves up for not shipping faster. But half the battle is wrestling with deployment pipelines and CI/CD setups designed for 50-person teams. Sometimes the bottleneck isn\'t your motivation — it\'s your stack. Give yourself some credit.',
    exampleSubreddit: 'r/webdev',
  },
];

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
