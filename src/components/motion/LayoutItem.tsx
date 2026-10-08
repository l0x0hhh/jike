'use client';

/**
 * LayoutItem —— 布局重排项（唯一的 motion 布局用法）
 *
 * 只在「可见菜品数 ≤ LAYOUT_ANIMATION_LIMIT」时由 StaggerItem 通过 next/dynamic(ssr:false)
 * 按需懒加载，**不进入首屏**：因此 motion 运行时不落在首屏关键路径。
 *
 * 负责：筛选/排序后卡片位置的平滑重排（layout）+ hover 上浮。
 * 用 useReducedMotion 在减弱动效时关闭 layout 与 hover 位移。
 */

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

export type LayoutTag = 'div' | 'article' | 'li' | 'section';

interface LayoutItemProps {
  children: ReactNode;
  className?: string;
  as?: LayoutTag;
  /** hover 上浮像素（负值向上） */
  hoverY?: number;
}

export function LayoutItem({ children, className, as = 'div', hoverY }: LayoutItemProps) {
  const reduce = useReducedMotion();
  const whileHover = !reduce && typeof hoverY === 'number' ? { y: hoverY } : undefined;

  switch (as) {
    case 'article':
      return (
        <motion.article layout={!reduce} initial={false} whileHover={whileHover} className={className}>
          {children}
        </motion.article>
      );
    case 'li':
      return (
        <motion.li layout={!reduce} initial={false} whileHover={whileHover} className={className}>
          {children}
        </motion.li>
      );
    case 'section':
      return (
        <motion.section layout={!reduce} initial={false} whileHover={whileHover} className={className}>
          {children}
        </motion.section>
      );
    default:
      return (
        <motion.div layout={!reduce} initial={false} whileHover={whileHover} className={className}>
          {children}
        </motion.div>
      );
  }
}
