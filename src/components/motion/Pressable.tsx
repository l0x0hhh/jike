'use client';

/**
 * 统一按压手感（纯 CSS，无 motion 依赖）
 *
 * 通过 `.pressable` 类 + 两个 CSS 变量实现：
 *   --press-hover：悬停放大（默认 1.02，传 hoverScale=1 可关闭）
 *   --press-scale：按下缩小（默认 0.97）
 * 只动 transform、不触发布局重排；prefers-reduced-motion 下由 globals.css 关闭。
 *
 * props 类型用原生 ButtonHTMLAttributes（不再依赖 motion 的 HTMLMotionProps）。
 */

import { forwardRef, type ButtonHTMLAttributes, type CSSProperties } from 'react';

type CssVars = CSSProperties & Record<`--${string}`, string>;

export interface PressableProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 按下缩放，默认 0.97 */
  scaleTap?: number;
  /** 悬停放大，默认 1.02；传 1 可关闭 */
  hoverScale?: number;
}

export const Pressable = forwardRef<HTMLButtonElement, PressableProps>(function Pressable(
  { children, scaleTap = 0.97, hoverScale = 1.02, disabled, className = '', style, ...rest },
  ref,
) {
  const merged: CssVars = {
    '--press-hover': String(hoverScale),
    '--press-scale': String(scaleTap),
    ...(style as CssVars | undefined),
  };

  return (
    <button
      ref={ref}
      disabled={disabled}
      className={`pressable ${className}`.trim()}
      style={merged}
      {...rest}
    >
      {children}
    </button>
  );
});
