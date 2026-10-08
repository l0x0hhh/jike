/**
 * 动效令牌（Motion Tokens）—— JS 侧运行时入口
 *
 * 分层：
 *   motion-tokens.ts（纯数值，唯一真源）
 *        ├──▶ 本文件        re-export + variants（供 motion/react 编排复用）
 *        └──▶ tailwind.config.ts  生成 CSS 令牌
 *
 * 组件里**不允许**出现裸写的时长 / 缓动数字，一律从 @/lib/motion 引用。
 * 改数值只动 motion-tokens.ts 一处，JS 与 CSS 同步生效。
 */

import type { Transition, Variants } from 'motion/react';
import { distance, duration, ease, spring, stagger, MAX_STAGGER_ITEMS } from './motion-tokens';

// 纯数值令牌全部 re-export，业务/原语层仍从 @/lib/motion 引用即可
export {
  duration,
  ease,
  spring,
  distance,
  stagger,
  MAX_STAGGER_ITEMS,
  LAYOUT_ANIMATION_LIMIT,
  bezierToCss,
  secondsToMs,
} from './motion-tokens';
export type { Bezier, SpringConfig } from './motion-tokens';

/** 常用过渡片段 */
export const transition = {
  enter: { duration: duration.base, ease: ease.out } as Transition,
  exit: { duration: duration.fast, ease: ease.in } as Transition,
};

/** 具名 variants：供 AnimatePresence / variants 编排复用（仅 JS 编排的浮层使用） */
export const variants: Record<
  'fadeIn' | 'fadeInUp' | 'scaleIn' | 'backdrop' | 'slideInRight' | 'slideUp' | 'pop' | 'dialogPop',
  Variants
> = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: duration.base, ease: ease.out } },
    exit: { opacity: 0, transition: { duration: duration.fast, ease: ease.in } },
  },
  fadeInUp: {
    initial: { opacity: 0, y: distance.md },
    animate: { opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.out } },
    exit: { opacity: 0, y: distance.sm, transition: { duration: duration.fast, ease: ease.in } },
  },
  scaleIn: {
    initial: { opacity: 0, scale: 0.96 },
    animate: { opacity: 1, scale: 1, transition: { duration: duration.base, ease: ease.emphasized } },
    exit: { opacity: 0, scale: 0.98, transition: { duration: duration.fast, ease: ease.in } },
  },
  backdrop: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: duration.base, ease: ease.out } },
    exit: { opacity: 0, transition: { duration: duration.fast, ease: ease.in } },
  },
  slideInRight: {
    initial: { x: '100%' },
    animate: { x: 0, transition: spring.gentle },
    exit: { x: '100%', transition: { duration: duration.slow, ease: ease.in } },
  },
  slideUp: {
    initial: { y: '100%' },
    animate: { y: 0, transition: spring.snappy },
    exit: { y: '100%', transition: { duration: duration.base, ease: ease.in } },
  },
  pop: {
    initial: { scale: 1 },
    animate: { scale: [1, 1.25, 1], transition: { duration: duration.fast, ease: ease.out } },
    exit: { scale: 1 },
  },
  dialogPop: {
    initial: { opacity: 0, scale: 0.94, y: distance.md },
    animate: { opacity: 1, scale: 1, y: 0, transition: spring.snappy },
    exit: { opacity: 0, scale: 0.96, y: distance.sm, transition: { duration: duration.base, ease: ease.in } },
  },
};

/** 计算第 index 个条目的错峰延迟（秒），超过上限后统一为上限值 */
export function staggerDelay(index: number, step: number = stagger.tight): number {
  if (!Number.isFinite(index) || index <= 0) return 0;
  return Math.min(index, MAX_STAGGER_ITEMS - 1) * step;
}

/** 是否已超出错峰预算（超出者不动画，直接以最终态渲染） */
export function isBeyondStagger(index: number): boolean {
  return index >= MAX_STAGGER_ITEMS;
}
