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

/** 大数字的统一排印：display 字体 + 等宽对齐 + 紧字距 */
const NUM = 'font-display tnum text-[34px] leading-[0.92] tracking-[-0.03em]';

export function OverviewSection({ loading, overview, totalDishes }: OverviewSectionProps) {
  return (
    <section aria-label="评价概览" className="mb-6">
      <StaggerGroup className="grid grid-cols-2 gap-2 sm:grid-cols-4" stagger={staggerTokens.base}>
        <StaggerItem>
          <StatCard label="总评价数" loading={loading}>
            <AnimatedNumber value={overview.totalReviews} className={`${NUM} text-ink-900`} />
          </StatCard>
        </StaggerItem>

        <StaggerItem>
          <StatCard label="平均评分" loading={loading}>
            {overview.avgRating > 0 ? (
              <span className="flex items-baseline gap-1.5">
                <AnimatedNumber
                  value={overview.avgRating}
                  decimals={1}
                  className={`${NUM} text-accent-600`}
                />
                <span className="text-[13px] font-bold text-ink-400">/5</span>
              </span>
            ) : (
              <span className={`${NUM} text-ink-400/70`}>—</span>
            )}
          </StatCard>
        </StaggerItem>

        <StaggerItem>
          <StatCard label="已评价菜品" loading={loading}>
            <span className="flex items-baseline gap-1">
              <AnimatedNumber value={overview.coveredDishes} className={`${NUM} text-ink-900`} />
              <span className="tnum text-[13px] font-bold text-ink-400">/{totalDishes}</span>
            </span>
          </StatCard>
        </StaggerItem>

        <StaggerItem>
          <StatCard label="覆盖率" loading={loading}>
            <div className="w-full">
              <span className={`${NUM} text-ink-900`}>
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
