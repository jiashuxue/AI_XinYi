import { Lunar, LunarYear } from 'lunar-javascript';

/**
 * 农历换算工具（T10，plan.md 技术栈 lunar-javascript）。
 */

/** 农历月/日 → 某年对应的公历月/日；遇闰月按当年实际对应日换算（T10 / spec 8 验收）。 */
export function lunarToSolar(
  lunarMonth: number,
  lunarDay: number,
  solarYear: number,
): { month: number; day: number } {
  // 当年若有闰月且恰好是用户所填的月，则按闰月换算（lunar-javascript 用负数月表示闰月）
  const leapMonth = LunarYear.fromYear(solarYear).getLeapMonth();
  const month = leapMonth === lunarMonth ? -lunarMonth : lunarMonth;
  const solar = Lunar.fromYmd(solarYear, month, lunarDay).getSolar();
  return { month: solar.getMonth(), day: solar.getDay() };
}

/** 农历月/日是否在合法范围（月 1–12，日 1–30） */
export function isValidLunar(month: number, day: number): boolean {
  return month >= 1 && month <= 12 && day >= 1 && day <= 30;
}

/** 农历月/日 → 中文读法（如 8月15 → "八月十五"，供详情页显示） */
export function lunarChineseLabel(month: number, day: number): string {
  const lunar = Lunar.fromYmd(2000, month, day); // 取无闰月的参考年，仅用于中文读法
  return `${lunar.getMonthInChinese()}${lunar.getDayInChinese()}`;
}
