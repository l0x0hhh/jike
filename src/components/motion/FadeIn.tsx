/**
 * 区块级入场（纯 CSS 驱动）
 *
 * 关键性质 —— 渐进增强：
 *  · 元素的**默认态就是可见的**（opacity:1 / transform:none），隐藏态只存在于
 *    CSS 动画的 `from` 关键帧，由 `animation-fill-mode: backwards` 在延迟期间临时应用。
 *  · 因此 **SSR 首帧 / 禁用 JS / 弱网** 下内容都可见（不再有 400–630ms 空白窗口）。
 *  · 不需要等待任何 JS chunk，首帧即开始播放。
 *  · `prefers-reduced-motion: reduce` 下由 globals.css 将 animation-delay/duration 归零 → 立即呈现终态。
 *
 * 说明：不再使用 whileInView / IntersectionObserver（那要求隐藏态作为初始态，违反渐进增强）。
 * 动画在挂载时即播放；下方区块在用户滚到之前早已播完，效果等价且更稳。
 */

import type { CSSProperties, ElementType, ReactNode } from 'react';
import { distance as dist } from '@/lib/motion';

/** 允许在 style 上写 CSS 自定义属性（--*） */
export type CssVars = CSSProperties & Record<`--${string}`, string>;

interface FadeInProps {
  children: ReactNode;
  className?: string;
  /** 额外延迟（秒），用于与相邻元素错峰 */
  delay?: number;
  /** 入场位移（px），默认 distance.md */
  distance?: number;
  /** 承载元素标签，默认 div */
  as?: ElementType;
}

export function FadeIn({ children, className = '', delay = 0, distance = dist.md, as: Tag = 'div' }: FadeInProps) {
  const style: CssVars = {
    '--chy-enter-y': `${distance}px`,
    '--chy-enter-delay': `${Math.max(0, delay) * 1000}ms`,
  };

  return (
    <Tag className={`animate-enter ${className}`.trim()} style={style}>
      {children}
    </Tag>
  );
}
