'use client';

// 单菜详情：独立查询历史评价，复用浮层外壳，固定写评价入口并分页加载。
import { useEffect, useRef, useState } from 'react';
import { fetchDishReviews, formatPrice, merchants, type Dish, type DishStat, type Review, type ReviewCursor } from '@/lib/data';
import { MotionSheet } from '../motion/MotionSheet';
import { ReviewFeed } from './ReviewFeed';

export function DishDetailDialog({ dish, stat, refreshKey, onClose, onWrite }: {
  dish: Dish; stat?: DishStat; refreshKey: number; onClose: () => void; onWrite: () => void;
}) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [cursor, setCursor] = useState<ReviewCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const items = useRef<Review[]>([]);
  const request = useRef(0);
  const busy = useRef(false);
  const merchant = merchants.find(item => item.id === dish.merchant_id);

  // 提交、实时通知与后台校准后重新读取已展开的数量，旧请求不能覆盖新数据。
  useEffect(() => {
    const revision = ++request.current;
    busy.current = true;
    setLoading(true);
    setError('');
    void fetchDishReviews(dish.id, null, Math.max(10, items.current.length)).then(page => {
      if (request.current !== revision) return;
      items.current = page.reviews;
      setReviews(page.reviews);
      setCursor(page.cursor);
      setHasMore(page.hasMore);
    }).catch(() => {
      if (request.current === revision) setError('评价加载失败，请检查网络后重试');
    }).finally(() => {
      if (request.current === revision) { busy.current = false; setLoading(false); }
    });
    return () => { request.current++; };
  }, [dish.id, refreshKey, retry]);

  // 用游标续读并按 ID 去重；加载更多失败时保留已读评价与原游标。
  const loadMore = async () => {
    if (busy.current || !hasMore) return;
    busy.current = true;
    const revision = ++request.current;
    setLoading(true);
    setError('');
    try {
      const page = await fetchDishReviews(dish.id, cursor);
      if (request.current !== revision) return;
      const ids = new Set(items.current.map(review => review.id));
      items.current = [...items.current, ...page.reviews.filter(review => !ids.has(review.id))];
      setReviews(items.current);
      setCursor(page.cursor);
      setHasMore(page.hasMore);
    } catch {
      if (request.current === revision) setError('评价加载失败，请检查网络后重试');
    } finally {
      if (request.current === revision) { busy.current = false; setLoading(false); }
    }
  };

  return (
    <MotionSheet open onClose={onClose} labelledBy="dish-detail-title"
      panelClassName="flex min-h-0 max-h-[min(92dvh,calc(var(--sheet-viewport-height,100dvh)-1rem))] w-full max-w-lg flex-col overflow-hidden border-2 border-ink-900 bg-paper shadow-elevation-3">
      {/* 头部保留菜名和总体统计，正文长列表单独滚动。 */}
      <header className="flex shrink-0 items-start justify-between gap-3 border-b-2 border-ink-900 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-ink-500">{merchant?.name}</p>
          <h2 id="dish-detail-title" className="mt-1 break-words text-[22px] font-bold text-ink-900">{dish.name}</h2>
          <p className="mt-1 text-sm font-bold text-accent-600">{formatPrice(dish)}</p>
          <p className="mt-2 text-xs font-semibold text-ink-700">
            总体均分 {stat?.avg_rating != null ? `${stat.avg_rating.toFixed(1)} / 5` : '暂无'} · {stat?.review_count ?? 0} 条评价
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="关闭菜品详情" className="btn-ghost h-11 w-11 shrink-0 !p-0 text-xl">×</button>
      </header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
        {/* 原表文字单独标明来源，不计入用户评价数。 */}
        {dish.existingReview && <p className="break-words border-l-2 border-accent-600 pl-3 text-sm text-ink-700">原表评价：{dish.existingReview}</p>}
        <h3 className="text-sm font-bold text-ink-900">这道菜的评价 <span className="font-normal text-ink-500">· 最新优先</span></h3>
        {reviews.length > 0 && <div className="[&_p]:break-words"><ReviewFeed reviews={reviews} /></div>}
        {loading && <p role="status" className="text-sm text-ink-500">正在加载评价…</p>}
        {error && <div role="alert" className="text-sm text-err-700">{error}<button type="button" className="ml-2 min-h-11 underline" onClick={() => setRetry(value => value + 1)}>重试</button></div>}
        {!loading && !error && reviews.length === 0 && <p className="py-8 text-center text-sm text-ink-500">暂无评价，来分享第一条吧</p>}
        {!error && hasMore && <button type="button" disabled={loading} onClick={loadMore} className="btn-ghost min-h-11 w-full disabled:opacity-50">加载更多</button>}
        {!loading && !error && reviews.length > 0 && !hasMore && <p className="text-center text-xs text-ink-500">已显示全部评价</p>}
      </div>
      {/* 手机端写评价按钮固定可见，查看长列表无需返回页首。 */}
      <footer className="shrink-0 border-t-2 border-ink-900 px-4 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        <button type="button" className="btn-primary min-h-11 w-full" onClick={onWrite}>写评价</button>
      </footer>
    </MotionSheet>
  );
}
