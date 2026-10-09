'use client';

/**
 * 数字量表（替代星星）
 *
 * 方向 B 的核心改动：把「评分」从 ★☆ 字形换成**数字**。
 * 理由：餐厅评论里分数才是决策依据，星星是装饰性的模糊表达；
 * 而且 ★☆ 正是 AI 产出里最常见的视觉最大公约数之一。
 *
 * 无障碍契约保持不变：可交互态是 `role="radiogroup"` + 5 个 `role="radio"`，
 * 所以既有的键盘/读屏行为不回退（verify.mjs 会校验 radiogroup 语义）。
 */

import type { KeyboardEvent } from 'react';

interface NumericScaleProps {
  value: number;
  onChange?: (v: number) => void;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  optional?: boolean;
  max?: number;
}

/** 每个分值的口语注解——数字本身没有温度，注解补上 */
const MEANING: Record<number, string> = {
  1: '很差',
  2: '一般',
  3: '还行',
  4: '不错',
  5: '很好',
};

const BOX = {
  // 手机评分格保持 44px 触控尺寸；桌面可选评分仍保持紧凑。
  sm: 'h-11 w-11 text-xs sm:h-auto sm:w-8 sm:py-1',
  md: 'h-11 w-11 text-sm sm:h-auto sm:w-10 sm:py-1.5',
  lg: 'w-12 py-2.5 text-base',
} as const;

export function NumericScale({
  value,
  onChange,
  label,
  size = 'md',
  optional,
  max = 5,
}: NumericScaleProps) {
  const readonly = !onChange;
  const nums = Array.from({ length: max }, (_, i) => i + 1);
  // 与单选组语义一致：方向键选择并移动焦点，Tab 仅进入已选项或第一项。
  const onRadioKey = (event: KeyboardEvent<HTMLButtonElement>, n: number) => {
    let next: number;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (n % max) + 1;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = ((n + max - 2) % max) + 1;
    else if (event.key === 'Home') next = 1;
    else if (event.key === 'End') next = max;
    else return;
    event.preventDefault();
    onChange?.(next);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next - 1]?.focus();
  };

  // ---- 只读：不给字形，只给数值 ----
  if (readonly) {
    return (
      <span className="tnum inline-flex items-baseline gap-0.5" role="img" aria-label={`${label}：${value} 分（满分 ${max}）`}>
        <span className="text-base font-bold text-accent-600">{value.toFixed(0)}</span>
        <span className="text-[11px] font-semibold text-ink-400">/{max}</span>
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <div role="radiogroup" aria-label={label} className="flex">
        {nums.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} 分`}
            tabIndex={value === n || (value === 0 && n === 1) ? 0 : -1}
            className={`scale-btn tnum ${BOX[size]}`}
            onClick={() => onChange?.(n)}
            onKeyDown={(event) => onRadioKey(event, n)}
          >
            {n}
          </button>
        ))}
      </div>
      <span className="text-xs font-semibold text-ink-500">
        {value > 0 ? MEANING[value] : optional ? '未评' : `满分 ${max}`}
      </span>
    </div>
  );
}

/**
 * 只读大数字（卡片上的视觉主角）
 * 数字用 tabular-nums 对齐，未评时不显示「0」而显示破折号——
 * 0 分和「没评过」是两件事，不能用同一个符号表达。
 */
export function ScoreReadout({
  value,
  count,
  max = 5,
  className = '',
}: {
  value: number | null | undefined;
  count?: number;
  max?: number;
  className?: string;
}) {
  const rated = typeof value === 'number' && value > 0;

  return (
    <div className={`flex shrink-0 flex-col items-center ${className}`}>
      {rated ? (
        <span className="font-display tnum text-[40px] leading-[0.86] font-normal text-accent-600">
          {value.toFixed(1)}
        </span>
      ) : (
        /* 未评：用小号浅灰破折号而不是同尺寸大横杠 —— 40px 的「—」会被误读成加载条 */
        <span
          className="font-display text-[26px] leading-[1.32] font-normal text-ink-300"
          aria-hidden="true"
        >
          —
        </span>
      )}
      <span className="mt-1.5 border-t-2 border-ink-900 pt-0.5 text-[9px] font-bold tracking-[0.14em] text-ink-500">
        {rated ? `满分 ${max}` : '未评'}
      </span>
      <span className="sr-only">
        {rated ? `${value.toFixed(1)} 分（满分 ${max}）` : '尚未评分'}
        {count ? `，共 ${count} 条评价` : ''}
      </span>
    </div>
  );
}
