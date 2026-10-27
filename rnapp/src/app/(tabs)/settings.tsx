import { useMutation } from '@tanstack/react-query';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';

import { useContacts, useToggleReminder } from '@/hooks/contacts';
import { regenerateKitsForCount } from '@/hooks/regen';
import { PLATFORMS, useSettings, useUpdateSettings } from '@/hooks/settings';
import { colors, fonts, pagePadding, radius } from '@/theme';

/**
 * 我的（设置）—— T13：
 * 提前天数（1～14）/ 祝福条数（1～5）/ 默认电商平台（可切换）/ 提醒总开关 /
 * 各联系人提醒开关 / 隐私承诺 / 退出登录。参照原型设置页结构。
 */
export default function SettingsScreen() {
  const { data: settings } = useSettings();
  const { data: contactsData } = useContacts();
  const update = useUpdateSettings();
  const toggle = useToggleReminder();
  const signOut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
    onError: (e) => Alert.alert('退出失败', e.message),
  });

  const contacts = contactsData?.contacts ?? [];
  const s = settings ?? { remind_days: 3, blessing_count: 3, ecommerce_platform: '淘宝', notifications_enabled: true };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>设置</Text>
        <Text style={styles.sub}>提醒怎么发、心意怎么备，都由你来定。</Text>

        <View style={styles.card}>
          <SettingRow
            name="提前几天提醒"
            desc="全局统一，通知当日上午送达"
            right={
              <Stepper
                value={s.remind_days}
                min={1}
                max={14}
                unit="天"
                disabled={update.isPending}
                onChange={(v) => update.mutate({ remind_days: v })}
              />
            }
          />
          <SettingRow
            name="祝福条数"
            desc="每次备好几条，随你挑"
            right={
              <Stepper
                value={s.blessing_count}
                min={1}
                max={5}
                unit="条"
                disabled={update.isPending}
                onChange={(v) =>
                  update.mutate(
                    { blessing_count: v },
                    {
                      // T28：条数变更成功后，对已备好的心意按新条数重新生成
                      onSuccess: () => {
                        regenerateKitsForCount({ ...s, blessing_count: v })
                          .then((r) => {
                            if (r.total === 0) return; // 尚无任何心意，无需提示
                            if (r.failed > 0) {
                              Alert.alert('部分未更新', '部分心意未能按新条数重新生成，请稍后再试。');
                            } else {
                              Alert.alert('心意已更新', `已按 ${v} 条重新备好全部心意。`);
                            }
                          })
                          .catch(() => Alert.alert('更新失败', '心意重生成失败，请稍后再试。'));
                      },
                    },
                  )
                }
              />
            }
          />
          <View style={styles.platformBlock}>
            <SettingRow name="默认电商平台" desc="「去看看」跳转的平台，随时可切" />
            <View style={styles.chips}>
              {PLATFORMS.map((p) => {
                const on = s.ecommerce_platform === p;
                return (
                  <Pressable
                    key={p}
                    style={[styles.chip, on && styles.chipOn]}
                    onPress={() => update.mutate({ ecommerce_platform: p })}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{p}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <SettingRow
            name="提醒总开关"
            desc="一键关闭全部提醒"
            right={
              <Switch
                value={s.notifications_enabled}
                onValueChange={(v) => update.mutate({ notifications_enabled: v })}
                trackColor={{ false: colors.line, true: colors.moss }}
                thumbColor={colors.card}
              />
            }
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>各联系人提醒</Text>
          {contacts.length === 0 ? (
            <Text style={styles.emptyContacts}>还没有联系人，先到「在乎的人」记一位吧。</Text>
          ) : (
            contacts.map((c) => (
              <View key={c.id} style={styles.contactRow}>
                <Text style={styles.contactName}>{c.name}</Text>
                <Switch
                  value={c.reminders_enabled}
                  onValueChange={(v) =>
                    toggle.mutate(
                      { id: c.id, reminders_enabled: v },
                      { onError: (e) => Alert.alert('操作失败', e.message) },
                    )
                  }
                  trackColor={{ false: colors.line, true: colors.moss }}
                  thumbColor={colors.card}
                />
              </View>
            ))
          )}
        </View>

        <View style={styles.privacy}>
          <Text style={styles.privacyText}>
            <Text style={styles.privacyBold}>隐私承诺：</Text>
            联系人信息只用于为你本人准备心意，App 不会对外共享，也不会上传给任何第三方。
          </Text>
        </View>

        <Pressable
          style={[styles.logout, signOut.isPending && styles.logoutDisabled]}
          onPress={() => signOut.mutate()}
          disabled={signOut.isPending}
        >
          <Text style={styles.logoutText}>{signOut.isPending ? '退出中…' : '退出登录'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingRow({
  name,
  desc,
  right,
}: {
  name: string;
  desc: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowName}>{name}</Text>
        <Text style={styles.rowDesc}>{desc}</Text>
      </View>
      {right}
    </View>
  );
}

/** 步进器：− 值 ＋ 单位，参照原型 .stepper */
function Stepper({
  value,
  min,
  max,
  unit,
  disabled,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  unit: string;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable
        style={[styles.stepBtn, value <= min && styles.stepBtnDisabled]}
        onPress={() => onChange(value - 1)}
        disabled={disabled || value <= min}
        hitSlop={4}
      >
        <Text style={styles.stepBtnText}>−</Text>
      </Pressable>
      <Text style={styles.stepVal}>{value}</Text>
      <Pressable
        style={[styles.stepBtn, value >= max && styles.stepBtnDisabled]}
        onPress={() => onChange(value + 1)}
        disabled={disabled || value >= max}
        hitSlop={4}
      >
        <Text style={styles.stepBtnText}>＋</Text>
      </Pressable>
      <Text style={styles.stepUnit}>{unit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.paper,
    paddingHorizontal: pagePadding,
  },
  content: {
    paddingBottom: 36,
  },
  title: {
    fontFamily: fonts.kai,
    fontSize: 26,
    fontWeight: '500',
    letterSpacing: 2,
    color: colors.ink,
    marginTop: 14,
  },
  sub: {
    fontSize: 13.5,
    color: colors.inkSoft,
    lineHeight: 21,
    marginTop: 6,
  },
  card: {
    marginTop: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  rowText: {
    flex: 1,
  },
  rowName: {
    fontSize: 15,
    color: colors.ink,
  },
  rowDesc: {
    fontSize: 11.5,
    color: colors.inkSoft,
    marginTop: 3,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: {
    opacity: 0.35,
  },
  stepBtnText: {
    fontSize: 17,
    color: colors.ink,
    lineHeight: 20,
  },
  stepVal: {
    fontFamily: fonts.kai,
    fontSize: 17,
    color: colors.moss,
    minWidth: 22,
    textAlign: 'center',
  },
  stepUnit: {
    fontSize: 12,
    color: colors.inkSoft,
  },
  platformBlock: {
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 14,
  },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
  },
  chipOn: {
    borderColor: colors.moss,
    backgroundColor: colors.moss,
  },
  chipText: {
    fontSize: 12.5,
    color: colors.ink,
  },
  chipTextOn: {
    color: '#fff',
  },
  cardTitle: {
    fontFamily: fonts.kai,
    fontSize: 15,
    letterSpacing: 1,
    color: colors.ink,
    paddingTop: 14,
    paddingBottom: 2,
  },
  emptyContacts: {
    fontSize: 12.5,
    color: colors.inkSoft,
    lineHeight: 20,
    paddingVertical: 12,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  contactName: {
    fontSize: 15,
    color: colors.ink,
  },
  privacy: {
    marginTop: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    borderRadius: radius.sm,
    padding: 12,
    backgroundColor: colors.card2,
  },
  privacyText: {
    fontSize: 12.5,
    lineHeight: 20,
    color: colors.inkSoft,
  },
  privacyBold: {
    color: colors.ink,
    fontFamily: fonts.kai,
  },
  logout: {
    marginTop: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutDisabled: {
    opacity: 0.6,
  },
  logoutText: {
    fontFamily: fonts.kai,
    fontSize: 16,
    letterSpacing: 2,
    color: colors.ink,
  },
});
