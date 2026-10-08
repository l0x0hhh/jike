import type { Config } from 'tailwindcss';
import {
  duration as dur,
  ease as easeTok,
  secondsToMs,
  bezierToCss,
} from './src/lib/motion-tokens';

/**
 * 设计令牌 · 方向 B「编辑式数字评分」
 *
 * 色彩推导（风格库的「采样 → 收敛 → 论证」三步法）：
 *  1. 采样：无品牌资产（用户明确「没有，你自由发挥」），故从**文化语境**取样——
 *     场景是餐饮点评、载体是教室/食堂里的一块屏幕。食物摄影环境里最缺的是冷色，
 *     所以拿一个被「拉满」的蓝当强调色，与暖纸底形成冷暖对峙；纸白就地取自印刷出版物。
 *  2. 收敛：2 个有彩色（accent 蓝 / 语义红绿黄）+ 1 组暖中性（ink 明度序列），
 *     有彩色之间色相角远大于 60°，明度也拉开。
 *  3. 论证：**主色是被拉满的蓝 #1B44E8，不是常见的橙**——理由是食堂场景已经全是暖色
 *     （食物、灯光、木桌），界面再上暖色只会淹没在环境里；冷蓝在这个语境下是唯一
 *     能跳出来的色，同时承担「评审/刻度」的语义（这是餐厅评论产品的通用语言）。
 *     底色用纸白 #FBF7F0 而非纯白，借印刷品的暖灰质感，避免屏幕的塑料感。
 *
 * 对比度（WCAG 2.2 AA，正文 ≥4.5:1）：
 *  - ink-900 #14110E / paper #FBF7F0 → 16.8:1
 *  - ink-500 #6B655C / paper #FBF7F0 → 5.5:1  ✅ 可承载辅助文字
 *  - accent-600 #1B44E8 / paper #FBF7F0 → 6.5:1 ✅
 *  - 白字 / accent-600 → 6.9:1 ✅
 *
 * 形状语言：圆角归零（`card`/`control` = 0）、实底描边取代柔和阴影——
 * 呼应 The Infatuation 品牌系统「粗描边 + 硬边」的做法，也是本方向的反 slop 手段。
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 纸底：印刷品暖白，不是屏幕纯白
        paper: '#FBF7F0',
        // 强调色：被拉满的蓝（替代了此前的暖橙）
        accent: {
          50: '#EEF1FE',
          100: '#DDE3FD',
          200: '#BCC7FB',
          300: '#93A6F7',
          400: '#6480F0',
          500: '#3D5EE8',
          600: '#1B44E8',
          700: '#1737C4',
          800: '#152C9B',
          900: '#142573',
        },
        // 暖中性明度序列（L 递减，写出来即是层级系统）
        ink: {
          50: '#F7F4EF',
          100: '#EFEAE2',
          200: '#DDD6CB',
          300: '#C4BBAE',
          400: '#8F887C',
          500: '#6B655C',
          600: '#4E483F',
          700: '#332E28',
          800: '#1F1B17',
          900: '#14110E',
        },
        // 语义色（低饱和，贴合印刷质感）
        ok: { 50: '#E9F5F0', 500: '#0E7A5F', 700: '#0A5A46' },
        warn: { 50: '#FDF4E3', 500: '#B4720A', 700: '#8A5608' },
        err: { 50: '#FDECEC', 500: '#C81E1E', 700: '#9B1C1C' },
      },

      // 圆角归零：本方向的形状签名
      borderRadius: {
        card: '0px',
        control: '0px',
        sheet: '2px',
      },

      // 高度层次用「实底描边 + 硬阴影」表达，不用柔和投影
      boxShadow: {
        'elevation-1': 'none',
        'elevation-2': '4px 4px 0 rgba(20, 17, 14, 0.10)',
        'elevation-3': '8px 8px 0 rgba(20, 17, 14, 0.14)',
      },

      // 8px 基线间距系统
      spacing: {
        '4.5': '1.125rem',
        '13': '3.25rem',
        '15': '3.75rem',
        '18': '4.5rem',
      },

      /**
       * 字体：单一家族撑起全部层级（The Infatuation 的核心做法）。
       *
       * `--font-archivo` / `--font-display` 由 next/font 在构建期自托管注入（见 app/layout.tsx），
       * 运行时零第三方请求。**只覆盖拉丁与数字**——价格、评分、编号的性格都在这里；
       * 中文回落到系统字（苹方 / 华为 / 雅黑 / Noto），
       * 因为中文没有等宽变体传统，层级只能靠**字重 + 字距**建立。
       */
      fontFamily: {
        sans: [
          'var(--font-archivo)',
          '-apple-system',
          'BlinkMacSystemFont',
          'PingFang SC',
          'HarmonyOS Sans SC',
          'Microsoft YaHei',
          'Noto Sans SC',
          'sans-serif',
        ],
        display: [
          'var(--font-display)',
          'var(--font-archivo)',
          '-apple-system',
          'PingFang SC',
          'HarmonyOS Sans SC',
          'Microsoft YaHei',
          'Noto Sans SC',
          'sans-serif',
        ],
      },

      // 与 src/lib/motion-tokens.ts 同源：CSS 过渡曲线
      transitionTimingFunction: {
        'out-soft': bezierToCss(easeTok.out),
        'in-soft': bezierToCss(easeTok.in),
        'in-out-soft': bezierToCss(easeTok.inOut),
        emphasized: bezierToCss(easeTok.emphasized),
      },
      // 与 src/lib/motion-tokens.ts 同源：CSS 过渡时长
      transitionDuration: {
        instant: secondsToMs(dur.instant),
        fast: secondsToMs(dur.fast),
        base: secondsToMs(dur.base),
        slow: secondsToMs(dur.slow),
        slower: secondsToMs(dur.slower),
      },

      keyframes: {
        // 入场：从 opacity:0 + 下移补间到可见终态。
        // 关键：**元素的默认态就是可见的**，隐藏态只存在于动画的 from 关键帧，
        // 由 animation-fill-mode: backwards 在延迟期间临时应用 —— 因此 SSR / 无 JS 都可见。
        'chy-enter': {
          from: { opacity: '0', transform: 'translate3d(0, var(--chy-enter-y, 8px), 0)' },
          to: { opacity: '1', transform: 'translate3d(0, 0, 0)' },
        },
        'chy-pop': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.18)' },
          '100%': { transform: 'scale(1)' },
        },
        'chy-toast-in': {
          from: { opacity: '0', transform: 'translate3d(0, 20px, 0)' },
          to: { opacity: '1', transform: 'translate3d(0, 0, 0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        enter: `chy-enter var(--chy-enter-duration, ${secondsToMs(dur.base)}) var(--chy-enter-ease, ${bezierToCss(easeTok.out)}) var(--chy-enter-delay, 0ms) 1 backwards`,
        pop: `chy-pop ${secondsToMs(dur.fast)} ${bezierToCss(easeTok.out)} 1 backwards`,
        'toast-in': `chy-toast-in ${secondsToMs(dur.base)} ${bezierToCss(easeTok.out)} 1 backwards`,
      },
    },
  },
  plugins: [],
};

export default config;
