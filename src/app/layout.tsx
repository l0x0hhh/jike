import type { Metadata, Viewport } from 'next';
import { Archivo, Archivo_Black } from 'next/font/google';
import './globals.css';

/**
 * 字体（方向 B 的「单一家族撑层级」）
 *
 * 关键决策：**自托管，不用外链第三方样式表**。
 * 之前用 `<link href="https://fonts.googleapis.com/...">` 会引入一个**渲染阻塞**的跨域请求，
 * 实测会把首屏绘制与 CSS 入场动画的启动一起拖后（探针测到 12 张卡片在 1.6s 仍停在 from 帧）。
 * `next/font` 在构建期把字体下到本地、由同源提供，运行时零第三方往返，且不阻塞渲染。
 *
 * 另一个决策：**只下拉丁子集，不引中文 webfont**。
 * 中文 webfont 动辄数 MB，而中文排版的气质来自**字重 + 字距**而非字形本身
 * （中文没有等宽变体传统），系统字（苹方 / 华为 / 雅黑 / Noto）已足够；
 * 拉丁与数字才用 Archivo —— 价格、评分、编号的性格都在这里。
 */
const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-archivo',
  display: 'swap',
});

const archivoBlack = Archivo_Black({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: '春晖园菜品评价',
  description: '春晖园 16 家商家 · 371 道菜的真实用餐评价，方便填写，直观查看。',
  keywords: ['春晖园', '菜品评价', '美食', '校园'],
  openGraph: {
    title: '春晖园菜品评价',
    description: '分享真实用餐体验，帮同学少踩雷、多吃好。',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // 与纸底一致，移动端浏览器 UI 不跳色
  themeColor: '#FBF7F0',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${archivo.variable} ${archivoBlack.variable}`}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:border-2 focus:border-ink-900 focus:bg-accent-600 focus:px-4 focus:py-2 focus:font-bold focus:text-white"
        >
          跳到主要内容
        </a>
        {/* 入场等非浮层动效走纯 CSS；需要 motion 编排的浮层按需懒加载（见 MOTION.md） */}
        {children}
      </body>
    </html>
  );
}
