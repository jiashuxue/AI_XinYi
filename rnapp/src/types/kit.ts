/**
 * 整套心意（kits 表）相关类型，对应 data-model.md 2.5。
 * 同时定义调用 Edge Function generate-kit 的请求 / 响应契约（与 supabase/functions/generate-kit 保持一致）。
 */

/** 礼物建议（每条固定含搜索关键词，spec 11 / 12） */
export type GiftSuggestion = {
  title: string;
  keyword: string;
};

/** 整套心意（kits 表一行，预生成缓存） */
export type Kit = {
  id: string;
  user_id: string;
  contact_id: string;
  /** 关联 dates（生日 / 纪念日）；与 festival_id 至少一个非空 */
  date_id: string | null;
  /** 关联 festivals（节日）；与 date_id 至少一个非空 */
  festival_id: number | null;
  /** 贺卡「日期名称」：生日 / 纪念日 / 节日名（如「中秋节」） */
  occasion_name: string;
  /** 祝福文案数组，条数 = settings.blessing_count（1~5），互不重复、带称呼、不署名 */
  blessings: string[];
  /** 礼物建议数组，固定 3 条 */
  gift_suggestions: GiftSuggestion[];
  /** ready（齐全）/ partial（降级：某项未能生成，spec 7） */
  status: 'ready' | 'partial';
  /** 创建 / 更新时间（kits 表字段，data-model.md 2.5；主页取「该节日最近一份」排序用） */
  created_at: string;
  updated_at: string;
};

/** 调用 generate-kit 的请求契约（plan.md 1.4；与 Edge Function 严格一致） */
export type GenerateKitInput = {
  contact: {
    id: string;
    name: string;
    relation: string | null;
    features: string | null;
  };
  /** 场景：生日 / 纪念日关联 date_id，节日关联 festival_id，至少一个非空 */
  occasion: {
    date_id?: string | null;
    festival_id?: number | null;
    occasion_name: string;
  };
  /** 祝福条数（1~5，默认 3） */
  blessing_count: number;
  /** 「换一批」时携带旧批，要求新批次不与旧批重复 */
  previous_batch?: string[];
  /** 用户选择跳过补特征：礼物按关系给通用建议（spec 11） */
  skip_features?: boolean;
};

/** 调用 generate-kit 的响应契约 */
export type GenerateKitResult = {
  kit: Kit;
};
