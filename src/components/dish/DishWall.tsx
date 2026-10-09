'use client';

/**
 * 菜品墙：按商家分组的响应网格。
 * · 入场：整墙前 12 张卡片按全局序号错峰（纯 CSS），其余直接显示（见 StaggerItem 上限截断）
 * · 切换商家 / 排序 / 搜索：可见数量 ≤ 60 时启用 layout 重排动画，否则瞬间切换（防 371 项布局抖动）
 *   —— layout 由按需懒加载的 LayoutItem 承担；减弱动效时它内部自动关闭 layout。
 * · 空态：专门的视觉与动效
 *
 * 注意：本组件**不 import motion**，以免把 motion 运行时带进首屏。
 */

import type { Dish, DishStat, Merchant } from '@/lib/data';
import { FadeIn } from '../motion/FadeIn';
import { DishCard } from './DishCard';

export interface DishGroup {
  merchant: Merchant | null;
  dishes: Dish[];
}

interface DishWallProps {
  visible: Dish[];
  grouped: DishGroup[] | null;
  stats: Map<number, DishStat>;
  query: string;
  // 卡片点击进入详情，详情内再提供写评价入口。
  onOpen: (dish: Dish) => void;
  onClearFilters: () => void;
}

/** 布局重排动画的可见数量上限：超过则瞬间切换，避免大量布局投影计算 */
export const LAYOUT_ANIMATION_LIMIT = 60;

export function DishWall({ visible, grouped, stats, query, onOpen, onClearFilters }: DishWallProps) {
  const layoutEnabled = visible.length <= LAYOUT_ANIMATION_LIMIT;

  if (visible.length === 0) {
    return (
      <FadeIn className="border-2 border-dashed border-ink-300 px-6 py-20 text-center">
        <p className="font-display text-[26px] leading-tight text-ink-900">
          没有找到「{query}」相关的菜
        </p>
        <p className="mt-2 text-[13px] font-medium text-ink-500">
          换个词试试，或清除筛选条件
        </p>
        <button type="button" onClick={onClearFilters} className="btn-ghost mt-5 text-[13px]">
          清除筛选
        </button>
      </FadeIn>
    );
  }

  // 全局序号表：错峰按整面墙的顺序，而非每个商家分组内重新计数
  const indexOf = new Map<number, number>();
  visible.forEach((dish, i) => indexOf.set(dish.id, i));

  const groups: DishGroup[] = grouped ?? [{ merchant: null, dishes: visible }];

  return (
    <>
      {groups.map((group) => (
        <section key={group.merchant?.id ?? 'flat'} className="mb-8">
          {group.merchant && (
            <h2 className="mb-3 flex items-baseline justify-between gap-3 border-b-2 border-ink-900 pb-2">
              <span className="font-display text-[20px] leading-none tracking-[-0.02em] text-ink-900">
                {group.merchant.name}
              </span>
              <span className="tnum text-[11px] font-bold tracking-[0.08em] text-ink-500">
                {group.dishes.length} 道
              </span>
            </h2>
          )}
          {/* 窄屏列宽不超过容器，宽屏仍以 300px 为基准自动换列。 */}
          <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr))]">
            {group.dishes.map((dish) => (
              <DishCard
                key={dish.id}
                dish={dish}
                stat={stats.get(dish.id)}
                index={indexOf.get(dish.id) ?? 0}
                layoutEnabled={layoutEnabled}
                onOpen={onOpen}
              />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
