'use client';

/**
 * MotionProvider —— 动效浮层的运行时边界（不再挂在根布局）
 *
 * 设计变更（本轮）：
 *  · 原来在根布局用 LazyMotion 包全站 → 这会把 motion 运行时**拉进首屏**。
 *  · MotionSheet 外壳、布局重排项与弹窗内评分均按需懒加载，不进入首屏。
 *  · 本组件只为 MotionSheet 提供「尊重系统减弱动效」的 MotionConfig；
 *    LayoutItem / NumericScale 各自使用 useReducedMotion。
 *  · 入场等非浮层动效一律走纯 CSS（见 FadeIn / Stagger / globals.css），不依赖 motion。
 *
 * 因此 motion 运行时不进首屏；这里是它进入客户端后唯一的配置入口。
 */

import { MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';
import { duration, ease } from '@/lib/motion';

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: duration.base, ease: ease.out }}>
      {children}
    </MotionConfig>
  );
}
