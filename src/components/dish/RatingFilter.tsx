'use client';

/**
 * 评分门槛筛选
 *
 * 用 radiogroup 语义承载「只看高分的菜」，让筛选状态可被读屏识别。
 * 方向 B 调整：数值由 ★ 字形改为文字数字（去掉星星符号，与全站评分语言一致）。
 */

import type { MinRating } from '@/types/dish-panel';

const OPTIONS: { value: MinRating; label: string }[] = [
  { value: 0, label: '全部' },
  { value: 3, label: '3 分以上' },
  { value: 4, label: '4 分以上' },
];

interface RatingFilterProps {
  value: MinRating;
  onChange: (value: MinRating) => void;
}

export function RatingFilter({ value, onChange }: RatingFilterProps) {
  return (
    <div role="radiogroup" aria-label="评分筛选" className="mt-3 flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-500">
        评分门槛
      </span>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          data-active={value === o.value}
          onClick={() => onChange(o.value)}
          className="chip !px-2.5 !py-1 !text-[11px] tnum"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
