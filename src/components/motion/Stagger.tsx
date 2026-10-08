/**
 * 错峰入场原语（纯 CSS 驱动）
 *
 * · `StaggerGroup` + `StaggerItem`：给子项注入序号，用 CSS 变量 `--chy-enter-delay`
 *   控制错峰；元素默认态可见，隐藏态只在关键帧 from（见 FadeIn 说明）。
 * · `StaggerItem` 也支持「自驱动」模式（显式传入 index）：按整面墙的全局序号错峰
 *   （菜品墙跨商家分组也正确）。
 * · 内置上限截断：`index >= MAX_STAGGER_ITEMS` 的条目**不加动画类**，直接以最终态渲染，
 *   避免 371 张卡片全量动画造成的卡顿。
 * · 当 `layout` 为真时（可见数量 ≤ 60），改用**按需懒加载**的 LayoutItem 做平滑重排
 *   —— 这是唯一保留 motion 的路径，且不进首屏。
 */

'use client';

import dynamic from 'next/dynamic';
import { Children, Suspense, cloneElement, isValidElement, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { isBeyondStagger, stagger as staggerTokens } from '@/lib/motion';

// 懒加载、不 SSR 的布局重排项（motion 仅在此按需加载）
// 抽出同一个加载器：dynamic() 与空闲预热共用，才能命中 dynamic 真正使用的按需 chunk
const loadLayoutItem = () => import('./LayoutItem').then((m) => m.LayoutItem);
const LayoutItem = dynamic(loadLayoutItem, { ssr: false });

/**
 * 空闲预热：挂载一个不可见、零尺寸的 LayoutItem。
 * 原因：LayoutItem 首次渲染有一次性 ~300ms 成本（懒加载解析 + motion 运行时初始化），
 * 若发生在用户首次进入 ≤60 道菜商家的那一刻，首帧重排会因为还没挂载好而丢掉动画。
 * 在空闲期先渲染一次把它摊销掉，用户操作时挂载只需 ~30ms。
 * 自带的 Suspense 边界确保加载中也不会把外侧拖入 fallback。
 */
export function LayoutWarmup() {
  return (
    <Suspense fallback={null}>
      <div
        aria-hidden="true"
        style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}
      >
        <LayoutItem as="div">·</LayoutItem>
      </div>
    </Suspense>
  );
}

type CssVars = CSSProperties & Record<`--${string}`, string>;

export type StaggerTag = 'div' | 'article' | 'li' | 'section';

interface StaggerGroupProps {
  children: ReactNode;
  className?: string;
  /** 子项错峰步长（秒） */
  stagger?: number;
  /** 首个条目的起始延迟（秒） */
  delayChildren?: number;
  /** 承载元素标签，默认 div */
  as?: StaggerTag;
}

export function StaggerGroup({
  children,
  className,
  stagger = staggerTokens.base,
  delayChildren = 0,
  as = 'div',
}: StaggerGroupProps) {
  // 给直接子级里的 StaggerItem 注入序号，实现 CSS 错峰（不需要 JS 编排）
  const items = Children.map(children, (child, i) => {
    if (isValidElement(child) && child.type === StaggerItem) {
      const el = child as ReactElement<StaggerItemProps>;
      return cloneElement(el, {
        index: el.props.index ?? i,
        stagger,
        delayChildren,
      });
    }
    return child;
  });

  const Tag = as;
  return <Tag className={className}>{items}</Tag>;
}

export interface StaggerItemProps {
  children: ReactNode;
  className?: string;
  /** 自驱动模式：条目在整组里的序号；传入后按此序号错峰 */
  index?: number;
  /** 自驱动模式的错峰步长（秒） */
  stagger?: number;
  /** 首个条目的起始延迟（秒） */
  delayChildren?: number;
  as?: StaggerTag;
  /** hover 上浮（负值向上，px）；仅静态路径生效 */
  hoverY?: number;
  /** 是否参与布局重排（启用即切换到懒加载的 motion 项） */
  layout?: boolean;
}

export function StaggerItem({
  children,
  className = '',
  index,
  stagger = staggerTokens.tight,
  delayChildren = 0,
  as = 'div',
  hoverY,
  layout = false,
}: StaggerItemProps) {
  const selfDriven = typeof index === 'number';
  const beyond = selfDriven && isBeyondStagger(index as number);

  // 入场只播一次：记住挂载时的序号，仅当条目仍停在该位置时才带动画类。
  // 否则排序/筛选后，「新落入前 N 位」的卡片会因为 index 变化被重新挂上
  // animate-enter，从而再播一次淡入（实测 62 道菜的列表改排序会让 12 张卡重闪）。
  const [mountIndex] = useState<number | null>(() =>
    typeof index === 'number' ? index : null
  );
  const atInitialSlot = selfDriven && index === mountIndex;

  // 布局重排路径：交给懒加载的 motion 项（客户端、按需，不进首屏）
  if (layout) {
    return (
      <LayoutItem as={as} className={className} hoverY={hoverY}>
        {children}
      </LayoutItem>
    );
  }

  const animated = atInitialSlot && !beyond;
  const delayMs = animated ? (delayChildren + (index as number) * stagger) * 1000 : 0;

  const style: CssVars = animated ? { '--chy-enter-delay': `${delayMs}ms` } : {};

  const lift = typeof hoverY === 'number' ? 'transition duration-fast ease-out-soft hover:-translate-y-0.5' : '';
  const cls = [animated ? 'animate-enter' : '', lift, className].filter(Boolean).join(' ');

  const Tag = as;
  return (
    <Tag className={cls} style={style}>
      {children}
    </Tag>
  );
}

export { MAX_STAGGER_ITEMS } from '@/lib/motion';
