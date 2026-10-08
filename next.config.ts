import type { NextConfig } from 'next';

/**
 * 构建模式：
 *  - 默认（Netlify / 本地 `next start`）：标准 Next 产物，带 CDN 缓存响应头
 *  - NEXT_STATIC_EXPORT=1：产出纯静态站点，不依赖任何服务即可打开
 *    （静态导出不支持 headers() 与图片优化器，故该模式下关闭它们）
 */
const isStaticExport = process.env.NEXT_STATIC_EXPORT === '1';
// 缓存头只在生产构建注入：dev 下自定义 Cache-Control 会干扰 HMR 与页面刷新
// （Next 会警告 “Setting a custom Cache-Control header can break Next.js development behavior”）
const isProd = process.env.NODE_ENV === 'production';

const prodHeaders = async () => [
  {
    // 带 hash 的静态资源可永久强缓存
    source: '/_next/static/:path*',
    headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
  },
  {
    // 菜品墙页面 CDN 缓存 60s，读并发打在边缘而非源站
    source: '/',
    headers: [
      { key: 'Cache-Control', value: 'public, s-maxage=60, stale-while-revalidate=300' },
    ],
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 注意：不启用 output: 'standalone'。那是 Docker 自部署用的，
  // Netlify 会自行处理 Next.js 产物，开了反而与 `next start` 不兼容。
  poweredByHeader: false,
  compress: true,
  // 支持用环境变量切换构建目录（本地避开被安全守卫占用的路径）
  distDir: process.env.NEXT_DIST_DIR || '.next',

  ...(isStaticExport
    ? {
        output: 'export' as const,
        // 资源用相对路径，便于静态产物流式打开（不经服务器也能正确解析 _next/*）
        assetPrefix: '.',
        images: { unoptimized: true },
      }
    : {
        images: { formats: ['image/avif', 'image/webp'] as const },
        ...(isProd ? { headers: prodHeaders } : {}),
      }),
};

export default nextConfig;
