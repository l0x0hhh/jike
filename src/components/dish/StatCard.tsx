'use client';

/**
 * 概览统计单元（方向 B，纯 CSS，无 motion 依赖）
 *
 * 从「圆角浅灰卡」改为「2px 实底描边的数字块」：标签在上（小字宽字距），
 * 数值在下（display 字体、巨大、等宽对齐）——数字成为视觉主角。
 *
 * · 骨架 → 内容：两层绝对定位重叠 + CSS opacity 过渡交叉淡入，不硬切换、不抖动。
 * · 进度条：用 transform: scaleX 生长（不动 width，避免重排），transform-origin 固定在左侧。
 */

import { useEffect, useState, type ReactNode } from 'react';

interface StatCardProps {
  label: string;
  loading: boolean;
  children: ReactNode;
}

export function StatCard({ label, loading, children }: StatCardProps) {
  return (
    <div className="flex h-full flex-col border-2 border-ink-900 p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-500">{label}</p>
      <div className="relative mt-2 min-h-[2.5rem] flex-1">
        {/* 骨架层 */}
        <div
          aria-hidden={!loading}
          className={`absolute inset-0 flex items-center transition-opacity duration-base ease-out-soft ${
            loading ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          <span className="skeleton h-8 w-20" />
        </div>
        {/* 内容层 */}
        <div
          className={`absolute inset-0 flex flex-col justify-center transition-opacity duration-base ease-out-soft ${
            loading ? 'opacity-0' : 'opacity-100'
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

interface ProgressBarProps {
  value: number;
  label?: string;
}

/** 覆盖率进度条：scaleX 生长（不动 width，避免重排），origin 固定在左侧 */
export function ProgressBar({ value, label = '覆盖率' }: ProgressBarProps) {
  const target = Math.min(1, Math.max(0, value / 100));
  const [scale, setScale] = useState(0);

  useEffect(() => {
    // 下一帧再设为目标值 → 触发 CSS transition 的「从 0 生长」
    const id = requestAnimationFrame(() => setScale(target));
    return () => cancelAnimationFrame(id);
  }, [target]);

  return (
    <div
      className="mt-2.5 h-1.5 w-full overflow-hidden bg-ink-200"
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className="h-full w-full origin-left bg-accent-600 transition-transform duration-slow ease-out-soft"
        style={{ transform: `scaleX(${scale})` }}
      />
    </div>
  );
}
