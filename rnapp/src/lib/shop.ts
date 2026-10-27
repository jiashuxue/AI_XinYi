import { PLATFORMS } from '@/hooks/settings';

/**
 * 电商平台搜索链接（T21，spec 12）：
 * 按默认电商平台拼「去看看」跳转的搜索结果页 URL；平台名与 settings 的 PLATFORMS 一致。
 */

/** 平台 → 搜索结果页 URL 模板（%s 为编码后的关键词） */
const SEARCH_URLS: Record<string, (keyword: string) => string> = {
  淘宝: (k) => `https://s.taobao.com/search?q=${k}`,
  京东: (k) => `https://search.jd.com/Search?keyword=${k}&enc=utf-8`,
  拼多多: (k) => `https://mobile.yangkeduo.com/search_result.html?search_key=${k}`,
  抖音电商: (k) => `https://haohuo.jinritemai.com/views/shop/search?search_keyword=${k}`,
};

/** 平台名是否在预设列表中（spec 12：可随时切换的平台） */
export function isKnownPlatform(platform: string): boolean {
  return (PLATFORMS as readonly string[]).includes(platform);
}

/**
 * 返回所选平台的搜索结果页 URL；平台不在预设列表时返回 null（调用方提示切换平台）。
 * keyword 会做 encodeURIComponent，保证中文关键词在 URL 中不丢失。
 */
export function shopSearchUrl(platform: string, keyword: string): string | null {
  const build = SEARCH_URLS[platform];
  if (!build) return null;
  return build(encodeURIComponent(keyword));
}
