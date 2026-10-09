'use client';

/**
 * 商家筛选（方向 B）
 *
 * 由「圆角药丸 + 浅底」改为「2px 粗边直角方块，选中即实心蓝底」——
 * 与全站的形状语言一致，且不依赖圆角和淡色底来区分状态（对比度更硬）。
 *
 * 保持纯 CSS 静态高亮（不用 motion 的 layoutId）：MerchantTabs 是 SSR 渲染的导航，
 * 静态 import motion 会把 motion 运行时拉进首屏。
 */

import type { Merchant } from '@/lib/data';

interface MerchantTabsProps {
  merchants: Merchant[];
  totalDishes: number;
  active: number | 'all';
  counts: Map<number, number>;
  onChange: (id: number | 'all') => void;
}

interface TabProps {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}

function Tab({ label, count, active, onClick }: TabProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      data-active={active}
      onClick={onClick}
      // 手机商家按钮扩大触控高度，桌面保留紧凑尺寸。
      className="chip min-h-11 shrink-0 sm:min-h-0"
    >
      {label}
      {count ? <span className="tnum ml-1.5 opacity-60">{count}</span> : null}
    </button>
  );
}

export function MerchantTabs({ merchants, totalDishes, active, counts, onChange }: MerchantTabsProps) {
  return (
    <nav aria-label="商家筛选" className="mb-5">
      {/* 显式标签：评分门槛那排也是 chip，两排不加标签会长得一样、各有一个「全部」而分不清 */}
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-500">商家</span>
        <span className="tnum text-[10px] font-bold tracking-[0.08em] text-ink-400">
          {merchants.length} 家
        </span>
      </div>
      <div className="-mx-4 overflow-x-auto px-4 pb-1">
        <div className="flex w-max gap-2">
          <Tab label="全部" count={totalDishes} active={active === 'all'} onClick={() => onChange('all')} />
          {merchants.map((merchant) => (
            <Tab
              key={merchant.id}
              label={merchant.name}
              count={counts.get(merchant.id)}
              active={active === merchant.id}
              onClick={() => onChange(merchant.id)}
            />
          ))}
        </div>
      </div>
    </nav>
  );
}
