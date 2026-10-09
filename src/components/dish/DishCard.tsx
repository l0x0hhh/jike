'use client';

/**
 * 菜品卡（方向 B）
 *
 * 结构变化：从「菜名 + 右上角价格」改成「大数字评分 + 菜名 + 价格」的左对齐三段式。
 * 变化理由：原来卡片的主角是菜名、价格缩在右上角；现在把**分数**放在最左、尺寸最大
 * ——对应 The Infatuation 的洞察「分数才是决策依据」。未评分的菜品用破折号占位，不虚构数字。
 *
 * 可用性约束（用户明确要求「不要让原本的功能难用」）：
 *  · 整卡可点（不只按钮），触控目标更大
 *  · hover 是整块反白，不是上浮位移 —— 371 张卡片下位移会让长列表版面「抖」
 *  · 原表已有评价保留，不因换设计而丢信息
 */

import { formatPrice, type Dish, type DishStat } from '@/lib/data';
import { stagger as staggerTokens } from '@/lib/motion';
import { ScoreReadout } from '../NumericScale';
import { StaggerItem } from '../motion/Stagger';

interface DishCardProps {
  dish: Dish;
  stat?: DishStat;
  /** 在整面墙中的全局序号（决定错峰），与商家分组无关 */
  index: number;
  /** 可见数量 ≤ 60 时启用布局重排动画 */
  layoutEnabled: boolean;
  // 查看与填写分开，卡片承担查看入口。
  onOpen: (dish: Dish) => void;
}

export function DishCard({ dish, stat, index, layoutEnabled, onOpen }: DishCardProps) {
  const count = stat?.review_count ?? 0;
  const avg = count > 0 ? stat?.avg_rating ?? null : null;

  return (
    <StaggerItem
      as="article"
      index={index}
      stagger={staggerTokens.tight}
      layout={layoutEnabled}
      className="card group flex flex-col transition-colors duration-base ease-out-soft
                 hover:border-accent-600 hover:bg-accent-600"
    >
      <button
        type="button"
        // 点击整卡查看该菜的历史评价。
        onClick={() => onOpen(dish)}
        aria-label={`查看「${dish.name}」的菜品评价`}
        className="flex flex-1 items-start gap-4 p-4 text-left focus-visible:outline-none
                   focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-600"
      >
        <ScoreReadout
          value={avg}
          count={count}
          className="[&_span]:transition-colors [&_span]:duration-base group-hover:[&_span]:text-white"
        />

        <div className="min-w-0 flex-1">
          <h3 className="text-[19px] font-bold leading-tight text-ink-900 transition-colors duration-base ease-out-soft group-hover:text-white">
            {dish.name}
          </h3>
          <div className="tnum mt-2 text-[15px] font-bold text-accent-600 transition-colors duration-base ease-out-soft group-hover:text-white">
            {formatPrice(dish)}
          </div>
          {count > 0 && (
            <div className="mt-1 text-[11px] font-semibold text-ink-500 transition-colors duration-base group-hover:text-white/80">
              {count} 条评价
            </div>
          )}
        </div>
      </button>

      {/* 原表已有评价：作为题注保留，不因换设计而丢信息 */}
      {dish.existingReview && (
        <p
          className="mx-4 mb-4 border-l-[3px] border-accent-600 pl-3 text-[12.5px] leading-relaxed text-ink-600
                     transition-colors duration-base group-hover:border-white/70 group-hover:text-white/85"
        >
          <span className="mr-1 font-bold tracking-[0.08em] text-ink-500 group-hover:text-white/70">
            原表
          </span>
          {dish.existingReview}
        </p>
      )}
    </StaggerItem>
  );
}
