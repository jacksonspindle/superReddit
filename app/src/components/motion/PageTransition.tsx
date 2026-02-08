'use client';

import { motion } from 'motion/react';
import { pageVariants } from '@/lib/motion';

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      className="h-full"
    >
      {children}
    </motion.div>
  );
}
