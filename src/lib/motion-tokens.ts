/**
 * 动效令牌 · 纯数值层（Design Tokens — pure values）
 *
 * ⚠️ 本文件**禁止** import 任何 `motion/react` 或其它运行时；它只能导出纯数值 / 纯类型，
 *    因为 `tailwind.config.ts`（构建期、Node 环境）也要 import 它来生成 CSS 令牌。
 *
 * 分层：
 *   motion-tokens.ts（本文件，纯数值，唯一真源）
 *        ├──▶ src/lib/motion.ts   re-export + variants（JS 侧运行时编排）
 *        └──▶ tailwind.config.ts  生成 transitionDuration / transitionTimingFunction / keyframes / animation
 *
 * 改一处数值 → JS 动效与 CSS 动效同步生效。
 */

/** cubic-bezier 四元组 */
export type Bezier = [number, number, number, number];

/** 时长（秒）。<0.16s 读作「瞬时」；0.24s 是感知上的「干脆」；>0.36s 只给大块面 */
export const duration = {
  instant: 0.1,
  fast: 0.16,
  base: 0.24,
  slow: 0.36,
  slower: 0.52,
} as const;

/** 缓动曲线。out = 快出慢收，最贴合真实物理的入场手感 */
export const ease: Record<'out' | 'in' | 'inOut' | 'emphasized', Bezier> = {
  out: [0.22, 1, 0.36, 1],
  in: [0.4, 0, 1, 1],
  inOut: [0.65, 0, 0.35, 1],
  emphasized: [0.16, 1, 0.3, 1],
};

/** 弹簧参数（结构兼容 motion 的 Transition）。snappy=控件，soft=列表/布局，gentle=抽屉/大浮层 */
export interface SpringConfig {
  type: 'spring';
  stiffness: number;
  damping: number;
  mass: number;
}

export const spring: Record<'snappy' | 'soft' | 'gentle', SpringConfig> = {
  snappy: { type: 'spring', stiffness: 520, damping: 34, mass: 0.9 },
  soft: { type: 'spring', stiffness: 320, damping: 32, mass: 1 },
  gentle: { type: 'spring', stiffness: 240, damping: 28, mass: 1 },
};

/** 位移刻度（px）。所有入场位移都从这里取，禁止魔法数字 */
export const distance = { xs: 4, sm: 8, md: 12, lg: 20 } as const;

/** 错峰步长（秒） */
export const stagger = { tight: 0.03, base: 0.05, loose: 0.08 } as const;

/**
 * 错峰条目上限。
 * 菜品墙最多 371 张卡片，若全量错峰入场会造成明显卡顿与长尾等待；
 * 超出该索引的条目**直接以最终态渲染**（不动画），保证首屏与滚动都流畅。
 */
export const MAX_STAGGER_ITEMS = 12;

/**
 * 布局重排动画的可见数量上限。
 * 可见菜品数 > 该值时，切换商家 / 排序瞬间完成（避免 371 项布局投影计算）；
 * ≤ 该值时才启用 motion 的 layout 平滑重排。
 */
export const LAYOUT_ANIMATION_LIMIT = 60;

/** 把贝塞尔四元组格式化为 CSS `cubic-bezier(...)` 字符串 */
export function bezierToCss(b: Bezier): string {
  return `cubic-bezier(${b[0]}, ${b[1]}, ${b[2]}, ${b[3]})`;
}

/** 秒 → `ms` 字符串（供 Tailwind transitionDuration / animation 使用） */
export function secondsToMs(s: number): string {
  return `${Math.round(s * 1000)}ms`;
}
