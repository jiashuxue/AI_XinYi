import { generateKit } from '@/hooks/kits';
import { Contact } from '@/hooks/contacts';
import { Settings } from '@/hooks/settings';
import { queryClient } from '@/lib/query';
import { supabase } from '@/lib/supabase';
import { Kit } from '@/types/kit';

/**
 * 祝福条数变更重生成（M6 T28，spec 9）：
 * 设置中 blessing_count（1~5）变化后，对该用户已存在的全部 kits 重新调用
 * generate-kit，使每条心意的祝福条数匹配新条数；previous_batch 传现有祝福避免重复。
 * 单条失败不中断，返回统计。
 */

export type RegenResult = {
  /** 本次扫描到的 kit 总数 */
  total: number;
  /** 成功重新生成的条数 */
  ok: number;
  /** 失败的条数 */
  failed: number;
};

/** 按新祝福条数重生成全部已有 kits；完成后刷新 ['kits'] 缓存供各页展示 */
export async function regenerateKitsForCount(
  settings: Pick<Settings, 'blessing_count'>,
): Promise<RegenResult> {
  const [{ data: kitsData }, { data: contactsData }] = await Promise.all([
    supabase.from('kits').select('*'),
    supabase.from('contacts').select('*'),
  ]);
  const kits = (kitsData ?? []) as Kit[];
  const contactsById = new Map((contactsData ?? []).map((c: Contact) => [c.id, c]));

  let ok = 0;
  let failed = 0;

  for (const kit of kits) {
    const contact = contactsById.get(kit.contact_id);
    if (!contact) continue; // 联系人已删（kits 级联删除，理论不存在）
    try {
      await generateKit({
        contact: {
          id: contact.id,
          name: contact.name,
          relation: contact.relation,
          features: contact.features,
        },
        occasion: {
          date_id: kit.date_id ?? undefined,
          festival_id: kit.festival_id ?? undefined,
          occasion_name: kit.occasion_name,
        },
        blessing_count: settings.blessing_count,
        previous_batch: kit.blessings, // 避免与旧批重复（spec 9）
      });
      ok++;
    } catch {
      failed++;
    }
  }

  queryClient.invalidateQueries({ queryKey: ['kits'] });
  return { total: kits.length, ok, failed };
}
