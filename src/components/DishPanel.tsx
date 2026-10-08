'use client';

/**
 * 主面板（编排层）
 *
 * 结构：sticky 头部（标题 / 搜索 / 排序 / 评分门槛）→ 概览统计 → 冷启动引导
 *      → 商家 Tab → 菜品墙 → 最新评价抽屉 → 评价弹窗 → Toast → 页脚
 *
 * 交互增强：
 *  · 乐观提交：提交即把新评价插入「最新评价」并即时反馈，失败回滚
 *  · 骨架 → 内容交叉淡入，静默校准不闪骨架
 *  · 顶部导航滚动后浮现细阴影
 *  · 弹窗与抽屉复用同一 MotionSheet 原语
 */

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  allDishes,
  checkRateLimit,
  fetchReviews,
  fetchStats,
  getCloudHealth,
  isCloudEnabled,
  merchants,
  meta,
  submitReview,
  type Dish,
  type DishStat,
  type Review,
} from '@/lib/data';
import type { MinRating, ReviewFormDraft, SortKey } from '@/types/dish-panel';
import { DishWall } from './dish/DishWall';
import { MerchantTabs } from './dish/MerchantTabs';
import { OverviewSection } from './dish/OverviewSection';
import { RatingFilter } from './dish/RatingFilter';
import { ReviewFeed } from './dish/ReviewFeed';
import { Toast } from './dish/Toast';
import { FadeIn } from './motion/FadeIn';
import { Pressable } from './motion/Pressable';
import { LayoutWarmup } from './motion/Stagger';

// 需要 motion 编排的浮层：按需懒加载 + 不 SSR（motion 运行时离开首屏）
const MotionSheet = dynamic(() => import('./motion/MotionSheet').then((m) => m.MotionSheet), { ssr: false });
const ReviewDialog = dynamic(() => import('./ReviewDialog').then((m) => m.ReviewDialog), { ssr: false });

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'default', label: '默认顺序' },
  { key: 'rating', label: '评分最高' },
  { key: 'most-reviewed', label: '评价最多' },
  { key: 'price-asc', label: '价格从低到高' },
  { key: 'price-desc', label: '价格从高到低' },
];

/** 乐观统计：先本地累加，服务器返回后再静默校准 */
function applyOptimisticStat(prev: Map<number, DishStat>, dishId: number, rating: number): Map<number, DishStat> {
  const next = new Map(prev);
  const cur = next.get(dishId) ?? { dish_id: dishId, review_count: 0, avg_rating: null };
  const count = cur.review_count + 1;
  const avg = cur.avg_rating ? (cur.avg_rating * cur.review_count + rating) / count : rating;
  next.set(dishId, { dish_id: dishId, review_count: count, avg_rating: Math.round(avg * 100) / 100 });
  return next;
}

export default function DishPanel() {
  const [activeMerchant, setActiveMerchant] = useState<number | 'all'>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('default');
  const [minRating, setMinRating] = useState<MinRating>(0);
  const [stats, setStats] = useState<Map<number, DishStat>>(new Map());
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<Dish | null>(null);
  const [toast, setToast] = useState('');
  const [showFeed, setShowFeed] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [cloudDegraded, setCloudDegraded] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // 顶部导航：滚动过阈值后浮现细阴影（纯原生监听，避免 motion 进首屏）
  useEffect(() => {
    const onScroll = () => {
      const next = window.scrollY > 8;
      setScrolled((prev) => (prev === next ? prev : next));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // 拉取统计数据（一次性，避免 N+1）。silent 用于后台校准，不闪骨架
  const loadData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    const [s, r] = await Promise.all([fetchStats(), fetchReviews(60)]);
    setStats(s);
    setReviews(r);
    setCloudDegraded(getCloudHealth().degraded);
    if (!opts?.silent) setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 本地降级模式提交后静默刷新
  useEffect(() => {
    const handler = () => loadData({ silent: true });
    window.addEventListener('chy:review-added', handler);
    return () => window.removeEventListener('chy:review-added', handler);
  }, [loadData]);

  // 回到前台时静默校准。
  // 为什么需要：页面只在挂载时拉一次数据，之后**永不刷新**。手机切后台/锁屏，
  // 再打开时看到的仍是打开那一刻的快照——这正是「电脑上刚写的评价、手机上
  // 一直没有」的成因（不是网络问题：那台手机明明写入成功过）。
  // 5s 节流，避免 visibilitychange 与 focus 双触发时重复打两次请求。
  useEffect(() => {
    let last = 0;
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - last < 5000) return;
      last = now;
      loadData({ silent: true });
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [loadData]);

  // 快捷键：/ 聚焦搜索
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 空闲时预取浮层 chunk：保证首次打开弹窗 / 抽屉仍然是即时的（含完整进场动画）
  const [warmLayout, setWarmLayout] = useState(false);
  useEffect(() => {
    const prefetch = () => {
      void import('./motion/MotionSheet');
      void import('./ReviewDialog');
      // 预挂载一次 LayoutItem，摊销其首次渲染的一次性成本（详见 Stagger.LayoutWarmup）
      setWarmLayout(true);
    };
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(prefetch);
      return () => w.cancelIdleCallback?.(id);
    }
    const timer = window.setTimeout(prefetch, 1200);
    return () => window.clearTimeout(timer);
  }, []);

  // 统计概览
  const overview = useMemo(() => {
    let total = 0;
    let sum = 0;
    let rated = 0;
    stats.forEach((s) => {
      total += s.review_count;
      if (s.avg_rating) {
        sum += s.avg_rating * s.review_count;
        rated += s.review_count;
      }
    });
    const covered = stats.size;
    return {
      totalReviews: total,
      avgRating: rated > 0 ? sum / rated : 0,
      coveredDishes: covered,
      coverage: (covered / allDishes.length) * 100,
    };
  }, [stats]);

  // 商家维度统计（Tab 上的计数）
  const merchantStats = useMemo(() => {
    const map = new Map<number, number>();
    stats.forEach((s, dishId) => {
      const dish = allDishes.find((d) => d.id === dishId);
      if (dish) map.set(dish.merchant_id, (map.get(dish.merchant_id) || 0) + s.review_count);
    });
    return map;
  }, [stats]);

  // 筛选 + 排序
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = allDishes;
    if (activeMerchant !== 'all') list = list.filter((d) => d.merchant_id === activeMerchant);
    if (q) list = list.filter((d) => d.name.toLowerCase().includes(q));
    if (minRating > 0) list = list.filter((d) => (stats.get(d.id)?.avg_rating ?? 0) >= minRating);

    if (sort === 'default') return list;
    const arr = [...list];
    arr.sort((a, b) => {
      if (sort === 'price-asc') return (a.price ?? Infinity) - (b.price ?? Infinity);
      if (sort === 'price-desc') return (b.price ?? -1) - (a.price ?? -1);
      const sa = stats.get(a.id);
      const sb = stats.get(b.id);
      if (sort === 'rating') {
        return (sb?.avg_rating ?? -1) - (sa?.avg_rating ?? -1) || a.id - b.id;
      }
      return (sb?.review_count ?? 0) - (sa?.review_count ?? 0) || a.id - b.id;
    });
    return arr;
  }, [activeMerchant, query, sort, stats, minRating]);

  const grouped = useMemo(() => {
    if (activeMerchant !== 'all' || query) return null;
    return merchants
      .map((m) => ({ merchant: m, dishes: visible.filter((d) => d.merchant_id === m.id) }))
      .filter((g) => g.dishes.length > 0);
  }, [visible, activeMerchant, query]);

  // 提交：乐观插入 → 成功即时反馈并后台校准；失败回滚
  const doSubmit = async (draft: ReviewFormDraft) => {
    if (!target) return { ok: false, error: '缺少目标菜品' };
    const dishId = target.id;
    const rate = checkRateLimit();
    if (!rate.ok) {
      return { ok: false, error: `提交太频繁啦，${rate.retryAfter} 秒后再试` };
    }

    const prevReviews = reviews;
    const prevStats = stats;
    const optimistic: Review = {
      id: `optimistic-${Date.now()}`,
      dish_id: dishId,
      ...draft,
      created_at: new Date().toISOString(),
    };
    setReviews((prev) => [optimistic, ...prev].slice(0, 60));
    setStats((prev) => applyOptimisticStat(prev, dishId, draft.rating));

    const res = await submitReview({ dish_id: dishId, ...draft });
    if (res.ok) {
      setToast('评价已提交，感谢分享！');
      window.setTimeout(() => setToast(''), 2500);
      await loadData({ silent: true });
    } else {
      setReviews(prevReviews);
      setStats(prevStats);
    }
    return res;
  };

  return (
    <div className="min-h-screen">
      {/* ===== 顶部 ===== */}
      <header
        className={
          'sticky top-0 z-30 border-b-2 border-ink-900 bg-paper/95 backdrop-blur transition-shadow duration-fast ' +
          (scrolled ? 'shadow-elevation-2' : '')
        }
      >
        <div className="mx-auto max-w-6xl px-4 pb-3 pt-4">
          {/* 报头：超大 display 字 + 收紧字距，右侧数字用等宽对齐 */}
          <div className="flex items-end justify-between gap-4">
            <h1 className="font-display text-[clamp(26px,4.4vw,44px)] font-normal leading-[0.95] tracking-[-0.035em] text-ink-900">
              春晖园<span className="text-accent-600">菜品评价</span>
            </h1>
            <div className="shrink-0 text-right">
              <div className="tnum text-[13px] font-bold text-ink-900">{meta.dishes} 道菜</div>
              <div className="tnum mt-0.5 text-[11px] font-semibold tracking-[0.04em] text-ink-500">
                {meta.merchants} 家商家 · {overview.totalReviews} 条评价
              </div>
              {!isCloudEnabled() && (
                <div className="mt-1.5 inline-block border border-warn-500 px-1.5 py-0.5 text-[10px] font-bold tracking-[0.08em] text-warn-700">
                  本地演示模式
                </div>
              )}
            </div>
          </div>

          {/* 工具条：搜索 / 排序 / 评价流入口排在同一条基准线上，用 2px 规则线分割 */}
          <div className="mt-3.5 flex items-stretch border-t-2 border-ink-900">
            <div className="relative min-w-0 flex-1">
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜菜名　按 / 聚焦"
                aria-label="搜索菜品"
                className="w-full border-0 bg-transparent py-3 text-[14px] font-medium text-ink-900 placeholder:font-normal placeholder:text-ink-400 focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="清空搜索"
                  className="absolute right-1 top-1/2 -translate-y-1/2 px-2 text-xl leading-none text-ink-400 hover:text-ink-900"
                >
                  ×
                </button>
              )}
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="排序方式"
              className="shrink-0 cursor-pointer border-0 border-l-2 border-ink-900 bg-paper px-3 text-[13px] font-bold text-ink-900 focus:outline-none"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <Pressable
              type="button"
              onClick={() => setShowFeed(true)}
              aria-expanded={showFeed}
              hoverScale={1}
              className="shrink-0 border-l-2 border-ink-900 bg-paper px-3 text-[13px] font-bold text-ink-900 transition-colors duration-200 hover:bg-ink-900 hover:text-paper"
            >
              最新评价
              {overview.totalReviews > 0 && (
                <span className="tnum ml-1.5 border border-ink-900 bg-accent-600 px-1.5 text-[11px] font-bold text-white">
                  {overview.totalReviews}
                </span>
              )}
            </Pressable>
          </div>

          {/* 评分门槛筛选 */}
          <RatingFilter value={minRating} onChange={setMinRating} />
        </div>
      </header>

      {/* 云端拉取失败提示：没有它的话，「网络不通」和「真的没人评价」在界面上无法区分 */}
      {cloudDegraded && (
        <div
          role="status"
          aria-live="polite"
          title={getCloudHealth().message || undefined}
          className="border-b-2 border-warn-500 bg-warn-50"
        >
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5">
            <span className="shrink-0 text-[13px] font-bold text-warn-700">云端连接失败</span>
            <span className="min-w-0 flex-1 text-[12px] font-medium text-ink-700">
              下面的评价数和评价流可能不完整。检查网络后重试。
            </span>
            <Pressable
              type="button"
              onClick={() => loadData()}
              hoverScale={1}
              className="shrink-0 border-2 border-warn-700 bg-paper px-2.5 py-1 text-[12px] font-bold text-warn-700 transition-colors duration-200 hover:bg-warn-700 hover:text-paper"
            >
              重试
            </Pressable>
          </div>
        </div>
      )}

      <main id="main" className="mx-auto max-w-6xl px-4 py-5">
        {/* ===== 概览统计 ===== */}
        <OverviewSection loading={loading} overview={overview} totalDishes={allDishes.length} />

        {/* 冷启动引导：整体没数据时给一个明确行动 */}
        {!loading && !cloudDegraded && overview.totalReviews === 0 && (
          <FadeIn className="mb-5 flex flex-col items-start gap-3 border-2 border-accent-600 bg-accent-50 p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="font-bold text-ink-900">还没有人评价过</p>
              <p className="tnum mt-0.5 text-[13px] font-medium text-ink-600">
                吃过哪道菜就写哪道，{allDishes.length - overview.coveredDishes} 道菜等你来第一票
              </p>
            </div>
            <Pressable
              type="button"
              onClick={() => {
                const first = allDishes.find((d) => !stats.get(d.id)) || allDishes[0];
                setTarget(first);
              }}
              className="btn-primary w-full shrink-0 sm:w-auto"
            >
              写第一条评价
            </Pressable>
          </FadeIn>
        )}

        {/* ===== 商家 Tab ===== */}
        <MerchantTabs
          merchants={merchants}
          totalDishes={allDishes.length}
          active={activeMerchant}
          counts={merchantStats}
          onChange={setActiveMerchant}
        />

        {/* ===== 菜品墙 ===== */}
        <DishWall
          visible={visible}
          grouped={grouped}
          stats={stats}
          query={query}
          onWrite={setTarget}
          onClearFilters={() => {
            setQuery('');
            setActiveMerchant('all');
            setMinRating(0);
          }}
        />
      </main>

      {/* ===== 最新评价抽屉 ===== */}
      <MotionSheet
        open={showFeed}
        onClose={() => setShowFeed(false)}
        variant="drawer"
        labelledBy="feed-title"
        panelClassName="flex h-full w-full max-w-md flex-col border-l-2 border-ink-900 bg-paper shadow-elevation-3"
      >
        <div className="flex shrink-0 items-center justify-between border-b-2 border-ink-900 bg-paper px-4 py-3.5">
          <h2 id="feed-title" className="font-display text-[19px] leading-none text-ink-900">
            最新评价
          </h2>
          <Pressable
            type="button"
            onClick={() => setShowFeed(false)}
            aria-label="关闭"
            hoverScale={1}
            className="btn-ghost !px-2.5 !py-0.5 text-xl leading-none"
          >
            ×
          </Pressable>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <ReviewFeed reviews={reviews} />
        </div>
      </MotionSheet>

      {/* ===== 评价弹窗 ===== */}
      <ReviewDialog open={target !== null} dish={target} onClose={() => setTarget(null)} onSubmit={doSubmit} />

      {/* ===== Toast ===== */}
      <Toast message={toast} />

      {/* 空闲预热：不可见的 LayoutItem，把首次重排的懒加载成本提前到空闲期 */}
      {warmLayout && <LayoutWarmup />}

      <footer className="border-t-2 border-ink-900 bg-paper px-4 py-6 text-center text-[11px] font-medium leading-relaxed text-ink-500">
        <p>数据来源于春晖园菜品评价表 · 评价免登录，提交后不可修改</p>
        <p className="mt-1">价格与菜名如有误，请反馈至原表更正</p>
      </footer>
    </div>
  );
}
