/**
 * 数据访问层
 *
 * 架构决策（针对高并发）：
 * - 菜品目录读本地静态 JSON，不查库 → 读并发交给 CDN，无数据库瓶颈
 * - 评价读写走 Supabase REST（PostgREST），浏览器直连，不过 Netlify Functions
 * - 未配置 Supabase 环境变量时自动降级为 localStorage 模式，保证本地能跑通、能演示
 */

import type { Dish, Merchant, DishesData } from '@/types/dishes';
import dishesRaw from '../../data/dishes.json';

const data = dishesRaw as unknown as DishesData;
export type { Dish, Merchant };

export const merchants = data.merchants;
export const allDishes: Dish[] = merchants.flatMap((m) => m.dishes);
export const meta = data.stats;
export const sourceUrl = data.sourceUrl;

export interface Review {
  id: string;
  dish_id: number;
  nickname: string;
  rating: number;
  taste: number | null;
  portion: number | null;
  value: number | null;
  tags: string[];
  content: string;
  created_at: string;
}

export interface DishStat {
  dish_id: number;
  review_count: number;
  avg_rating: number | null;
}

export interface ReviewDraft {
  dish_id: number;
  nickname: string;
  rating: number;
  taste: number | null;
  portion: number | null;
  value: number | null;
  tags: string[];
  content: string;
}

// ---------- Supabase 客户端（懒加载，未配置时为 null） ----------

function makeClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  // 动态 import：未配置时不打包 supabase-js，省体积
  const { createClient } = require('@supabase/supabase-js') as typeof import('@supabase/supabase-js');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-application-name': 'chunhuiyuan-review' } },
  });
}

let cached: ReturnType<typeof makeClient> | null | undefined;
export function getSupabase() {
  if (cached === undefined) cached = makeClient();
  return cached;
}

export const isCloudEnabled = () => getSupabase() !== null;

// ---------- 云端拉取健康度 ----------
// 为什么需要它：下面两个拉取函数在失败时都静默返回空值，于是界面上的
// 「网络不通」和「真的没人评价」长得一模一样——排查成本极高（线上就踩过：
// 电脑能显示评价、手机显示为空，但页面上没有任何提示能区分原因）。
// 这里记录失败状态，供 UI 显示一条可重试的提示。
const cloudHealth = { statsFailed: false, reviewsFailed: false, lastMessage: '' };

export function getCloudHealth() {
  return {
    degraded: cloudHealth.statsFailed || cloudHealth.reviewsFailed,
    // 分开记录两类请求，后台更新失败时保留各自最后一次成功的数据。
    statsFailed: cloudHealth.statsFailed,
    reviewsFailed: cloudHealth.reviewsFailed,
    message: cloudHealth.lastMessage,
  };
}

/** 新评价通知：云端订阅新增记录，本地同步同一浏览器的其他标签页；返回清理函数。 */
export function subscribeToReviewUpdates(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const sb = getSupabase();
  if (!sb) {
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea === localStorage && (event.key === 'chy_reviews' || event.key === null)) onChange();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('chy:review-added', onChange);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('chy:review-added', onChange);
    };
  }

  // 统计由同一事务的触发器更新；收到评价通知后统一拉取，避免重复累加自己的乐观评价。
  const channel = sb
    .channel('dish-review-updates')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reviews' }, onChange)
    .subscribe((status) => {
      // 首次连接与断线重连后校准一次，补上订阅建立期间可能遗漏的评价。
      if (status === 'SUBSCRIBED') onChange();
    });
  return () => { void sb.removeChannel(channel); };
}

// ---------- 设备指纹（不可逆，仅用于限流去重） ----------

export function clientHash(): string {
  const KEY = 'chy_device_id';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(KEY, id);
  }
  // 同步哈希，避免明文 ID 落库
  let h = 5381;
  const salted = `chy2026::${id}`;
  for (let i = 0; i < salted.length; i++) h = ((h << 5) + h + salted.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

// ---------- 本地降级存储 ----------

const LS_REVIEWS = 'chy_reviews';
const LS_STATS_PREFIX = 'chy_stats_';

function lsReadReviews(): Review[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(LS_REVIEWS) || '[]');
  } catch {
    return [];
  }
}

function lsWriteReviews(list: Review[]) {
  localStorage.setItem(LS_REVIEWS, JSON.stringify(list));
  localStorage.setItem(LS_STATS_PREFIX + 'all', '1');
}

// ---------- 频率限制（双层：本地即时拦截 + 服务端可选校验） ----------

const RATE_LIMIT = { count: 5, windowMs: 60_000 };

export function checkRateLimit(): { ok: boolean; retryAfter: number } {
  if (typeof window === 'undefined') return { ok: true, retryAfter: 0 };
  const key = 'chy_rate_log';
  const now = Date.now();
  const log: number[] = (JSON.parse(localStorage.getItem(key) || '[]') as number[]).filter(
    (t) => now - t < RATE_LIMIT.windowMs
  );
  if (log.length >= RATE_LIMIT.count) {
    localStorage.setItem(key, JSON.stringify(log));
    const retryAfter = Math.ceil((RATE_LIMIT.windowMs - (now - log[0])) / 1000);
    return { ok: false, retryAfter };
  }
  log.push(now);
  localStorage.setItem(key, JSON.stringify(log));
  return { ok: true, retryAfter: 0 };
}

// ---------- 统计聚合（本地模式） ----------

function computeStatsLocally(reviews: Review[]): Map<number, DishStat> {
  const map = new Map<number, DishStat>();
  for (const r of reviews) {
    const cur = map.get(r.dish_id) || { dish_id: r.dish_id, review_count: 0, avg_rating: null };
    cur.review_count += 1;
    cur.avg_rating = cur.avg_rating
      ? Math.round(((cur.avg_rating * (cur.review_count - 1) + r.rating) / cur.review_count) * 100) / 100
      : r.rating;
    map.set(r.dish_id, cur);
  }
  return map;
}

/** 批量拉取所有评价统计（一次请求，避免 N+1） */
export async function fetchStats(): Promise<Map<number, DishStat>> {
  const sb = getSupabase();
  if (!sb) return computeStatsLocally(lsReadReviews());

  const { data, error } = await sb
    .from('dish_stats')
    .select('dish_id,review_count,avg_rating')
    .limit(2000);
  if (error) {
    console.error('[stats] 拉取失败，回退本地缓存', error.message);
    cloudHealth.statsFailed = true;
    cloudHealth.lastMessage = error.message;
    return new Map();
  }
  cloudHealth.statsFailed = false;
  return new Map((data ?? []).map((s) => [s.dish_id, s as DishStat]));
}

/** 拉取全部评价（用于评价流展示） */
export async function fetchReviews(limit = 100): Promise<Review[]> {
  const sb = getSupabase();
  if (!sb) return lsReadReviews().slice(0, limit);

  const { data, error } = await sb
    .from('reviews')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[reviews] 拉取失败', error.message);
    cloudHealth.reviewsFailed = true;
    cloudHealth.lastMessage = error.message;
    return [];
  }
  cloudHealth.reviewsFailed = false;
  return (data ?? []) as Review[];
}

// 单菜评价采用时间与 ID 游标分页，新增评价不会使后续页面重复或漏读。
export interface ReviewCursor { created_at: string; id: string }
export interface DishReviewPage { reviews: Review[]; hasMore: boolean; cursor: ReviewCursor | null }
export async function fetchDishReviews(dishId: number, cursor: ReviewCursor | null = null, limit = 10): Promise<DishReviewPage> {
  // Supabase 默认最多返回 1000 行，留出一行探测后续页，避免大量历史被误判为已读完。
  limit = Math.min(999, Math.max(1, limit));
  const sb = getSupabase();
  let rows: Review[];
  if (!sb) {
    rows = lsReadReviews().filter(review => review.dish_id === dishId)
      .sort((a, b) => a.created_at === b.created_at ? (a.id < b.id ? 1 : a.id > b.id ? -1 : 0) : (a.created_at < b.created_at ? 1 : -1))
      .filter(review => !cursor || review.created_at < cursor.created_at || (review.created_at === cursor.created_at && review.id < cursor.id))
      .slice(0, limit + 1);
  } else {
    let query = sb.from('reviews').select('*').eq('dish_id', dishId)
      .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit + 1);
    if (cursor) query = query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
    const { data, error } = await query;
    // 读取失败必须显示重试提示，不能伪装为暂无评价。
    if (error) throw new Error('评价加载失败，请检查网络后重试');
    rows = (data ?? []) as Review[];
  }
  const reviews = rows.slice(0, limit);
  const last = reviews.at(-1);
  return { reviews, hasMore: rows.length > limit, cursor: last ? { created_at: last.created_at, id: last.id } : null };
}

/** 提交评价 */
export async function submitReview(draft: ReviewDraft): Promise<{ ok: boolean; error?: string }> {
  const payload = {
    ...draft,
    client_hash: clientHash(),
  };

  const sb = getSupabase();
  if (!sb) {
    // 本地模式：模拟写入 + 通知面板刷新
    const list = lsReadReviews();
    const review: Review = {
      ...payload,
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      created_at: new Date().toISOString(),
    };
    list.unshift(review);
    lsWriteReviews(list);
    // 让 useDishPanel 的缓存失效
    window.dispatchEvent(new CustomEvent('chy:review-added'));
    return { ok: true };
  }

  const { error } = await sb.from('reviews').insert({
    dish_id: payload.dish_id,
    nickname: payload.nickname,
    rating: payload.rating,
    taste: payload.taste,
    portion: payload.portion,
    value: payload.value,
    tags: payload.tags,
    content: payload.content,
    client_hash: payload.client_hash,
  });

  if (error) {
    // 区分业务错误与网络错误，给出可行动提示
    if (error.message.includes('violates row-level security')) {
      // 这句话的含义是「RLS 正在正常拦截」，不是「RLS 没开启」。
      // 原文案「请检查数据库 RLS 策略是否已开启」会把人往完全相反的方向带。
      return {
        ok: false,
        error: '写入被拒绝：昵称需 1–20 字、评价内容不超过 500 字、快捷标签最多 6 个',
      };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

// ---------- 工具函数 ----------

export function formatPrice(d: Dish): string {
  if (d.price === null || d.price === undefined) {
    return d.priceNote || '价格待补充';
  }
  return d.unit && d.unit !== '份' ? `${d.price} 元/${d.unit}` : `${d.price.toFixed(2)} 元`;
}

export function dishById(id: number): Dish | undefined {
  return allDishes.find((d) => d.id === id);
}

export function merchantOf(dishId: number): Merchant | undefined {
  return merchants.find((m) => m.dishes.some((d) => d.id === dishId));
}
