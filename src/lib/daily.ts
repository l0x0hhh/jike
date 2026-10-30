import 'server-only';
import type { DailyReport } from './news';

const DAILY_API_URL = 'https://8.134.143.179/api/v1/dailies/latest';
const DAY_SECONDS = 86400;
const DAILY_REFRESH_SECONDS = 8 * 3600 + 5 * 60;

/** 距下一个北京时间 08:05 的秒数；无访问时不会因此产生上游请求。 */
function secondsUntilNextDailyRefresh(now = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const elapsed = Number(values.hour) * 3600 + Number(values.minute) * 60 + Number(values.second);
  const remaining = DAILY_REFRESH_SECONDS - elapsed;
  return remaining > 0 ? Math.ceil(remaining) : DAY_SECONDS + Math.ceil(remaining);
}

interface DailyResponse {
  schemaVersion: 1;
  report: DailyReport;
}

export interface DailyResult {
  report: DailyReport | null;
  failed: boolean;
}

/** 服务端读取结构化日报；文本由 React 转义，第三方 HTML 不进入本站 DOM。 */
export async function getLatestDaily(): Promise<DailyResult> {
  try {
    const response = await fetch(DAILY_API_URL, {
      headers: { Accept: 'application/json' },
      next: { revalidate: secondsUntilNextDailyRefresh() },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`日报接口返回 ${response.status}`);

    const payload = await response.json() as Partial<DailyResponse>;
    if (payload.schemaVersion !== 1 || !payload.report || !Array.isArray(payload.report.sections)) {
      throw new Error('日报接口数据结构不符合预期');
    }
    return { report: payload.report, failed: false };
  } catch (error) {
    console.error('[daily] 获取安智前沿日报失败', error);
    return { report: null, failed: true };
  }
}
