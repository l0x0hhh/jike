'use client';

/**
 * Toast（纯 CSS，无 motion 依赖）
 *
 * · 常驻容器，通过 class 切换 opacity/transform 实现「下方上滑淡入 → 淡出下移」。
 * · 容器常驻是为了让进出场都能走 CSS transition（挂载即终态则无过渡）。
 * · 消息清空后延迟清掉文本，避免读屏或视觉残留。
 */

import { useEffect, useRef, useState } from 'react';

export function Toast({ message }: { message: string }) {
  const [text, setText] = useState('');
  const clearTimer = useRef<number | null>(null);
  const visible = message.length > 0;

  useEffect(() => {
    if (clearTimer.current) {
      clearTimeout(clearTimer.current);
      clearTimer.current = null;
    }
    if (message) {
      setText(message);
      return;
    }
    // 退场动画（duration.base=240ms）结束后再清空文本
    clearTimer.current = window.setTimeout(() => setText(''), 260);
    return () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
    };
  }, [message]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
      <div
        role="status"
        aria-live="polite"
        className={`border-2 border-ink-900 bg-accent-600 px-5 py-2.5 text-sm font-bold text-white transition duration-base ease-out-soft ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
        }`}
      >
        {text}
      </div>
    </div>
  );
}
