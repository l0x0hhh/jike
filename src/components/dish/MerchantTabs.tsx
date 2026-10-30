'use client';

/**
 * 商家筛选（方向 B）
 * 保持纯 CSS 高亮，不把 Motion 拉进首屏；选中项自动居中，两侧渐隐提示可继续横滑。
 */

import { useEffect, useRef, useState, type Ref } from 'react';
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
  buttonRef?: Ref<HTMLButtonElement>;
}

function Tab({ label, count, active, onClick, buttonRef }: TabProps) {
  return (
    <button
      ref={buttonRef}
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  // 选中商家始终进入可视区；只滚动导航容器，不带动页面上下跳动。
  useEffect(() => {
    const container = scrollRef.current;
    const selected = activeRef.current;
    if (!container || !selected) return;
    const containerRect = container.getBoundingClientRect();
    const selectedRect = selected.getBoundingClientRect();
    const left = container.scrollLeft + selectedRect.left - containerRect.left
      - (container.clientWidth - selectedRect.width) / 2;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    container.scrollTo({ left: Math.max(0, left), behavior: reduce ? 'auto' : 'smooth' });
  }, [active]);

  // 只在确实还有内容可滚动时显示对应边缘渐隐，避免起点处文字无故变淡。
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const sync = () => {
      const max = Math.max(0, container.scrollWidth - container.clientWidth);
      const next = { left: container.scrollLeft > 2, right: container.scrollLeft < max - 2 };
      setEdges((previous) => previous.left === next.left && previous.right === next.right ? previous : next);
    };
    sync();
    container.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(sync);
    observer?.observe(container);
    if (container.firstElementChild instanceof HTMLElement) observer?.observe(container.firstElementChild);
    return () => {
      container.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
      observer?.disconnect();
    };
  }, [merchants, totalDishes, counts]);

  const maskImage = edges.left || edges.right
    ? `linear-gradient(to right, ${edges.left ? 'transparent' : '#000'} 0, #000 20px, #000 calc(100% - 20px), ${edges.right ? 'transparent' : '#000'} 100%)`
    : undefined;

  return (
    <nav aria-label="商家筛选" className="mb-4">
      {/* 显式标签：评分门槛那排也是 chip，两排不加标签会长得一样、各有一个「全部」而分不清 */}
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-500">商家筛选</span>
        <span className="tnum text-[10px] font-bold tracking-[0.08em] text-ink-400">
          {merchants.length} 家
        </span>
      </div>
      <div
        ref={scrollRef}
        className="-mx-4 overflow-x-auto px-4 pb-1"
        style={{ maskImage, WebkitMaskImage: maskImage }}
      >
        <div className="flex w-max gap-2">
          <Tab label="全部" count={totalDishes} active={active === 'all'} onClick={() => onChange('all')} buttonRef={active === 'all' ? activeRef : undefined} />
          {merchants.map((merchant) => (
            <Tab
              key={merchant.id}
              label={merchant.name}
              count={counts.get(merchant.id)}
              active={active === merchant.id}
              onClick={() => onChange(merchant.id)}
              buttonRef={active === merchant.id ? activeRef : undefined}
            />
          ))}
        </div>
      </div>
    </nav>
  );
}
