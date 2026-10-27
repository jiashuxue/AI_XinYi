import { Contact, ContactDate } from '@/hooks/contacts';
import { ensureFestivalKits } from '@/hooks/festival-kits';
import { generateKit } from '@/hooks/kits';
import { Settings } from '@/hooks/settings';
import { dateTypeLabel, nextOccurrence } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import { GenerateKitInput, Kit } from '@/types/kit';

/**
 * 预生成与缓存（M6 T26，plan.md 1.4 / 1.5 决策 #8）：
 * - 进入 App 时对未来 remind_days 天内到期项调用 generate-kit 预生成写入 kits，
 *   保证「提醒出现时整套心意已备好、点开即见」；
 * - 已缓存的直接跳过（控 AI 成本，kits 唯一索引去重）；
 * - `ensureKitForScene` 供 kit 页点开时按需补生成（D2 接入点）。
 */

/** 查某联系人某场景（date_id / festival_id）是否已有 kit */
async function kitByScene(
  contactId: string,
  scene: { date_id?: string; festival_id?: number },
): Promise<Kit | null> {
  let q = supabase.from('kits').select('*').eq('contact_id', contactId);
  if (scene.date_id) q = q.eq('date_id', scene.date_id);
  if (scene.festival_id) q = q.eq('festival_id', scene.festival_id);
  const { data } = await q.maybeSingle();
  return (data as Kit) ?? null;
}

/** 组装 generate-kit 请求体（契约见 src/types/kit.ts） */
function kitInput(
  contact: Contact,
  occasion: { date_id?: string; festival_id?: number; occasion_name: string },
  blessingCount: number,
): GenerateKitInput {
  return {
    contact: {
      id: contact.id,
      name: contact.name,
      relation: contact.relation,
      features: contact.features,
    },
    occasion,
    blessing_count: blessingCount,
  };
}

/**
 * 按需补生成（D2 kit 页点开时调用）：
 * 该联系人该场景已有 kit 直接返回；否则调用 generate-kit 生成后返回。
 * 返回 null 表示生成失败（调用方给出提示）。
 */
export async function ensureKitForScene(
  contact: Contact,
  scene: { date_id?: string; festival_id?: number; occasion_name: string },
  settings: Pick<Settings, 'blessing_count'>,
): Promise<Kit | null> {
  const existing = await kitByScene(contact.id, scene);
  if (existing) return existing;
  const { kit } = await generateKit(kitInput(contact, scene, settings.blessing_count));
  return kit;
}

/** 预生成统计 */
export type PregenStats = { generated: number; skipped: number; failed: number };

/**
 * 进入 App 时预生成（T26）：扫描未来 remind_days 天内到期项（联系人日期 + 节日），
 * 对未生成过的调用 generate-kit；已缓存的跳过；单个失败不中断整体流程。
 * - 联系人日期：生日 / 纪念日，occasion_name = 生日 / 纪念日；
 * - 节日：公历节日对所有联系人、农历节日仅关系「家人」（spec 6/8）。
 * 说明：预生成不受提醒总开关限制（kits 供查看用，不单为系统通知）。
 */
export async function preGenerateKits(
  contacts: Contact[],
  dates: ContactDate[],
  settings: Settings,
  today = new Date(),
): Promise<PregenStats> {
  const stats: PregenStats = { generated: 0, skipped: 0, failed: 0 };
  const contactById = new Map(contacts.map((c) => [c.id, c]));

  // 1. 联系人日期
  for (const d of dates) {
    const contact = contactById.get(d.contact_id);
    if (!contact) continue;
    const occ = nextOccurrence(d, today);
    if (occ.inDays > settings.remind_days) continue;
    const scene = { date_id: d.id, occasion_name: dateTypeLabel(d.date_type) };
    try {
      const existing = await kitByScene(contact.id, scene);
      if (existing) {
        stats.skipped++;
        continue;
      }
      await generateKit(kitInput(contact, scene, settings.blessing_count));
      stats.generated++;
    } catch (e) {
      console.warn('预生成联系人心意失败：', (e as Error).message);
      stats.failed++;
    }
  }

  // 2. 节日（复用 T24 的 ensureFestivalKits：公历全联系人、农历仅家人、已缓存跳过、失败不中断）
  try {
    const festStats = await ensureFestivalKits(contacts, settings);
    stats.generated += festStats.generated;
    stats.skipped += festStats.skipped;
    stats.failed += festStats.failed;
  } catch (e) {
    console.warn('预生成节日心意失败：', (e as Error).message);
    stats.failed++;
  }

  return stats;
}
