import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { Festival } from '@/types/festival';
import { lunarToSolar } from '@/lib/lunar';

/**
 * 节日体系（T22，spec 6 / 8）：
 * - 前端读取 festivals（10 公历 + 5 农历）；
 * - 浮动日期计算（母亲节 = 5 月第 2 个周日、父亲节 = 6 月第 3 个周日、感恩节 = 11 月第 4 个周四）；
 * - 农历节日换算当年公历（lunar-javascript，闰月以当年实际对应日为准）。
 * 仅供内置节日使用，第一版不可自定义增删。
 */

function startOfToday(base = new Date()): Date {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** 读取全部内置节日（festivals 表公开读，RLS 允许）；用于 hooks 场景 */
export function useFestivals() {
  return useQuery({
    queryKey: ['festivals'],
    queryFn: async (): Promise<Festival[]> => {
      const { data } = await supabase.from('festivals').select('*').order('id');
      return data ?? [];
    },
  });
}

/** 读取全部内置节日（非 hooks 场景，如通知调度 / 预生成扫描时直接调用） */
export async function fetchFestivals(): Promise<Festival[]> {
  const { data } = await supabase.from('festivals').select('*').order('id');
  return data ?? [];
}

/**
 * 计算某个节日下一次到来（返回公历日期与距今天数），今年已过则从明年起算。
 * - fixed + solar：当年固定月日；已过 → 次年。
 * - fixed + lunar：农历换算当年公历（lunarToSolar）；已过 → 换算次年。
 * - nth_weekday：当年第 occurrence 个 weekday（weekday 0=周日）；已过 → 次年。
 */
export function festivalNextOccurrence(
  festival: Festival,
  today = new Date(),
): { date: Date; inDays: number } {
  const year = today.getFullYear();
  const now = startOfToday(today);
  const month = festival.month;

  let candidate: Date;

  if (festival.rule === 'fixed') {
    if (festival.calendar === 'lunar') {
      const solar = lunarToSolar(month, festival.day!, year);
      candidate = new Date(year, solar.month - 1, solar.day);
      if (candidate < now) {
        const nextSolar = lunarToSolar(month, festival.day!, year + 1);
        candidate = new Date(year + 1, nextSolar.month - 1, nextSolar.day);
      }
    } else {
      candidate = new Date(year, month - 1, festival.day!);
      if (candidate < now) candidate = new Date(year + 1, month - 1, festival.day!);
    }
  } else {
    // nth_weekday：当年第 occurrence 个 weekday
    const firstWeekday = new Date(year, month - 1, 1).getDay(); // 0=周日 … 6=周六
    const offset = (festival.weekday! - firstWeekday + 7) % 7;
    const day = 1 + offset + (festival.occurrence! - 1) * 7;
    candidate = new Date(year, month - 1, day);
    if (candidate < now) {
      const nextFirstWeekday = new Date(year + 1, month - 1, 1).getDay();
      const nextOffset = (festival.weekday! - nextFirstWeekday + 7) % 7;
      const nextDay = 1 + nextOffset + (festival.occurrence! - 1) * 7;
      candidate = new Date(year + 1, month - 1, nextDay);
    }
  }

  const inDays = Math.round((candidate.getTime() - now.getTime()) / 86_400_000);
  return { date: candidate, inDays };
}
