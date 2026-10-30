import Link from 'next/link';
import { HOME_PAGE_HREF, NEWS_PAGE_HREF } from '@/lib/news';

/** 两个页面共用的紧凑导航，保证按钮顺序、尺寸和位置在路由切换时完全一致。 */
export function SiteNav({ active }: { active: 'dishes' | 'news' }) {
  return (
    <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:py-4">
      <span className="min-w-0 whitespace-nowrap font-display text-[19px] leading-none text-ink-900 sm:text-[22px]">
        <Link href={HOME_PAGE_HREF}>
          春晖园<span className="text-accent-600">菜品评价</span>
        </Link>
      </span>
      <nav aria-label="主导航" className="grid shrink-0 grid-cols-2 gap-1.5 text-[11px] font-bold sm:gap-2 sm:text-[12px]">
        {active === 'dishes' ? (
          <span aria-current="page" className="inline-flex min-h-11 items-center justify-center border-2 border-ink-900 bg-ink-900 px-2.5 text-paper sm:px-3">
            菜品评价
          </span>
        ) : (
          <Link href={HOME_PAGE_HREF} className="btn-ghost min-h-11 !px-2.5 sm:!px-3">菜品评价</Link>
        )}
        {active === 'news' ? (
          <span aria-current="page" className="inline-flex min-h-11 items-center justify-center border-2 border-accent-600 bg-accent-600 px-2.5 text-white sm:px-3">
            AI 日报
          </span>
        ) : (
          <Link href={NEWS_PAGE_HREF} className="btn-primary min-h-11 !px-2.5 sm:!px-3">AI 日报</Link>
        )}
      </nav>
    </div>
  );
}
