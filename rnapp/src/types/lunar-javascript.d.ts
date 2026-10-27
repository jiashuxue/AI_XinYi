/**
 * lunar-javascript 未附带类型声明，这里补充最小类型定义（仅本项目用到的 API）。
 */
declare module 'lunar-javascript' {
  export class Solar {
    getYear(): number;
    getMonth(): number;
    getDay(): number;
  }
  export class Lunar {
    static fromYmd(year: number, month: number, day: number): Lunar;
    getSolar(): Solar;
    getMonthInChinese(): string;
    getDayInChinese(): string;
  }
  export class LunarYear {
    static fromYear(year: number): LunarYear;
    getLeapMonth(): number;
  }
}
