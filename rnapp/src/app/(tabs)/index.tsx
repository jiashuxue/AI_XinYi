import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useContacts, Contact, ContactDate } from '@/hooks/contacts';
import { useKits } from '@/hooks/kits';
import { useSettings } from '@/hooks/settings';
import { TodayKitItem, useTodayKits } from '@/hooks/today-kits';
import { dateTypeLabel, formatMonthDay, nextOccurrence } from '@/lib/dates';
import { festivalNextOccurrence, useFestivals } from '@/lib/festivals';
import { Festival } from '@/types/festival';
import { Kit } from '@/types/kit';
import { cardShadow, colors, fonts, pagePadding, radius } from '@/theme';

/**
 * 今日（主页）—— T16 / T22 / T27：
 * 顶部问候 hero + 首页通知条 + 「今日心意」聚合（真实整套心意，kit 未备时「正在准备」占位）
 * + 未来 30 天列表（联系人日期 + 内置节日）；各入口统一经深链进入整套心意页并携带场景参数。
 */
export default function TodayScreen() {
  const { data } = useContacts();
  const { data: settings } = useSettings();
  const { data: festivals = [] } = useFestivals();
  const { data: allKits = [] } = useKits();
  const todayKits = useTodayKits();
  const remindDays = settings?.remind_days ?? 3;
  const blessingCount = settings?.blessing_count ?? 3;

  // 汇总全部联系人生日 / 纪念日的下一次到来，按日期排序（T16 既有）
  const items = useMemo(() => {
    if (!data) return [];
    const contactsById = new Map(data.contacts.map((c) => [c.id, c]));
    const out: UpcomingItem[] = [];
    for (const d of data.dates) {
      const contact = contactsById.get(d.contact_id);
      if (!contact) continue;
      const o = nextOccurrence(d);
      out.push({ key: d.id, contact, date: d, occur: o.date, inDays: o.inDays });
    }
    out.sort((a, b) => a.occur.getTime() - b.occur.getTime());
    return out;
  }, [data]);

  const todayCount = items.filter((i) => i.inDays === 0).length;
  const notice = items.filter((i) => i.inDays <= remindDays)[0]; // 首页通知条（最近一份）

  // T22：30 天内节日条目（公历 + 农历）。目标联系人 = 该节日已生成 kit 的联系人中最近一份，
  // 无则取最近录入的联系人；农历节日（relation_only='family'）仅面向「家人」，无家人联系人时跳过该节日
  // （spec 8：农历节日只针对家人，不回退非家人）。
  const festivalEntries = useMemo(() => {
    const contacts = data?.contacts ?? [];
    if (!contacts.length) return [];
    const contactsById = new Map(contacts.map((c) => [c.id, c]));
    const kitsByFestival = new Map<number, Kit[]>();
    for (const kit of allKits) {
      if (kit.festival_id == null) continue;
      const list = kitsByFestival.get(kit.festival_id) ?? [];
      list.push(kit);
      kitsByFestival.set(kit.festival_id, list);
    }
    const out: FestivalEntry[] = [];
    for (const festival of festivals) {
      const o = festivalNextOccurrence(festival);
      if (o.inDays > 30) continue;
      // 农历节日仅家人：无「家人」联系人则跳过，不回退非家人
      const isFamilyOnly = festival.relation_only === 'family';
      const eligiblePool = isFamilyOnly ? contacts.filter((c) => c.relation === '家人') : contacts;
      if (isFamilyOnly && eligiblePool.length === 0) continue;
      const candidates = (kitsByFestival.get(festival.id) ?? []).sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      );
      const targetKit = candidates[0];
      const kitContact = targetKit ? contactsById.get(targetKit.contact_id) : undefined;
      // 已有的 kit 联系人须符合该节日的适用范围，否则回退到符合条件池中最近的一位
      const targetContact =
        (kitContact && (!isFamilyOnly || kitContact.relation === '家人') ? kitContact : undefined) ||
        eligiblePool[eligiblePool.length - 1];
      out.push({
        festival,
        contact: targetContact,
        kit: targetKit ?? null,
        occur: o.date,
        inDays: o.inDays,
      });
    }
    out.sort((a, b) => a.occur.getTime() - b.occur.getTime());
    return out;
  }, [festivals, allKits, data]);

  // 30 天内列表 = 联系人日期项 + 节日项（T22），按日期排序
  const upcomingAll = useMemo(() => {
    const rows: UpcomingRowItem[] = [];
    for (const item of items) {
      if (item.inDays > 30) continue;
      rows.push({
        key: item.key,
        contact: item.contact,
        what: dateTypeLabel(item.date.date_type),
        occur: item.occur,
        inDays: item.inDays,
        scene: { date_id: item.date.id },
      });
    }
    for (const f of festivalEntries) {
      rows.push({
        key: `festival-${f.festival.id}`,
        contact: f.contact,
        what: f.festival.name,
        occur: f.occur,
        inDays: f.inDays,
        scene: { festival_id: f.festival.id },
      });
    }
    rows.sort((a, b) => a.occur.getTime() - b.occur.getTime());
    return rows;
  }, [items, festivalEntries]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 问候 */}
        <View style={styles.hero}>
          <View style={styles.stamp}>
            <Text style={styles.stampFace}>🌿</Text>
          </View>
          <View style={styles.heroText}>
            <Text style={styles.dateLine}>
              {new Date().getMonth() + 1}月{new Date().getDate()}日
            </Text>
            <Text style={styles.heroTitle}>
              {todayCount > 0 ? `早安，今天有 ${todayCount} 份心意\n替你备好了。` : '早安，日子都替你记着，\n到点心意自然来。'}
            </Text>
            <Text style={styles.heroSub}>记下的人越多，替你操的心就越多。</Text>
          </View>
        </View>

        {/* 首页通知条 */}
        {notice && (
          <Pressable
            style={styles.notice}
            onPress={() =>
              pushKit(notice.contact.id, { date_id: notice.date.id }, dateTypeLabel(notice.date.date_type))
            }
          >
            <Text style={styles.noticeBell}>🔔</Text>
            <Text style={styles.noticeText} numberOfLines={1}>
              {notice.contact.name} {formatMonthDay(notice.occur)} {dateTypeLabel(notice.date.date_type)}，整套心意已备好
            </Text>
            <Text style={styles.noticeArrow}>查看</Text>
          </Pressable>
        )}

        {/* 今日心意（T27：真实整套心意聚合；未生成项 T26 预生成会补齐） */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>今日心意</Text>
          <Text style={styles.sectionMore}>临近 {remindDays} 天，先替你想好</Text>
        </View>
        {todayKits.isLoading ? (
          <View style={styles.emptyNear}>
            <Text style={styles.emptyNearText}>正在准备心意…</Text>
          </View>
        ) : todayKits.isError ? (
          <View style={styles.emptyNear}>
            <Text style={styles.emptyNearText}>心意加载失败，稍后再来看看。</Text>
          </View>
        ) : todayKits.data.length === 0 ? (
          <View style={styles.emptyNear}>
            <Text style={styles.emptyNearText}>
              未来 {remindDays} 天内没有临近的日子，先到「在乎的人」记一位吧。
            </Text>
          </View>
        ) : (
          todayKits.data.map((item) => (
            <TodayKitCard key={item.key} item={item} blessingCount={blessingCount} />
          ))
        )}

        {/* 未来 30 天（联系人日期 + 内置节日，T22） */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>30 天内</Text>
          <Text style={styles.sectionMore}>都会提前替你想起</Text>
        </View>
        {upcomingAll.length === 0 ? (
          <View style={styles.emptyNear}>
            <Text style={styles.emptyNearText}>未来 30 天还没有特殊日子或节日。</Text>
          </View>
        ) : (
          <View style={styles.upcoming}>
            {upcomingAll.map((row) => (
              <UpcomingRow key={row.key} row={row} />
            ))}
          </View>
        )}

        <Text style={styles.footerNote}>把日子交给它，把心意留给自己</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

type UpcomingItem = {
  key: string;
  contact: Contact;
  date: ContactDate;
  occur: Date;
  inDays: number;
};

/** T22：30 天内节日条目（含目标联系人，点开进该节日的整套心意页） */
type FestivalEntry = {
  festival: Festival;
  contact: Contact;
  kit: Kit | null;
  occur: Date;
  inDays: number;
};

/** 30 天内列表统一行（日期项 / 节日项） */
type UpcomingRowItem = {
  key: string;
  contact: Contact;
  what: string;
  occur: Date;
  inDays: number;
  scene: { date_id?: string; festival_id?: number };
};

/** 进整套心意页（带 scene query：dateId / festivalId + occasion，供 kit 页定位场景） */
function pushKit(
  contactId: string,
  scene: { date_id?: string; festival_id?: number },
  occasion: string,
) {
  router.push({
    pathname: '/kit/[id]',
    params: {
      id: contactId,
      ...(scene.date_id ? { dateId: scene.date_id } : {}),
      ...(scene.festival_id ? { festivalId: String(scene.festival_id) } : {}),
      occasion,
    },
  });
}

/** 今日心意 —— 一封待拆的信封（T27：真实整套心意数据；未生成时占位，T26 预生成补齐） */
function TodayKitCard({ item, blessingCount }: { item: TodayKitItem; blessingCount: number }) {
  const { contact, occasion_name, kit, inDays, occur } = item;
  return (
    <Pressable style={styles.envelope} onPress={() => pushKit(contact.id, item.scene, occasion_name)}>
      <View style={styles.envelopeTop}>
        <Text style={styles.envelopeWho}>致 一位在乎的人</Text>
        {contact.relation && (
          <View style={styles.envelopeTag}>
            <Text style={styles.envelopeTagText}>{contact.relation}</Text>
          </View>
        )}
      </View>
      <View style={styles.envelopeBody}>
        <View style={styles.envelopeRow}>
          <View>
            <Text style={styles.envelopeName}>{contact.name}</Text>
            <Text style={styles.envelopeOccasion}>
              {occasion_name} · {formatMonthDay(occur)}
            </Text>
          </View>
          <Text style={styles.envelopeDay}>
            {inDays === 0 ? '今天' : `距 ${inDays} 天`}
            {'\n'}
            <Text style={styles.envelopeDaySmall}>{kit ? '已备好' : '正在准备'}</Text>
          </Text>
        </View>
        {kit ? (
          <Text style={styles.envelopePreview}>
            <Text style={styles.envelopePreviewB}>心意已装进信封</Text>：
            {kit.blessings.length || blessingCount} 条祝福 · {kit.gift_suggestions.length || 3} 个礼物点子 · 1 张贺卡，点开就能送出去。
          </Text>
        ) : (
          <Text style={styles.envelopePreview}>
            <Text style={styles.envelopePreviewB}>心意正在准备</Text>：下次打开 App 会自动替你备好，也可以点开立即生成。
          </Text>
        )}
      </View>
    </Pressable>
  );
}

/** 30 天内列表行（联系人日期 / 节日） */
function UpcomingRow({ row }: { row: UpcomingRowItem }) {
  const { contact, what, occur, inDays, scene } = row;
  return (
    <Pressable style={styles.upRow} onPress={() => pushKit(contact.id, scene, what)}>
      <View style={styles.mono}>
        <Text style={styles.monoDay}>{occur.getDate()}</Text>
        <Text style={styles.monoMonth}>{occur.getMonth() + 1}月</Text>
      </View>
      <View style={styles.upBody}>
        <Text style={styles.upWho}>{contact.name}</Text>
        <Text style={styles.upWhat}>{what}</Text>
      </View>
      <Text style={styles.upDays}>
        <Text style={styles.upDaysB}>{inDays}</Text> 天
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.paper,
    paddingHorizontal: pagePadding,
  },
  content: {
    paddingBottom: 26,
  },
  hero: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: 16,
    paddingHorizontal: 15,
    ...cardShadow,
  },
  stamp: {
    width: 46,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.gold,
    borderRadius: 2,
    backgroundColor: colors.card,
    transform: [{ rotate: '2deg' }],
  },
  stampFace: {
    fontSize: 20,
  },
  heroText: {
    flex: 1,
  },
  dateLine: {
    fontSize: 12.5,
    color: colors.inkSoft,
    marginBottom: 6,
    letterSpacing: 2,
  },
  heroTitle: {
    fontSize: 22,
    lineHeight: 33,
    fontWeight: '500',
    letterSpacing: 1,
    color: colors.ink,
  },
  heroSub: {
    fontSize: 13.5,
    lineHeight: 22,
    color: colors.ink,
    marginTop: 10,
  },
  notice: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.moss,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  noticeBell: {
    fontSize: 16,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    color: colors.onMoss,
  },
  noticeArrow: {
    fontSize: 12,
    color: colors.goldSoft,
  },
  sectionHead: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: fonts.kai,
    fontSize: 20,
    letterSpacing: 2,
    color: colors.ink,
  },
  sectionMore: {
    fontSize: 12,
    color: colors.inkSoft,
  },
  envelope: {
    marginBottom: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...cardShadow,
  },
  envelopeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.card2,
  },
  envelopeWho: {
    fontFamily: fonts.kai,
    fontSize: 13.5,
    letterSpacing: 1,
    color: colors.inkSoft,
  },
  envelopeTag: {
    marginLeft: 'auto',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: colors.card,
  },
  envelopeTagText: {
    fontSize: 10.5,
    color: colors.inkSoft,
  },
  envelopeBody: {
    padding: 16,
  },
  envelopeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  envelopeName: {
    fontFamily: fonts.kai,
    fontSize: 26,
    fontWeight: '500',
    letterSpacing: 2,
    color: colors.ink,
  },
  envelopeOccasion: {
    fontSize: 13.5,
    color: colors.inkSoft,
    marginTop: 4,
  },
  envelopeDay: {
    fontFamily: fonts.kai,
    fontSize: 16,
    color: colors.moss,
    textAlign: 'right',
    lineHeight: 22,
  },
  envelopeDaySmall: {
    fontFamily: fonts.kai,
    fontSize: 11,
    color: colors.inkSoft,
  },
  envelopePreview: {
    marginTop: 13,
    fontSize: 13.5,
    lineHeight: 22,
    color: colors.inkSoft,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 11,
  },
  envelopePreviewB: {
    color: colors.ink,
    fontWeight: '600',
  },
  upcoming: {
    marginTop: 4,
  },
  upRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  mono: {
    width: 44,
    height: 46,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monoDay: {
    fontFamily: fonts.kai,
    fontSize: 15,
    lineHeight: 17,
    color: colors.moss,
  },
  monoMonth: {
    fontSize: 10,
    color: colors.inkSoft,
  },
  upBody: {
    flex: 1,
  },
  upWho: {
    fontFamily: fonts.kai,
    fontSize: 16,
    letterSpacing: 1,
    color: colors.ink,
  },
  upWhat: {
    fontSize: 12.5,
    color: colors.inkSoft,
    marginTop: 2,
  },
  upDays: {
    fontSize: 12,
    color: colors.inkSoft,
  },
  upDaysB: {
    fontFamily: fonts.kai,
    fontSize: 16,
    color: colors.moss,
  },
  emptyNear: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    padding: 18,
  },
  emptyNearText: {
    fontSize: 13,
    lineHeight: 21,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  footerNote: {
    marginTop: 26,
    textAlign: 'center',
    fontSize: 12.5,
    color: colors.gold,
    letterSpacing: 3,
  },
});
