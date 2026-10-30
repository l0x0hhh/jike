import type { ReactNode } from 'react';

/**
 * 卡片只读大数字。
 * 与可交互 NumericScale 分文件，避免首屏卡片共享到弹窗的 Motion 运行时。
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
  let readout: ReactNode;

  if (rated) {
    readout = (
      <span className="font-display tnum text-[40px] leading-[0.86] font-normal text-accent-600">
        {value.toFixed(1)}
      </span>
    );
  } else {
    readout = (
      <span className="font-display text-[26px] leading-[1.32] font-normal text-ink-300" aria-hidden="true">
        —
      </span>
    );
  }

  return (
    <div className={`flex shrink-0 flex-col items-center ${className}`}>
      {readout}
      <span className="mt-1.5 whitespace-nowrap border-t-2 border-ink-900 pt-0.5 text-[9px] font-bold tracking-[0.14em] text-ink-500">
        {rated ? `满分 ${max}` : '等你评价'}
      </span>
      <span className="sr-only">
        {rated ? `${value.toFixed(1)} 分（满分 ${max}）` : '尚未评分'}
        {count ? `，共 ${count} 条评价` : ''}
      </span>
    </div>
  );
}
