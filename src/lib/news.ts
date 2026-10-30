export const NEWS_HOME_URL = 'https://8.134.143.179/daily';
// 标准 Next 部署使用路由；双击 output: 'export' 文件时使用相对 HTML 地址。
export const NEWS_PAGE_HREF = process.env.NEXT_PUBLIC_STATIC_EXPORT === '1' ? './news.html' : '/news';
export const HOME_PAGE_HREF = process.env.NEXT_PUBLIC_STATIC_EXPORT === '1' ? './index.html' : '/';
export const IS_STATIC_EXPORT = process.env.NEXT_PUBLIC_STATIC_EXPORT === '1';

export interface DailyContentLinks {
  aihot: string | null;
  original: string;
}

export interface DailyContentItem {
  title: string;
  summary: string;
  source: { name: string };
  links: DailyContentLinks;
}

export interface DailySection {
  label: string;
  items: DailyContentItem[];
}

export interface DailyFlash {
  title: string;
  source: { name: string };
  links: DailyContentLinks;
  publishedAt: string;
}

export interface DailyReport {
  date: string;
  generatedAt: string;
  links: { aihot: string };
  lead: { title: string; leadParagraph: string } | null;
  sections: DailySection[];
  flashes: DailyFlash[];
}

/** 第三方链接只接受 HTTP(S)，其余协议不进入页面。 */
export function safeExternalUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}
