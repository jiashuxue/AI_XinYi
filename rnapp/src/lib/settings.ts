import { supabase } from '@/lib/supabase';

/**
 * 确保该用户已有一行默认设置（T06）。
 * 用 upsert 只插入 user_id，其余字段走数据库默认值（提前 3 天 / 祝福 3 条 / 平台「淘宝」/ 提醒开）；
 * 已有行则不动，不覆盖用户之后的修改。
 */
export async function ensureSettings(userId: string): Promise<void> {
  await supabase.from('settings').upsert({ user_id: userId }, { onConflict: 'user_id' });
}
