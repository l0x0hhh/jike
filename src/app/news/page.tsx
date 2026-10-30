import type { Metadata } from 'next';
import Link from 'next/link';
import { FadeIn } from '@/components/motion/FadeIn';
import { SiteNav } from '@/components/SiteNav';
import { getLatestDaily } from '@/lib/daily';
import { HOME_PAGE_HREF, IS_STATIC_EXPORT, NEWS_HOME_URL, safeExternalUrl, type DailyContentItem } from '@/lib/news';

export const metadata: Metadata = {
  title: '安全与 AI 日报｜春晖园',
  description: '由安智前沿提供内容的安全与 AI 每日简报，在本站阅读摘要并跳转原文。',
};

// 页面每 5 分钟检查是否到达每日刷新点；上游 API 缓存由 daily.ts 对齐至 08:05。
export const revalidate = 300;

function formatDate(date: string): string {
  const [year, month, day] = date.split('-');
  return year && month && day ? `${year} 年 ${Number(month)} 月 ${Number(day)} 日` : date;
}

function formatGeneratedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function NewsItem({ item, index }: { item: DailyContentItem; index: number }) {
  const original = safeExternalUrl(item.links.original);
  return (
    <li className="card flex gap-3 p-4 sm:gap-4 sm:p-5">
      <span aria-hidden="true" className="font-display tnum shrink-0 text-[26px] leading-none text-accent-600">
        {String(index + 1).padStart(2, '0')}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-[17px] font-bold leading-snug text-ink-900">{item.title}</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-600 sm:text-sm">{item.summary}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold">
          <span className="text-ink-500">来源：{item.source.name}</span>
          {original && (
            <a href={original} target="_blank" rel="noopener noreferrer" className="min-h-11 inline-flex items-center font-bold text-accent-600 underline decoration-2 underline-offset-4 hover:text-ink-900">
              查看原文<span aria-hidden="true" className="ml-1">↗</span>
              <span className="sr-only">（新窗口打开）</span>
            </a>
          )}
        </div>
      </div>
    </li>
  );
}

export default async function NewsPage() {
  const { report, failed } = await getLatestDaily();
  const reportUrl = safeExternalUrl(report?.links.aihot) ?? NEWS_HOME_URL;
  const itemCount = report?.sections.reduce((total, section) => total + section.items.length, 0) ?? 0;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b-2 border-ink-900 bg-paper/95 backdrop-blur">
        <SiteNav active="news" />
      </header>

      <main id="main" className="mx-auto max-w-4xl px-4 py-6 sm:py-9">
        <FadeIn>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent-600">SECAI / DAILY</p>
          <div className="mt-2 border-b-2 border-ink-900 pb-5">
            <div>
              <h1 className="font-display text-[clamp(32px,7vw,54px)] leading-[0.95] tracking-[-0.035em] text-ink-900">
                安全与 <span className="text-accent-600">AI 日报</span>
              </h1>
              <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-ink-500">
                内容由安智前沿提供。本站展示日报摘要、来源与原文入口；{IS_STATIC_EXPORT ? '静态预览为构建时快照。' : '每天 08:05 后更新（北京时间）。'}
              </p>
            </div>
          </div>
        </FadeIn>

        {report ? (
          <article className="mt-6">
            <FadeIn className="border-2 border-ink-900 bg-paper p-4 shadow-elevation-2 sm:p-6" delay={0.05}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-ink-500">
                <time dateTime={report.date} className="tnum">{formatDate(report.date)}</time>
                <span className="tnum">本期 {itemCount} 条</span>
              </div>
              {report.lead && (
                <>
                  <h2 className="mt-4 text-[22px] font-bold leading-snug text-ink-900 sm:text-[26px]">{report.lead.title}</h2>
                  <p className="mt-3 text-sm leading-relaxed text-ink-600">{report.lead.leadParagraph}</p>
                </>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-ink-200 pt-3 text-[11px] font-semibold text-ink-500">
                <span>内容：安智前沿</span>
                <span>更新：{formatGeneratedAt(report.generatedAt)}</span>
                <a href={reportUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-accent-600 underline underline-offset-4">安智前沿原页</a>
              </div>
            </FadeIn>

            {report.sections.map((section, sectionIndex) => (
              <section key={`${section.label}-${sectionIndex}`} className="mt-8" aria-labelledby={`daily-section-${sectionIndex}`}>
                <div className="mb-3 flex items-baseline justify-between gap-3 border-b-2 border-ink-900 pb-2">
                  <h2 id={`daily-section-${sectionIndex}`} className="font-display text-[20px] leading-none text-ink-900">{section.label}</h2>
                  <span className="tnum text-[11px] font-bold text-ink-500">{section.items.length} 条</span>
                </div>
                <ol className="grid gap-2.5">
                  {section.items.map((item, itemIndex) => (
                    <NewsItem key={`${item.title}-${itemIndex}`} item={item} index={itemIndex} />
                  ))}
                </ol>
              </section>
            ))}

            {report.flashes.length > 0 && (
              <section className="mt-8" aria-labelledby="daily-flashes">
                <h2 id="daily-flashes" className="mb-3 border-b-2 border-ink-900 pb-2 font-display text-[20px] text-ink-900">快讯</h2>
                <ul className="grid gap-2">
                  {report.flashes.map((flash, index) => {
                    const original = safeExternalUrl(flash.links.original);
                    return (
                      <li key={`${flash.title}-${index}`} className="border-l-[3px] border-accent-600 bg-paper py-2 pl-3">
                        <p className="text-sm font-bold text-ink-900">{flash.title}</p>
                        <p className="mt-1 text-[11px] font-semibold text-ink-500">
                          {flash.source.name}
                          {original && <> · <a href={original} target="_blank" rel="noopener noreferrer" className="text-accent-600 underline">阅读原文</a></>}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </article>
        ) : (
          <div role="status" className="mt-6 border-2 border-dashed border-ink-300 px-5 py-16 text-center">
            <h2 className="font-display text-[24px] text-ink-900">{failed ? '日报暂时无法加载' : '本期日报暂无内容'}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-500">
              {failed ? '可能是网络或上游服务暂时不可用。你仍可以前往安智前沿阅读，或稍后刷新本站重试。' : '可以稍后刷新，或前往安智前沿查看其他内容。'}
            </p>
            <a href={NEWS_HOME_URL} target="_blank" rel="noopener noreferrer" className="btn-primary mt-5 min-h-11">前往安智前沿<span aria-hidden="true">↗</span></a>
          </div>
        )}
      </main>

      <footer className="mt-8 border-t-2 border-ink-900 px-4 py-6 text-center text-[11px] leading-relaxed text-ink-500">
        <p>日报内容来自安智前沿 · 新闻原文版权归原作者所有</p>
        <Link href={HOME_PAGE_HREF} className="mt-2 inline-flex min-h-11 items-center font-bold text-accent-600 underline underline-offset-4">返回菜品评价</Link>
      </footer>
    </div>
  );
}
