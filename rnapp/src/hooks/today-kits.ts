import { useMemo } from 'react';

import { useContacts, Contact, ContactDate } from '@/hooks/contacts';
import { useKits } from '@/hooks/kits';
import { useSettings } from '@/hooks/settings';
import { dateTypeLabel, nextOccurrence } from '@/lib/dates';
import { festivalNextOccurrence, useFestivals } from '@/lib/festivals';
import { Festival } from '@/types/festival';
import { Kit } from '@/types/kit';

/**
 * 今日心意聚合（M6 T27，spec 7）：
 * 「近 remind_days 天触发提醒的所有联系人整套心意」——口径对齐主页 index.tsx 的
 * nearItems（inDays <= remind_days）：联系人日期（生日/纪念日）+ 节日均纳入；
 * 公历节日对所有联系人、农历节日仅对关系「家人」的联系人（spec 6/8）。
 * 返回项含对应 scene 的 kit（可能为 null，供页面展示「正在准备」占位，预生成会补齐）。
 */

/** 今日心意列表单项 */
export type TodayKitItem = {
  key: string;
  contact: Contact;
  /** 场景名：生日 / 纪念日 / 节日名（贺卡「日期名称」） */
  occasion_name: string;
  /** 场景定位参数（进 kit 页用：/kit/[contactId]?scene） */
  scene: { date_id?: string; festival_id?: number };
  /** 对应 scene 的整套心意；未生成时为 null（T26 预生成会在打开 App 时补齐） */
  kit: Kit | null;
  /** 距今天数 */
  inDays: number;
  /** 本次到来的公历日期 */
  occur: Date;
};

/** 组装今日心意项（纯函数，便于复用 / 核对口径） */
export function buildTodayItems(
  contactsData: { contacts: Contact[]; dates: ContactDate[] } | undefined,
  festivals: Festival[],
  kits: Kit[],
  remindDays: number,
): TodayKitItem[] {
  const contactsById = new Map((contactsData?.contacts ?? []).map((c) => [c.id, c]));
  const kitsByContact = new Map<string, Kit[]>();
  for (const kit of kits) {
    const list = kitsByContact.get(kit.contact_id) ?? [];
    list.push(kit);
    kitsByContact.set(kit.contact_id, list);
  }

  const items: TodayKitItem[] = [];

  // 联系人日期（生日 / 纪念日）：距 remind_days 天内
  for (const d of contactsData?.dates ?? []) {
    const contact = contactsById.get(d.contact_id);
    if (!contact) continue;
    const o = nextOccurrence(d);
    if (o.inDays > remindDays) continue;
    const kit = (kitsByContact.get(contact.id) ?? []).find((k) => k.date_id === d.id) ?? null;
    items.push({
      key: d.id,
      contact,
      occasion_name: dateTypeLabel(d.date_type),
      scene: { date_id: d.id },
      kit,
      inDays: o.inDays,
      occur: o.date,
    });
  }

  // 节日：公历对所有联系人、农历仅对关系「家人」的联系人（spec 6/8）
  for (const festival of festivals) {
    const eligible = (contactsData?.contacts ?? []).filter((c) => {
      if (!festival.relation_only) return true;
      return c.relation === '家人';
    });
    for (const contact of eligible) {
      const o = festivalNextOccurrence(festival);
      if (o.inDays > remindDays) continue;
      const kit =
        (kitsByContact.get(contact.id) ?? []).find((k) => k.festival_id === festival.id) ?? null;
      items.push({
        key: `${festival.id}-${contact.id}`,
        contact,
        occasion_name: festival.name,
        scene: { festival_id: festival.id },
        kit,
        inDays: o.inDays,
        occur: o.date,
      });
    }
  }

  items.sort((a, b) => a.occur.getTime() - b.occur.getTime());
  return items;
}

/**
 * 今日心意聚合查询（M6 T27，供主页「今日心意」区块渲染）。
 * 组合 contacts / festivals / kits / settings 四个数据源；loading / error 状态一并暴露。
 */
export function useTodayKits() {
  const contactsQ = useContacts();
  const festivalsQ = useFestivals();
  const kitsQ = useKits();
  const settingsQ = useSettings();

  const remindDays = settingsQ.data?.remind_days ?? 3;

  const data = useMemo(
    () => buildTodayItems(contactsQ.data, festivalsQ.data ?? [], kitsQ.data ?? [], remindDays),
    [contactsQ.data, festivalsQ.data, kitsQ.data, remindDays],
  );

  return {
    data,
    isLoading:
      contactsQ.isLoading || festivalsQ.isLoading || kitsQ.isLoading || settingsQ.isLoading,
    isError: !!(contactsQ.isError || festivalsQ.isError || kitsQ.isError || settingsQ.isError),
    error: contactsQ.error ?? festivalsQ.error ?? kitsQ.error ?? settingsQ.error ?? null,
  };
}
