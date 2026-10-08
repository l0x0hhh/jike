'use client';

/**
 * 评价填写弹窗（方向 B）
 *
 * 交互清晰性：
 * · 走统一 MotionSheet 外壳（有出场动画、焦点锁、Esc / 遮罩关闭、移动端下拉关闭）
 * · 底部固定操作条：CTA 始终可见，手机不必先滚到底
 * · 必填 / 选填用统一徽标表达（不只靠红星），并在 CTA 上方就近提示「还差哪些」
 * · 提交成功：表单淡出 → 成功标记浮现
 *
 * 方向 B 调整：星星 → 数字量表；圆角 → 直角；白卡 → 纸底；细线 → 2px 实底描边；
 * 输入框改为「下划线式」，减少框线噪声，让填写区更安静。
 */

import { AnimatePresence, m } from 'motion/react';
import { useEffect, useState, type ReactNode } from 'react';
import { formatPrice, merchants, type Dish } from '@/lib/data';
import { distance as dist, duration, ease, spring } from '@/lib/motion';
import type { ReviewFormDraft } from '@/types/dish-panel';
import { NumericScale } from './NumericScale';
import { MotionSheet } from './motion/MotionSheet';
import { Pressable } from './motion/Pressable';

const TAG_POOL = [
  '分量足', '分量少', '偏辣', '不辣', '很香', '偏咸', '偏甜', '油腻',
  '肉很多', '性价比高', '性价比低', '卖相好', '味道一般', '会回购', '踩雷',
];

const DEFAULT_VISIBLE_TAGS = 8;

/** 下划线式输入：只留底部 2px 实线，减少框线噪声 */
const INPUT_CLS =
  'w-full border-0 border-b-2 border-ink-900 bg-transparent px-0 py-2 text-[15px] font-medium ' +
  'text-ink-900 placeholder:font-normal placeholder:text-ink-400 focus:border-accent-600 ' +
  'focus:outline-none';

interface ReviewDialogProps {
  open: boolean;
  dish: Dish | null;
  onClose: () => void;
  onSubmit: (draft: ReviewFormDraft) => Promise<{ ok: boolean; error?: string }>;
}

function FieldLabel({
  htmlFor,
  children,
  required = false,
  note,
}: {
  htmlFor?: string;
  children: ReactNode;
  required?: boolean;
  note?: string;
}) {
  const badge = (
    <span
      className={
        'shrink-0 border px-1.5 py-0.5 text-[10px] font-bold tracking-[0.1em] ' +
        (required
          ? 'border-accent-600 bg-accent-600 text-white'
          : 'border-ink-300 text-ink-500')
      }
    >
      {required ? '必填' : '选填'}
    </span>
  );
  const inner = (
    <>
      {children}
      {badge}
      {note && <span className="text-xs font-normal text-ink-400">{note}</span>}
    </>
  );
  const cls = 'mb-2 flex items-center gap-2 text-[13px] font-bold text-ink-900';
  return htmlFor ? (
    <label htmlFor={htmlFor} className={cls}>
      {inner}
    </label>
  ) : (
    <p className={cls}>{inner}</p>
  );
}

export function ReviewDialog({ open, dish, onClose, onSubmit }: ReviewDialogProps) {
  // 缓存最后一个 dish，保证关闭动画期间内容不消失
  const [cached, setCached] = useState<Dish | null>(null);
  useEffect(() => {
    if (dish) setCached(dish);
  }, [dish]);
  const shown = dish ?? cached;

  const [nickname, setNickname] = useState('');
  const [rating, setRating] = useState(0);
  const [taste, setTaste] = useState(0);
  const [portion, setPortion] = useState(0);
  const [value, setValue] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [touchedNickname, setTouchedNickname] = useState(false);

  // 打开时复位表单（关闭期间保留内容，避免出场动画时表单闪空）
  useEffect(() => {
    if (!open) return;
    setNickname('');
    setRating(0);
    setTaste(0);
    setPortion(0);
    setValue(0);
    setTags([]);
    setContent('');
    setStatus('idle');
    setErrMsg('');
    setShowMore(false);
    setTouchedNickname(false);
  }, [open]);

  const merchantName = shown ? merchants.find((x) => x.id === shown.merchant_id)?.name ?? '' : '';
  const priceText = shown ? formatPrice(shown) : '';

  const visibleTags = showMore ? TAG_POOL : TAG_POOL.slice(0, DEFAULT_VISIBLE_TAGS);
  const canSubmit = nickname.trim().length > 0 && rating > 0 && status !== 'submitting';

  const missing: string[] = [];
  if (!nickname.trim()) missing.push('昵称');
  if (rating === 0) missing.push('总体评分');

  const toggleTag = (tag: string) =>
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((x) => x !== tag) : prev.length < 6 ? [...prev, tag] : prev
    );

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setStatus('submitting');
    const res = await onSubmit({
      nickname: nickname.trim(),
      rating,
      taste: taste || null,
      portion: portion || null,
      value: value || null,
      tags,
      content: content.trim(),
    });
    if (res.ok) {
      setStatus('done');
      window.setTimeout(() => onClose(), 1400);
    } else {
      setStatus('error');
      setErrMsg(res.error || '提交失败，请稍后重试');
    }
  };

  return (
    <MotionSheet
      open={open}
      onClose={onClose}
      variant="dialog"
      labelledBy="review-dialog-title"
      panelClassName="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden border-2 border-ink-900 bg-paper shadow-elevation-3"
    >
      {/* 头部 */}
      <header className="flex shrink-0 items-start justify-between gap-3 border-b-2 border-ink-900 bg-paper px-5 py-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-500">
            {merchantName}
          </p>
          <h2 id="review-dialog-title" className="mt-1 text-[22px] font-bold leading-tight text-ink-900">
            {shown?.name ?? ''}
          </h2>
          <p className="tnum mt-1 text-[15px] font-bold text-accent-600">{priceText}</p>
        </div>
        <Pressable
          type="button"
          onClick={onClose}
          aria-label="关闭"
          hoverScale={1}
          className="btn-ghost shrink-0 !px-2.5 !py-0.5 text-xl leading-none"
        >
          ×
        </Pressable>
      </header>

      <AnimatePresence mode="wait" initial={false}>
        {status === 'done' ? (
          <m.div
            key="done"
            className="flex flex-col items-center gap-4 px-5 py-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <m.div
              className="flex h-16 w-16 items-center justify-center border-2 border-ok-700 bg-ok-50 text-3xl font-bold text-ok-700"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1, transition: spring.snappy }}
            >
              ✓
            </m.div>
            <p className="text-xl font-bold text-ink-900">评价已提交</p>
            <p className="text-sm font-medium text-ink-500">感谢分享，帮到下一位同学</p>
          </m.div>
        ) : (
          <m.div
            key="form"
            className="flex min-h-0 flex-1 flex-col"
            exit={{ opacity: 0, y: dist.xs, transition: { duration: duration.fast, ease: ease.in } }}
          >
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
              {/* 昵称 */}
              <div>
                <FieldLabel htmlFor="nick" required>
                  你的昵称
                </FieldLabel>
                <input
                  id="nick"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  onBlur={() => setTouchedNickname(true)}
                  maxLength={20}
                  placeholder="如：小虾"
                  aria-invalid={touchedNickname && !nickname.trim()}
                  className={INPUT_CLS}
                />
                {touchedNickname && !nickname.trim() && (
                  <p className="mt-1.5 text-xs font-semibold text-err-700">
                    还没有填写昵称，写个名字才能提交
                  </p>
                )}
              </div>

              {/* 总评分 */}
              <div>
                <FieldLabel required>总体评分</FieldLabel>
                <NumericScale value={rating} onChange={setRating} label="总体评分" size="lg" />
              </div>

              {/* 三维评分 */}
              <div className="border-2 border-ink-900 p-3.5">
                <p className="mb-3 flex items-center gap-2 text-[13px] font-bold text-ink-900">
                  分维度评分
                  <span className="border border-ink-300 px-1.5 py-0.5 text-[10px] font-bold tracking-[0.1em] text-ink-500">
                    选填
                  </span>
                </p>
                <div className="space-y-3">
                  {(
                    [
                      ['口味', taste, setTaste],
                      ['分量', portion, setPortion],
                      ['性价比', value, setValue],
                    ] as const
                  ).map(([label, val, setter]) => (
                    <div key={label} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                      <span className="w-14 shrink-0 text-[13px] font-bold text-ink-700">{label}</span>
                      <NumericScale
                        value={val}
                        onChange={setter}
                        label={`${label}评分`}
                        size="sm"
                        optional
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* 快捷标签 */}
              <div>
                <FieldLabel note="最多 6 个">快捷标签</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {visibleTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className="chip"
                      data-active={tags.includes(tag)}
                      aria-pressed={tags.includes(tag)}
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowMore((v) => !v)}
                  className="mt-2.5 text-[13px] font-bold text-accent-600 underline decoration-2 underline-offset-4 hover:text-ink-900"
                >
                  {showMore ? '收起标签' : `更多标签 (${TAG_POOL.length - DEFAULT_VISIBLE_TAGS})`}
                </button>
              </div>

              {/* 文字评价 */}
              <div>
                <FieldLabel htmlFor="content" note="说清口味和分量更有参考价值">
                  详细评价
                </FieldLabel>
                <textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  maxLength={500}
                  rows={4}
                  placeholder="例如：肉给得足，酱汁偏咸一点，配菜够味，19.9 吃到撑。"
                  className={`${INPUT_CLS} resize-y leading-relaxed`}
                />
                <p className="tnum mt-1 text-right text-[11px] font-semibold text-ink-400">
                  {content.length}/500
                </p>
              </div>

              {status === 'error' && (
                <div
                  role="alert"
                  className="border-2 border-err-500 bg-err-50 px-3.5 py-2.5 text-sm font-semibold text-err-700"
                >
                  {errMsg}
                </div>
              )}
            </div>

            {/* 底部固定操作条：CTA 始终可见 */}
            <footer className="shrink-0 border-t-2 border-ink-900 bg-paper px-5 py-3.5">
              <AnimatePresence initial={false}>
                {missing.length > 0 && (
                  <m.p
                    key="missing"
                    initial={{ opacity: 0, y: dist.xs }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: duration.fast, ease: ease.out }}
                    className="mb-2 text-center text-xs font-semibold text-ink-500"
                  >
                    还差：{missing.join('、')}
                  </m.p>
                )}
              </AnimatePresence>
              <Pressable
                type="button"
                disabled={!canSubmit}
                onClick={handleSubmit}
                className="btn-primary w-full !py-3.5 disabled:cursor-not-allowed disabled:bg-ink-300"
              >
                {status === 'submitting' ? '提交中…' : '提交评价'}
              </Pressable>
              <p className="mt-2.5 text-center text-[11px] font-medium leading-relaxed text-ink-500">
                评价提交后不可修改或删除 · 价格或菜名有误可在原表反馈
              </p>
            </footer>
          </m.div>
        )}
      </AnimatePresence>
    </MotionSheet>
  );
}
