'use client';

/**
 * 最新评价流：抽屉内容（纯 CSS 入场，无 motion 依赖）
 *
 * 方向 B 调整：
 *  · 去掉 emoji（用户明确点名的「AI 感」来源之一），空态改用排印表达
 *  · 评分数值提到左侧当小主角，与菜品卡的语言一致
 *  · 标签由圆角药丸改为直角粗边，统一形状语言
 *
 * 可用性约束：列表项仍按序号错峰（上限 MAX_STAGGER_ITEMS=12，超出者直接终态），
 * 乐观提交插入的新评价出现在首位。
 */

import type { CSSProperties } from 'react';
import { allDishes, merchants, type Review } from '@/lib/data';
import { isBeyondStagger, stagger as staggerTokens } from '@/lib/motion';

type CssVars = CSSProperties & Record<`--${string}`, string>;

export function ReviewFeed({ reviews }: { reviews: Review[] }) {
  if (reviews.length === 0) {
    return (
      <div className="border-2 border-dashed border-ink-300 px-6 py-16 text-center">
        <p className="font-display text-[28px] leading-tight text-ink-900">还没有评价</p>
        <p className="mt-2 text-sm font-semibold text-ink-500">
          挑一道你吃过的菜，写下第一条
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {reviews.map((review, i) => {
        const dish = allDishes.find((d) => d.id === review.dish_id);
        const merchant = dish ? merchants.find((x) => x.id === dish.merchant_id) : null;
        const beyond = isBeyondStagger(i);
        const style: CssVars = beyond
          ? {}
          : { '--chy-enter-delay': `${i * staggerTokens.tight * 1000}ms` };

        return (
          <li
            key={review.id}
            className={`card flex gap-3.5 p-3.5 ${beyond ? '' : 'animate-enter'}`}
            style={style}
          >
            <div className="flex shrink-0 flex-col items-center">
              <span className="font-display tnum text-[26px] leading-[0.9] text-accent-600">
                {review.rating}
              </span>
              <span className="mt-1 border-t-2 border-ink-900 pt-0.5 text-[9px] font-bold tracking-[0.12em] text-ink-500">
                满分 5
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-bold text-ink-900">{review.nickname}</span>
                <span className="tnum shrink-0 text-[11px] font-semibold text-ink-400">
                  {new Date(review.created_at).toLocaleDateString('zh-CN', {
                    month: 'numeric',
                    day: 'numeric',
                  })}
                </span>
              </div>
              <p className="mt-0.5 truncate text-[11px] font-semibold tracking-[0.04em] text-ink-500">
                {merchant?.name} · {dish?.name}
              </p>

              {review.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {review.tags.map((tag) => (
                    <span
                      key={tag}
                      className="border border-ink-900 px-1.5 py-0.5 text-[10px] font-bold text-ink-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {review.content && (
                <p className="mt-2 text-[13px] leading-relaxed text-ink-700">{review.content}</p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
