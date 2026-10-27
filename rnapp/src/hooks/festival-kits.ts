import { supabase } from '@/lib/supabase';
import { fetchFestivals, festivalNextOccurrence } from '@/lib/festivals';
import { generateKit } from '@/hooks/kits';
import { Contact } from '@/hooks/contacts';
import { Settings } from '@/hooks/settings';

/**
 * 节日整套心意生成（T24，spec 6 / 8，plan.md 五·M5）：
 * - 对未来 remind_days 天内到期的内置节日，为每个符合条件的联系人生成整套心意写入 kits；
 * - 公历节日 → 对所有已录入联系人；农历节日 → 仅对 relation='家人' 的联系人；
 * - 已缓存（kits 表已有该 festival + contact 行）跳过，不重复调用 AI（控成本）。
 *
 * 供进入 App / 预生成扫描调用（M5 T24 与 M6 T26 共用同一生成入口）。
 */

/** 单个联系人为单个节日生成的结果统计 */
export type FestivalKitStats = {
  generated: number; // 本次新生成成功
  skipped: number; // 已缓存跳过
  failed: number; // 生成失败
};

/** 是否对某联系人生成该节日的整套心意（公历对所有、农历仅家人） */
function isEligible(festival: { calendar: string; relation_only: string | null }, contact: Contact): boolean {
  if (festival.calendar === 'lunar') {
    return contact.relation === '家人'; // 农历节日仅家人（spec 8）
  }
  return true; // 公历节日对所有已录入联系人（spec 6）
}

/**
 * 对未来 remind_days 天内到期的节日，为所有符合条件的联系人生成整套心意。
 * 单次失败不中断整体流程；返回成功 / 跳过 / 失败统计。
 */
export async function ensureFestivalKits(
  contacts: Contact[],
  settings: Settings,
): Promise<FestivalKitStats> {
  const stats: FestivalKitStats = { generated: 0, skipped: 0, failed: 0 };
  if (!contacts.length) return stats;

  const festivals = await fetchFestivals();

  for (const festival of festivals) {
    const next = festivalNextOccurrence(festival);
    // 只处理未来 remind_days 天内到期（含今天）的节日
    if (next.inDays > settings.remind_days) continue;

    for (const contact of contacts) {
      if (!isEligible(festival, contact)) continue;

      // 已缓存跳过：kits 表已存在该 (contact_id, festival_id) 行（RLS 自动按当前用户隔离）
      const { data: existing } = await supabase
        .from('kits')
        .select('id')
        .eq('contact_id', contact.id)
        .eq('festival_id', festival.id)
        .maybeSingle();
      if (existing) {
        stats.skipped += 1;
        continue;
      }

      try {
        await generateKit({
          contact: {
            id: contact.id,
            name: contact.name,
            relation: contact.relation,
            features: contact.features,
          },
          occasion: { festival_id: festival.id, occasion_name: festival.name },
          blessing_count: settings.blessing_count,
        });
        stats.generated += 1;
      } catch {
        stats.failed += 1;
      }
    }
  }

  return stats;
}
