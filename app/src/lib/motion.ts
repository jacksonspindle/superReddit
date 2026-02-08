import type { Variants } from 'motion/react';

const ease = [0.25, 0.1, 0.25, 1] as const;

export const pageVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease },
  },
};

export const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease },
  },
};

export const staggerContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
};

export const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease },
  },
};

export const scaleFadeVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.3, ease },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    transition: { duration: 0.15, ease },
  },
};

export const slideInRightVariants: Variants = {
  hidden: { x: 320, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.3, ease },
  },
  exit: {
    x: 320,
    opacity: 0,
    transition: { duration: 0.2, ease },
  },
};

export const cardHover = { scale: 1.015, transition: { duration: 0.15, ease } };
export const cardTap = { scale: 0.985, transition: { duration: 0.1, ease } };
export const buttonTap = { scale: 0.97, transition: { duration: 0.1, ease } };

export const slideHorizontalVariants: Variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.25, ease },
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -80 : 80,
    opacity: 0,
    transition: { duration: 0.15, ease },
  }),
};
