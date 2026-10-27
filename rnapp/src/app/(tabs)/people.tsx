import { router } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useContacts, Contact, ContactDate } from '@/hooks/contacts';
import { nearestDate, dateTypeLabel } from '@/lib/dates';
import { colors, fonts, pagePadding, radius } from '@/theme';

/**
 * 在乎的人 —— 联系人列表（T08）：
 * 顶部「＋ 记一位」+「最多 10 位」提示；列表行 = 头像首字 / 姓名 / 关系·特征摘要 / 最近日子；
 * 空状态引导首启录入；点击行进入详情。
 */
export default function PeopleScreen() {
  const { data, isLoading } = useContacts();

  // 按联系人聚合日期，便于每行计算最近日子
  const datesByContact = useMemo(() => {
    const map = new Map<string, ContactDate[]>();
    for (const d of data?.dates ?? []) {
      const arr = map.get(d.contact_id) ?? [];
      arr.push(d);
      map.set(d.contact_id, arr);
    }
    return map;
  }, [data?.dates]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.moss} />
        </View>
      </SafeAreaView>
    );
  }

  const contacts = data?.contacts ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.top}>
        <Text style={styles.topTitle}>在乎的人</Text>
        <Pressable style={styles.addBtn} onPress={() => router.push('/person/new')} hitSlop={6}>
          <Text style={styles.addBtnText}>＋ 记一位</Text>
        </Pressable>
      </View>

      <View style={styles.hint}>
        <Text style={styles.hintK}>✦</Text>
        <Text style={styles.hintText}>最多 10 位。记下特征，心意才会贴着他本人写。</Text>
      </View>

      {contacts.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Text style={styles.emptyIconFace}>🫧</Text>
          </View>
          <Text style={styles.emptyTitle}>先记下第一位在乎的人吧</Text>
          <Text style={styles.emptyDesc}>
            生日、纪念日、农历生日都行；特征记得越细，心意才越像他本人。
          </Text>
          <Pressable style={styles.emptyBtn} onPress={() => router.push('/person/new')}>
            <Text style={styles.emptyBtnText}>＋ 记一位</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={Separator}
          renderItem={({ item }) => <PersonRow contact={item} dates={datesByContact.get(item.id) ?? []} />}
        />
      )}
    </SafeAreaView>
  );
}

function Separator() {
  return <View style={styles.sep} />;
}

function PersonRow({ contact, dates }: { contact: Contact; dates: ContactDate[] }) {
  const next = nearestDate(dates);
  const meta = [contact.relation, contact.features].filter(Boolean).join('，');

  return (
    <Pressable style={styles.row} onPress={() => router.push(`/person/${contact.id}`)}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{contact.name.slice(0, 1)}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowName}>{contact.name}</Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {meta || '还没记下任何特征'}
        </Text>
      </View>
      {next ? (
        <View style={styles.rowNext}>
          <Text style={styles.rowNextDate}>
            {next.date.getMonth() + 1}.{String(next.date.getDate()).padStart(2, '0')}
          </Text>
          <Text style={styles.rowNextTag}>{dateTypeLabel(next.meta.date_type)}</Text>
        </View>
      ) : (
        <View style={styles.rowNext}>
          <Text style={styles.rowNextEmpty}>待补</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.paper,
    paddingHorizontal: pagePadding,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  top: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topTitle: {
    fontFamily: fonts.kai,
    fontSize: 26,
    fontWeight: '500',
    letterSpacing: 2,
    color: colors.ink,
  },
  addBtn: {
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.pill,
    paddingHorizontal: 13,
    paddingVertical: 6,
    backgroundColor: colors.card,
  },
  addBtnText: {
    fontFamily: fonts.kai,
    fontSize: 13,
    color: colors.gold,
  },
  hint: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    marginTop: 12,
  },
  hintK: {
    color: colors.moss,
    fontSize: 14,
    lineHeight: 20,
  },
  hintText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 20,
    color: colors.inkSoft,
  },
  list: {
    paddingTop: 8,
  },
  sep: {
    borderStyle: 'dashed',
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 14,
    paddingHorizontal: 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.mossSoft,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  avatarText: {
    fontFamily: fonts.kai,
    fontSize: 20,
    color: colors.moss,
  },
  rowBody: {
    flex: 1,
  },
  rowName: {
    fontFamily: fonts.kai,
    fontSize: 18,
    letterSpacing: 1,
    color: colors.ink,
  },
  rowMeta: {
    fontSize: 12.5,
    color: colors.inkSoft,
    marginTop: 3,
  },
  rowNext: {
    flex: 0,
    alignItems: 'flex-end',
  },
  rowNextDate: {
    fontFamily: fonts.kai,
    fontSize: 15,
    color: colors.moss,
  },
  rowNextTag: {
    fontSize: 11,
    color: colors.inkSoft,
    marginTop: 1,
  },
  rowNextEmpty: {
    fontSize: 11,
    color: colors.inkSoft,
  },
  empty: {
    marginTop: 36,
    padding: 34,
    alignItems: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
  },
  emptyIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.moss,
    backgroundColor: colors.mossSoft,
  },
  emptyIconFace: {
    fontSize: 28,
  },
  emptyTitle: {
    fontFamily: fonts.kai,
    fontSize: 20,
    fontWeight: '500',
    letterSpacing: 1,
    color: colors.ink,
    marginTop: 16,
  },
  emptyDesc: {
    fontSize: 13.5,
    lineHeight: 22,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: 8,
  },
  emptyBtn: {
    marginTop: 18,
    backgroundColor: colors.moss,
    borderRadius: radius.md,
    paddingHorizontal: 34,
    paddingVertical: 13,
  },
  emptyBtnText: {
    fontFamily: fonts.kai,
    fontSize: 15,
    letterSpacing: 2,
    color: colors.onMoss,
  },
});
