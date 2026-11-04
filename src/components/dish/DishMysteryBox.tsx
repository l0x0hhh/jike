'use client';

// 盲盒在手机和电脑上居中显示，并使用减速转轴揭晓随机菜品。
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { formatPrice, type Dish, type DishStat, type Merchant } from '@/lib/data';
import { drawMysteryDish } from '@/lib/mystery-box';
import { Pressable } from '../motion/Pressable';
import { ScoreReadout } from './ScoreReadout';

const MotionSheet = dynamic(() => import('../motion/MotionSheet').then(m => m.MotionSheet), { ssr: false });

export function DishMysteryBox({ dishes, merchants, stats, onOpen }: {
  dishes: readonly Dish[];
  merchants: readonly Merchant[];
  stats: Map<number, DishStat>;
  onOpen: (dish: Dish) => void;
}) {
  const [picked, setPicked] = useState<Dish | null>(null);
  const [open, setOpen] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [reel, setReel] = useState<Dish[]>([]);
  const [reelMoving, setReelMoving] = useState(false);
  const [error, setError] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frame = useRef<number | null>(null);
  const drawing = useRef(false);
  const stat = picked ? stats.get(picked.id) : undefined;
  const merchant = picked ? merchants.find(item => item.id === picked.merchant_id) : undefined;

  // 组件卸载时停止滚动，避免后台计时器更新已关闭的界面。
  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);

  // 关闭弹窗时停止滚动；结果保留，返回后仍可再抽。
  const close = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    timer.current = null;
    frame.current = null;
    drawing.current = false;
    setRolling(false);
    setReel([]);
    setReelMoving(false);
    setOpen(false);
  };

  const draw = () => {
    if (drawing.current) return;
    try {
      const next = drawMysteryDish(dishes, picked?.id);
      if (!next) {
        setError('暂时没有可抽取的菜品');
        return;
      }
      setError('');
      // 尊重系统的减弱动态效果设置，直接展示最终结果。
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setPicked(next);
        return;
      }

      drawing.current = true;
      setRolling(true);
      const start = dishes.findIndex(dish => dish.id === next.id);
      // 结果由安全随机数决定；转轴内容只负责展示，不改变结果。
      const sequence = Array.from({ length: 24 }, (_, i) => dishes[(start + i + 1) % dishes.length]);
      setReel([...sequence, next]);
      setReelMoving(false);
      frame.current = requestAnimationFrame(() => {
        frame.current = requestAnimationFrame(() => {
          setReelMoving(true);
          frame.current = null;
          timer.current = setTimeout(() => {
          setPicked(next);
          setReel([]);
          setReelMoving(false);
          setRolling(false);
          drawing.current = false;
          timer.current = null;
          }, 3600);
        });
      });
    } catch {
      setError('当前浏览器无法生成随机结果，请换个浏览器试试');
    }
  };

  return (
    <>
    <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog"
      className="min-h-11 shrink-0 border-l-2 border-ink-900 bg-accent-600 px-3 text-[13px] font-bold text-white hover:bg-accent-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-white">
      菜品盲盒
    </button>
    {open && <MotionSheet open onClose={close} labelledBy="mystery-title" centerOnMobile
      panelClassName="w-full max-w-lg max-h-[calc(var(--sheet-viewport-height,100dvh)-2rem)] overflow-y-auto border-2 border-ink-900 bg-paper shadow-elevation-3">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink-900 bg-accent-50 px-4 py-3">
        <div>
          <h2 id="mystery-title" className="font-display text-[20px] font-bold leading-tight text-ink-900">菜品盲盒</h2>
          <p className="mt-1 text-[12px] text-ink-600">不知道吃什么？从全部菜品中随机抽一道。</p>
        </div>
        <button type="button" onClick={close} aria-label="关闭菜品盲盒" className="btn-ghost h-11 w-11 shrink-0 !p-0 text-xl">×</button>
      </div>
      <div aria-live="polite" aria-atomic="true">
        {rolling && reel.length > 0 ? (
          <div className="flex min-h-24 items-center gap-4 overflow-hidden px-4 py-4">
            <span aria-hidden="true" className="font-display text-[30px] font-bold text-accent-600">?</span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-ink-500">正在为你挑选…</p>
              <div aria-hidden="true" className="mt-1 h-14 overflow-hidden border-y-2 border-accent-200">
                <div style={{ transform: `translateY(-${reelMoving ? (reel.length - 1) * 56 : 0}px)`, transition: reelMoving ? 'transform 3.6s cubic-bezier(0.12, 0.7, 0.15, 1)' : 'none' }}>
                  {reel.map((dish, index) => <div key={`${dish.id}-${index}`} className="flex h-14 items-center truncate text-[19px] font-bold text-ink-900">{dish.name}</div>)}
                </div>
              </div>
              <span className="sr-only" role="status">正在抽取菜品，请稍候</span>
            </div>
          </div>
        ) : picked ? (
          <button type="button" onClick={() => { close(); onOpen(picked); }}
            aria-label={`查看${picked.name}的菜品评价`}
            className="group flex min-h-24 w-full items-center gap-4 p-4 text-left transition-colors duration-base hover:bg-accent-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-600">
            <ScoreReadout value={stat?.avg_rating} count={stat?.review_count} />
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold text-ink-500">{merchant?.name ?? '春晖园'}</span>
              <span className="mt-1 block break-words text-[19px] font-bold leading-tight text-ink-900">{picked.name}</span>
              <span className="tnum mt-1 block text-[14px] font-bold text-accent-600">{formatPrice(picked)}</span>
              <span className="mt-1 block text-[12px] text-ink-600">{stat?.review_count ? `${stat.review_count} 条评价` : '暂无评价'} · 点击查看</span>
            </span>
            <span aria-hidden="true" className="text-xl text-accent-600">›</span>
          </button>
        ) : (
          <p className="px-4 py-4 text-[13px] text-ink-600">把今天吃什么交给运气，抽中后可以查看评价。</p>
        )}
        {error && <p role="alert" className="px-4 pb-3 text-[13px] text-err-700">{error}</p>}
      </div>
      <div className="border-t-2 border-ink-900 p-4">
        <Pressable type="button" onClick={draw} disabled={rolling || dishes.length === 0} hoverScale={1}
          className="btn-primary min-h-11 w-full text-[14px] disabled:cursor-not-allowed disabled:opacity-50">
          {rolling ? '抽取中…' : picked ? '再抽一次' : '抽一道菜'}
        </Pressable>
      </div>
    </MotionSheet>}
    </>
  );
}
