'use client';

/**
 * 数字滚动（requestAnimationFrame 自实现，无 motion 依赖）
 *
 * · 数据到达时从当前显示值补间到新值；缓动曲线取自 duration 令牌同源的 ease.out。
 * · 系统开启「减弱动效」(prefers-reduced-motion: reduce) 时**直接显示终值**，不做补间。
 */

import { useEffect, useRef, useState } from 'react';
import { duration as dur, ease } from '@/lib/motion';

/** 生成 cubic-bezier(x1,y1,x2,y2) 的缓动函数（牛顿迭代求 x→t，再取 y） */
function cubicBezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const sampleDX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const dx = sampleX(t) - x;
      if (Math.abs(dx) < 1e-4) break;
      const d = sampleDX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= dx / d;
    }
    return sampleY(t);
  };
}

interface AnimatedNumberProps {
  value: number;
  decimals?: number;
  className?: string;
  /** 补间时长（秒），默认 duration.slow */
  duration?: number;
}

export function AnimatedNumber({ value, decimals = 0, className, duration: durSec = dur.slow }: AnimatedNumberProps) {
  // 初始展示当前值（首屏为 0，数据到达后再补间）
  const [display, setDisplay] = useState<number>(value);
  const fromRef = useRef<number>(value);

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduce) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }

    const from = fromRef.current;
    const to = value;
    if (from === to) {
      setDisplay(to);
      return;
    }

    const easeOut = cubicBezier(ease.out[0], ease.out[1], ease.out[2], ease.out[3]);
    const start = performance.now();
    const total = Math.max(1, durSec * 1000);
    let raf = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / total);
      setDisplay(from + (to - from) * easeOut(t));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
        setDisplay(to);
      }
    };
    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, [value, durSec]);

  return <span className={className}>{display.toFixed(decimals)}</span>;
}
