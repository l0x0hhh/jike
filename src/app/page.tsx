import DishPanel from '@/components/DishPanel';

// 菜品目录为静态导入，构建期确定 → 该页全量静态化，读并发由 Netlify CDN 承担
export const dynamic = 'force-static';

export default function Page() {
  return <DishPanel />;
}
