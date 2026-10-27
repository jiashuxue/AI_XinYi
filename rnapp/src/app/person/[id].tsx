import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { useContact, useDeleteContact, useToggleReminder } from '@/hooks/contacts';
import { useSettings } from '@/hooks/settings';
import { dateTypeLabel, formatMonthDay, nearestDate } from '@/lib/dates';
import { lunarChineseLabel, lunarToSolar } from '@/lib/lunar';
import { cardShadow, colors, fonts, pagePadding, radius } from '@/theme';

/**
 * 联系人详情（T11）：
 * 头像 / 姓名 / 关系 tag、下一次日子横幅（含 remind_days 提前提示）、
 * 「关于 TA」信息块（生日 / 特征 / 提醒开关）、编辑与删除（确认后级联移除）。
 */
export default function PersonDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useContact(id ?? '');
  const settings = useSettings();
  const toggle = useToggleReminder();
  const del = useDeleteContact();

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.moss} />
        </View>
      </SafeAreaView>
    );
  }

  const contact = data?.contact ?? null;
  const dates = data?.dates ?? [];

  // 联系人不存在（如已被删除）→ 引导返回
  if (!contact) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <BackButton />
        <View style={styles.missing}>
          <Text style={styles.missingText}>这位联系人不存在或已被删除。</Text>
        </View>
      </SafeAreaView>
    );
  }

  const next = nearestDate(dates);
  const remindDays = settings.data?.remind_days ?? 3; // T06 默认提前 3 天
  const birthdays = dates.filter((d) => d.date_type === 'birthday');

  function confirmDelete() {
    Alert.alert(
      '删除这位？',
      `删除后，「${contact!.name}」及其相关心意都会一并移除。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () =>
            del.mutate(id ?? '', { onError: (e) => Alert.alert('删除失败', e.message) }),
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton />

        {/* 头像 + 姓名 + 关系 tag */}
        <View style={styles.head}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{contact.name.slice(0, 1)}</Text>
          </View>
          <Text style={styles.name}>{contact.name}</Text>
          {contact.relation && (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{contact.relation}</Text>
            </View>
          )}
        </View>

        {/* 下一次日子横幅 */}
        <View style={styles.banner}>
          <View style={styles.stamp}>
            <Text style={styles.stampFace}>🕯️</Text>
          </View>
          {next ? (
            <>
              <View style={styles.bannerBody}>
                <Text style={styles.bannerWhen}>
                  {formatMonthDay(next.date)} · {dateTypeLabel(next.meta.date_type)}
                </Text>
                <Text style={styles.bannerWhat}>
                  {next.inDays === 0
                    ? '就是今天，心意备好了吗？'
                    : `还有 ${next.inDays} 天，心意会提前 ${remindDays} 天备好`}
                </Text>
              </View>
              <Text style={styles.bannerDays}>{next.inDays === 0 ? '今天' : `${next.inDays} 天`}</Text>
            </>
          ) : (
            <View style={styles.bannerBody}>
              <Text style={styles.bannerWhen}>还没记下日子</Text>
              <Text style={styles.bannerWhat}>去编辑补上一个生日或纪念日吧。</Text>
            </View>
          )}
        </View>

        {/* 关于 TA */}
        <View style={styles.infoBlock}>
          <Text style={styles.infoTitle}>关于 TA</Text>

          {birthdays.map((b) => {
            const solar =
              b.calendar === 'lunar'
                ? lunarToSolar(b.month, b.day, new Date().getFullYear())
                : null;
            return (
              <View key={b.id} style={styles.infoItem}>
                <Text style={styles.infoKey}>{b.calendar === 'lunar' ? '农历生日' : '生日'}</Text>
                <Text style={styles.infoValue}>
                  {solar
                    ? `${lunarChineseLabel(b.month, b.day)}（今年 ${solar.month}月${solar.day}日）`
                    : `公历 ${b.month}月${b.day}日`}
                </Text>
              </View>
            );
          })}

          <View style={styles.infoItem}>
            <Text style={styles.infoKey}>特征</Text>
            <Text style={styles.infoValue}>{contact.features || '还没写下'}</Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.infoKey}>提醒</Text>
            <View style={styles.infoSwitchWrap}>
              <Text style={styles.infoValue}>
                {contact.reminders_enabled ? '已开启' : '未开启'}
              </Text>
              <Switch
                value={contact.reminders_enabled}
                onValueChange={(v) =>
                  toggle.mutate({ id: contact.id, reminders_enabled: v }, { onError: (e) => Alert.alert('操作失败', e.message) })
                }
                trackColor={{ false: colors.line, true: colors.moss }}
                thumbColor={colors.card}
              />
            </View>
          </View>
        </View>

        {/* 编辑 / 删除 */}
        <View style={styles.actions}>
          <Pressable
            style={[styles.actionBtn, styles.editBtn]}
            onPress={() => router.push(`/person/${contact.id}/edit`)}
          >
            <Text style={styles.editBtnText}>编辑</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, styles.deleteBtn]} onPress={confirmDelete}>
            <Text style={styles.deleteBtnText}>删除</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
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
  content: {
    paddingBottom: 30,
  },
  missing: {
    marginTop: 40,
    alignItems: 'center',
  },
  missingText: {
    fontSize: 13.5,
    color: colors.inkSoft,
  },
  head: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.mossSoft,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  avatarText: {
    fontFamily: fonts.kai,
    fontSize: 30,
    color: colors.moss,
  },
  name: {
    fontFamily: fonts.kai,
    fontSize: 28,
    fontWeight: '500',
    letterSpacing: 2,
    color: colors.ink,
    marginTop: 12,
  },
  tag: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 2,
    backgroundColor: colors.card,
  },
  tagText: {
    fontSize: 11,
    color: colors.inkSoft,
    letterSpacing: 1,
  },
  banner: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    padding: 13,
    paddingHorizontal: 15,
    ...cardShadow,
  },
  stamp: {
    width: 40,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.gold,
    borderRadius: 2,
  },
  stampFace: {
    fontSize: 20,
  },
  bannerBody: {
    flex: 1,
  },
  bannerWhen: {
    fontFamily: fonts.kai,
    fontSize: 16,
    letterSpacing: 1,
    color: colors.ink,
  },
  bannerWhat: {
    fontSize: 12.5,
    color: colors.inkSoft,
    marginTop: 3,
  },
  bannerDays: {
    fontFamily: fonts.kai,
    fontSize: 17,
    color: colors.moss,
  },
  infoBlock: {
    marginTop: 22,
  },
  infoTitle: {
    fontFamily: fonts.kai,
    fontSize: 17,
    letterSpacing: 2,
    color: colors.ink,
    marginBottom: 10,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
    paddingVertical: 11,
    borderStyle: 'dashed',
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  infoKey: {
    color: colors.inkSoft,
    flex: 0,
    width: 56,
    fontSize: 12.5,
  },
  infoValue: {
    flex: 1,
    fontFamily: fonts.kai,
    fontSize: 16,
    letterSpacing: 1,
    color: colors.ink,
  },
  infoSwitchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  editBtn: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  editBtnText: {
    fontFamily: fonts.kai,
    fontSize: 16,
    letterSpacing: 1,
    color: colors.ink,
  },
  deleteBtn: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.mossSoft,
  },
  deleteBtnText: {
    fontFamily: fonts.kai,
    fontSize: 16,
    letterSpacing: 1,
    color: colors.moss,
  },
});
