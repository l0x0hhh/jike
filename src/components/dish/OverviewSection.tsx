'use client';

/**
 * 概览统计（方向 B）：4 个 2px 描边数字块，数字用 display 字体做主角。
 * 首屏挂载错峰淡入，数字滚动，覆盖率进度条 scaleX 生长。
 */

import { AnimatedNumber } from '../motion/AnimatedNumber';
import { StaggerGroup, StaggerItem } from '../motion/Stagger';
import { ProgressBar, StatCard } from './StatCard';
import { stagger as staggerTokens } from '@/lib/motion';

export interface Overview {
  totalReviews: number;
  avgRating: number;
  coveredDishes: number;
  coverage: number;
}

interface OverviewSectionProps {
  loading: boolean;
  overview: Overview;
  totalDishes: number;
}

/** 手机概览使用紧凑数字，四项同排；桌面维持原来的大数字。 */
const NUM = 'font-display tnum text-[20px] leading-[0.92] tracking-[-0.03em] sm:text-[34px]';

export function OverviewSection({ loading, overview, totalDishes }: OverviewSectionProps) {
  return (
    <section aria-label="评价概览" className="mb-6">
      <StaggerGroup className="grid grid-cols-4 gap-1 sm:gap-2" stagger={staggerTokens.base}>
        <StaggerItem>
          <StatCard label="总评价数" mobileLabel="评价数" loading={loading}>
            {/* 手机大评价数按万/亿缩写，完整数值保留在标题与读屏名称中。 */}
            {overview.totalReviews >= 10_000 ? (
              <>
                <span className="font-display tnum text-[16px] text-ink-900 sm:hidden" title={`${overview.totalReviews} 条评价`} aria-label={`${overview.totalReviews} 条评价`}>
                  {new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(overview.totalReviews)}
                </span>
                <AnimatedNumber value={overview.totalReviews} className={`${NUM} hidden text-ink-900 sm:inline`} />
              </>
            ) : <AnimatedNumber value={overview.totalReviews} className={`${NUM} text-ink-900`} />}
          </StatCard>
        </StaggerItem>

        <StaggerItem>
          <StatCard label="平均评分" mobileLabel="均分" loading={loading}>
            {overview.avgRating > 0 ? (
              <span className="flex items-baseline gap-0.5 sm:gap-1.5">
                <AnimatedNumber
                  value={overview.avgRating}
                  decimals={1}
                  className={`${NUM} text-accent-600`}
                />
                <span className="text-[10px] font-bold text-ink-500 sm:text-[13px]">/5</span>
              </span>
            ) : (
              <span className={`${NUM} text-ink-400/70`}>—</span>
            )}
          </StatCard>
        </StaggerItem>

        <StaggerItem>
          <StatCard label="已评价菜品" mobileLabel="已评价" loading={loading}>
            <span className="flex items-baseline gap-1">
              <AnimatedNumber value={overview.coveredDishes} className={`${NUM} text-ink-900`} />
              {/* 菜品总数已在手机报头展示，避免分母挤出窄卡片。 */}
              <span className="tnum sr-only text-[13px] font-bold text-ink-400 sm:not-sr-only">/{totalDishes}</span>
            </span>
          </StatCard>
        </StaggerItem>

        <StaggerItem>
          <StatCard label="覆盖率" loading={loading}>
            <div className="w-full">
              <span className="font-display tnum text-[18px] leading-[0.92] tracking-[-0.03em] text-ink-900 sm:text-[34px]">
                <AnimatedNumber value={overview.coverage} />%
              </span>
              <ProgressBar value={Math.min(100, overview.coverage)} />
            </div>
          </StatCard>
        </StaggerItem>
      </StaggerGroup>
    </section>
  );
}
