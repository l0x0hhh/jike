'use client';

/**
 * MotionSheet —— 统一浮层外壳（dialog / drawer 二合一）
 *
 * 内聚能力（弹窗与抽屉复用，避免各写一套）：
 *  · AnimatePresence 管理进出场（含**出场**，修复旧弹窗只有入场的问题）
 *  · 背景遮罩淡入淡出
 *  · dialog：桌面居中弹簧缩放；移动端底部上滑 + 下拉关闭（drag）
 *  · drawer：右侧滑入
 *  · Esc 关闭 / 点击遮罩关闭 / 点击面板不关闭
 *  · 焦点管理：打开聚焦面板、Tab 焦点锁在面板内、关闭还原到触发元素
 *  · role="dialog" + aria-modal + aria-labelledby
 *  · 打开时锁定 body 滚动
 */

import { AnimatePresence, motion, useReducedMotion, type PanInfo, type Variants } from 'motion/react';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { variants as v } from '@/lib/motion';
import { MotionProvider } from './MotionProvider';

export type SheetVariant = 'dialog' | 'drawer';

interface MotionSheetProps {
  open: boolean;
  onClose: () => void;
  variant?: SheetVariant;
  /** 标题元素 id，用于 aria-labelledby */
  labelledBy?: string;
  /** 无标题时的 aria-label 兜底 */
  label?: string;
  /** 是否允许移动端下拉关闭 */
  dismissible?: boolean;
  /** 面板附加 class（承载尺寸 / 圆角 / 布局） */
  panelClassName?: string;
  children: ReactNode;
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** 移动端判定（<640px 与 Tailwind sm 断点对齐） */
function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return mobile;
}

export function MotionSheet({
  open,
  onClose,
  variant = 'dialog',
  labelledBy,
  label,
  dismissible = true,
  panelClassName = '',
  children,
}: MotionSheetProps) {
  const [mounted, setMounted] = useState(false);
  const isMobile = useIsMobile();
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 锁定 body 滚动
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // 焦点：打开聚焦面板，关闭还原到触发元素
  useEffect(() => {
    if (!open) return;
    lastFocused.current = (document.activeElement as HTMLElement) ?? null;
    const timer = window.setTimeout(() => panelRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(timer);
      lastFocused.current?.focus?.();
    };
  }, [open]);

  // Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Tab 焦点锁：把焦点圈在面板内
  const onKeyDown = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;
    const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    );
    if (nodes.length === 0) {
      e.preventDefault();
      panel.focus();
      return;
    }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey) {
      if (active === first || active === panel) {
        e.preventDefault();
        last.focus();
      }
    } else if (active === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  const dragEnabled = dismissible && variant === 'dialog' && isMobile && !reduce;

  const handleDragEnd = useCallback(
    (_e: unknown, info: PanInfo) => {
      if (info.offset.y > 130 || info.velocity.y > 700) onClose();
    },
    [onClose],
  );

  const panelVariants: Variants = variant === 'drawer' ? v.slideInRight : isMobile ? v.slideUp : v.dialogPop;

  if (!mounted) return null;

  const overlayClass =
    variant === 'drawer'
      ? 'fixed inset-0 z-50 flex justify-end bg-ink-900/40 backdrop-blur-sm'
      : 'fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 backdrop-blur-sm sm:items-center sm:p-4';

  return createPortal(
    <MotionProvider>
      <AnimatePresence>
        {open && (
          <motion.div
            key="sheet-overlay"
            className={overlayClass}
            variants={v.backdrop}
            initial="initial"
            animate="animate"
            exit="exit"
            onClick={onClose}
          >
            <motion.div
              key="sheet-panel"
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={labelledBy}
              aria-label={labelledBy ? undefined : label}
              tabIndex={-1}
              className={panelClassName}
              variants={panelVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={onKeyDown}
              drag={dragEnabled ? 'y' : false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.5 }}
              onDragEnd={dragEnabled ? handleDragEnd : undefined}
            >
              {variant === 'dialog' && isMobile && dismissible && (
                <div aria-hidden="true" className="flex shrink-0 justify-center pb-1 pt-2.5">
                  <span className="h-1.5 w-10 rounded-full bg-ink-300" />
                </div>
              )}
              {children}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionProvider>,
    document.body,
  );
}
