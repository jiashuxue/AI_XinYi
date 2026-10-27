import { lunarToSolar } from '@/lib/lunar';

/** 特殊日期在表单 / 数据层的统一描述（对应 dates 表） */
export type DateMeta = {
  date_type: 'birthday' | 'anniversary';
  calendar: 'solar' | 'lunar';
  month: number;
  day: number;
};

function startOfToday(base = new Date()): Date {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * 计算某个特殊日期下一次到来（公历固定月日 / 农历换算当年公历），
 * 今年已过则从明年起算（农历明年需重新换算，plan.md 1.5）。
 * 返回公历日期与距今天数。
 */
export function nextOccurrence(
  date: DateMeta,
  today = new Date(),
): { date: Date; inDays: number } {
  const year = today.getFullYear();
  const now = startOfToday(today);

  let solar =
    date.calendar === 'lunar'
      ? lunarToSolar(date.month, date.day, year)
      : { month: date.month, day: date.day };
  let candidate = new Date(year, solar.month - 1, solar.day);

  if (candidate < now) {
    if (date.calendar === 'lunar') {
      solar = lunarToSolar(date.month, date.day, year + 1);
      candidate = new Date(year + 1, solar.month - 1, solar.day);
    } else {
      candidate = new Date(year + 1, date.month - 1, date.day);
    }
  }

  const inDays = Math.round((candidate.getTime() - now.getTime()) / 86_400_000);
  return { date: candidate, inDays };
}

/** 在一组日期中取「下一次到来」最近的一次 */
export function nearestDate(
  dates: DateMeta[],
  today = new Date(),
): { meta: DateMeta; date: Date; inDays: number } | null {
  if (!dates.length) return null;
  let best: { meta: DateMeta; date: Date; inDays: number } | null = null;
  for (const meta of dates) {
    const o = nextOccurrence(meta, today);
    if (!best || o.date < best.date) best = { meta, ...o };
  }
  return best;
}

/** 公历 Date → "10月28日" 文本 */
export function formatMonthDay(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

/** 日期类型 → 展示标签（贺卡日期名称 / 列表用途） */
export function dateTypeLabel(date_type: 'birthday' | 'anniversary'): string {
  return date_type === 'birthday' ? '生日' : '纪念日';
}
