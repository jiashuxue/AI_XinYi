/**
 * 内置节日（festivals 表）类型，对应 data-model.md 2.4。
 * 第一版仅内置 15 条（公历 10 + 农历 5），公开读、不可自定义增删。
 */

export type Festival = {
  id: number;
  name: string;
  /** solar（公历）/ lunar（农历） */
  calendar: 'solar' | 'lunar';
  /** fixed（固定月日）/ nth_weekday（第 N 个星期几：母亲节、父亲节、感恩节） */
  rule: 'fixed' | 'nth_weekday';
  month: number;
  /** 仅 fixed 规则使用 */
  day: number | null;
  /** 星期几（0=周日 … 6=周六），仅 nth_weekday 规则使用 */
  weekday: number | null;
  /** 第几个星期几，仅 nth_weekday 规则使用 */
  occurrence: number | null;
  /** family：农历节日仅对关系为「家人」的联系人；公历节日为 null（spec 8） */
  relation_only: 'family' | null;
};
