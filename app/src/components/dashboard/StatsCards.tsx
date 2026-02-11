'use client';

import { FileText, Send, Radio, Search } from 'lucide-react';
import { motion } from 'motion/react';
import { staggerContainerVariants, staggerItemVariants } from '@/lib/motion';

interface StatsCardsProps {
  postsDrafted: number;
  postsPublished: number;
  subreddits: number;
  postsResearched: number;
}

const stats = [
  { key: 'postsDrafted', label: 'POSTS DRAFTED', icon: FileText, color: 'bg-purple-500/10 text-purple-500' },
  { key: 'postsPublished', label: 'POSTS PUBLISHED', icon: Send, color: 'bg-green-500/10 text-green-500' },
  { key: 'subreddits', label: 'SUBREDDITS', icon: Radio, color: 'bg-blue-500/10 text-blue-500' },
  { key: 'postsResearched', label: 'POSTS RESEARCHED', icon: Search, color: 'bg-orange-500/10 text-orange-500' },
] as const;

export function StatsCards({ postsDrafted, postsPublished, subreddits, postsResearched }: StatsCardsProps) {
  const values: Record<string, number> = { postsDrafted, postsPublished, subreddits, postsResearched };

  return (
    <motion.div
      variants={staggerContainerVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-2 gap-3 lg:grid-cols-4"
    >
      {stats.map((stat) => (
        <motion.div
          key={stat.key}
          variants={staggerItemVariants}
          className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3"
        >
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${stat.color}`}>
            <stat.icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold">{values[stat.key]}</p>
            <p className="text-[11px] font-medium tracking-wider text-muted-foreground">{stat.label}</p>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
