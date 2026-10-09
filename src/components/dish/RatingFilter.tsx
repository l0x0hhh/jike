'use client';

/**
 * 评分门槛筛选
 *
 * 用 radiogroup 语义承载「只看高分的菜」，让筛选状态可被读屏识别。
 * 方向 B 调整：数值由 ★ 字形改为文字数字（去掉星星符号，与全站评分语言一致）。
 */

import type { MinRating } from '@/types/dish-panel';
import type { KeyboardEvent } from 'react';

const OPTIONS: { value: MinRating; label: string }[] = [
  { value: 0, label: '全部评分' },
  { value: 3, label: '3 分以上' },
  { value: 4, label: '4 分以上' },
];

interface RatingFilterProps {
  value: MinRating;
  onChange: (value: MinRating) => void;
}

export function RatingFilter({ value, onChange }: RatingFilterProps) {
  // 单选组只保留一个 Tab 入口，方向键循环选择，Home / End 跳到两端。
  const onRadioKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % OPTIONS.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index + OPTIONS.length - 1) % OPTIONS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = OPTIONS.length - 1;
    else return;
    event.preventDefault();
    onChange(OPTIONS[next].value);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label="评分筛选" className="mt-3 flex flex-wrap items-center gap-2">
      {/* 手机用「全部评分」区分商家筛选，保留完整的读屏标签。 */}
      <span className="sr-only text-[10px] font-bold uppercase tracking-[0.16em] text-ink-500 sm:not-sr-only">
        评分门槛
      </span>
      {OPTIONS.map((o, index) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          data-active={value === o.value}
          tabIndex={value === o.value ? 0 : -1}
          onClick={() => onChange(o.value)}
          onKeyDown={(event) => onRadioKey(event, index)}
          className="chip tnum min-h-11 flex-1 !px-2.5 !py-1 !text-[11px] sm:min-h-0 sm:flex-none"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
