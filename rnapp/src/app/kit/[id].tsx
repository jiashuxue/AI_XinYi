import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { BlessingSection } from '@/components/blessing-section';
import { CardPreview } from '@/components/card-preview';
import { GiftSection } from '@/components/gift-section';
import { useContact } from '@/hooks/contacts';
import { generateKit, useKit } from '@/hooks/kits';
import { ensureKitForScene } from '@/hooks/pregen';
import { useSettings } from '@/hooks/settings';
import { dateTypeLabel } from '@/lib/dates';
import { colors, fonts, pagePadding, radius } from '@/theme';
import { GenerateKitInput } from '@/types/kit';

/**
 * 整套心意页（M4 T19/T20/T21 + M6 T25/T27）：
 * - 路由 `/kit/[id]` 的 id = 联系人 id（T17 约定），场景经 URL query 传入
 *   （dateId / festivalId / occasion）；
 * - 祝福区（T20：默认 3 条随设置 1~5、换一批、编辑、复制）+ 礼物区（T21：固定 3 条 + 去看看）；
 * - T19 特征缺失：祝福不生成 → 引导补特征，可跳过（礼物按关系给通用建议）；
 * - T25 完整与降级：同屏祝福 + 礼物 + 贺卡（M7：四套模板 + 祝福语选择 + 导出），status='partial' 降级展示可用部分；
 * - T26 按需补生成：有明确场景但 kits 表还没有 → 打开即调 ensureKitForScene 补生成（点开即见）。
 */
export default function KitScreen() {
  const { id, dateId, festivalId, occasion } = useLocalSearchParams<{
    id: string;
    dateId?: string;
    festivalId?: string;
    occasion?: string;
  }>();
  const qc = useQueryClient();

  // 场景：从 URL query 解析（date_id / festival_id 至少一个，供 kits 查询）
  const scene = useMemo<{ date_id?: string; festival_id?: number } | undefined>(() => {
    if (!dateId && !festivalId) return undefined;
    const festId = festivalId ? Number(festivalId) : undefined;
    return {
      date_id: dateId || undefined,
      festival_id: festId !== undefined && Number.isFinite(festId) ? festId : undefined,
    };
  }, [dateId, festivalId]);

  const { data: contactData, isLoading: contactLoading } = useContact(id ?? '');
  const { data: settings } = useSettings();
  const kitQuery = useKit(id ?? '', scene);

  const contact = contactData?.contact ?? null;
  const kit = kitQuery.data ?? null;

  // 生成用的场景（occasion_name 尽量从参数或联系人日期推导，换一批 / 跳过共用）
  const sceneForGenerate = useMemo(() => {
    if (scene) {
      const date = contactData?.dates.find((d) => d.id === dateId);
      const festId = festivalId ? Number(festivalId) : undefined;
      const name =
        occasion ||
        (date ? dateTypeLabel(date.date_type) : scene.festival_id ? '节日' : '心意');
      return {
        date_id: dateId ?? undefined,
        festival_id: festId !== undefined && Number.isFinite(festId) ? festId : undefined,
        occasion_name: name,
      };
    }
    if (kit) {
      return {
        date_id: kit.date_id ?? undefined,
        festival_id: kit.festival_id ?? undefined,
        occasion_name: kit.occasion_name,
      };
    }
    return null;
  }, [scene, kit, contactData, occasion, dateId, festivalId]);

  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const onDemandTriggered = useRef(false);

  // T26 按需补生成：生成逻辑抽成函数，首次挂载与失败「重试」共用（重试能真正重新请求）
  const triggerGenerate = useCallback(() => {
    if (!scene || !contact || !settings || !sceneForGenerate) return;
    setGenerating(true);
    setGenError(null);
    ensureKitForScene(contact, sceneForGenerate, settings)
      .then((k) => {
        if (k) qc.invalidateQueries({ queryKey: ['kits', 'contact', contact.id] });
        else setGenError('心意生成失败，请稍后重试');
      })
      .catch((e) => setGenError((e as Error).message || '心意生成失败，请稍后重试'))
      .finally(() => setGenerating(false));
  }, [scene, sceneForGenerate, contact, settings, qc]);

  // 打开即补生成（仅首次自动触发；后续失败由「重试」按钮直接调 triggerGenerate）
  useEffect(() => {
    if (onDemandTriggered.current) return;
    if (!scene || !contact || !settings) return;
    if (kit || kitQuery.isLoading) return;
    if (!sceneForGenerate) return;
    onDemandTriggered.current = true;
    triggerGenerate();
  }, [scene, sceneForGenerate, contact, settings, kit, kitQuery.isLoading, triggerGenerate]);

  // 换一批（带 previous_batch 避免重复）/ 跳过（skip_features 按关系备礼物）共用
  const runGenerate = async (overrides: { previous_batch?: string[]; skip_features?: boolean }) => {
    if (!contact || !settings || !sceneForGenerate) return;
    setGenerating(true);
    setGenError(null);
    try {
      const input: GenerateKitInput = {
        contact: {
          id: contact.id,
          name: contact.name,
          relation: contact.relation,
          features: contact.features,
        },
        occasion: sceneForGenerate,
        blessing_count: settings.blessing_count,
        ...overrides,
      };
      await generateKit(input);
      qc.invalidateQueries({ queryKey: ['kits', 'contact', contact.id] });
    } catch (e) {
      Alert.alert('生成失败', (e as Error).message || '心意生成失败，请稍后重试');
    } finally {
      setGenerating(false);
    }
  };

  const regenerate = () => runGenerate({ previous_batch: kit?.blessings ?? [] });
  const skipFeatures = () => runGenerate({ skip_features: true });

  // T19 修正：特征已补但旧 kit 仍是 partial（祝福为空）→ 自动重新生成一次，
  // 避免补特征后仍误报「去补充特征」。ref 防循环 / 防重复（用户可手动「换一批」重试）。
  const autoRegenTriggered = useRef(false);
  useEffect(() => {
    if (autoRegenTriggered.current) return;
    if (generating) return;
    if (!contact?.features?.trim()) return;
    if (!kit || kit.status !== 'partial' || kit.blessings.length > 0) return;
    if (!sceneForGenerate || !settings) return;
    autoRegenTriggered.current = true;
    setGenerating(true);
    setGenError(null);
    const input: GenerateKitInput = {
      contact: {
        id: contact.id,
        name: contact.name,
        relation: contact.relation,
        features: contact.features,
      },
      occasion: sceneForGenerate,
      blessing_count: settings.blessing_count,
    };
    generateKit(input)
      .then(() => qc.invalidateQueries({ queryKey: ['kits', 'contact', contact.id] }))
      .catch((e) => Alert.alert('生成失败', (e as Error).message || '心意生成失败，请稍后重试'))
      .finally(() => setGenerating(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact, kit, sceneForGenerate, settings, qc]);

  // ---------- 渲染分支 ----------
  if (contactLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.moss} />
        </View>
      </SafeAreaView>
    );
  }

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

  let body: React.ReactNode;
  if (kitQuery.isLoading || (scene && !kit && !genError)) {
    // 查询中，或按需补生成进行中
    body = (
      <View style={styles.center}>
        <ActivityIndicator color={colors.moss} />
        <Text style={styles.genHint}>正在为你备好心意…</Text>
      </View>
    );
  } else if (scene && !kit) {
    // 有场景但生成失败 → 可重试
    body = (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>心意没生成成功</Text>
        <Text style={styles.emptyText}>{genError}</Text>
        <Pressable style={styles.retryBtn} onPress={triggerGenerate}>
          <Text style={styles.retryText}>重试</Text>
        </Pressable>
      </View>
    );
  } else if (!scene && !kit) {
    // 未指明场景且无已备心意
    body = (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>还没备好的心意</Text>
        <Text style={styles.emptyText}>这位联系人的整套心意会在临近日子时提前替你备好，点开即见。</Text>
      </View>
    );
  } else if (kit) {
    const partial = kit.status === 'partial';
    // 仅特征仍为空时才引导「去补充特征」；特征已补但旧 kit 未生成祝福时由上方 effect 自动重生成
    const missingFeatures = partial && kit.blessings.length === 0 && !(contact?.features?.trim());
    body = (
      <>
        {partial && (
          <View style={styles.partialCard}>
            <Text style={styles.partialTitle}>这份心意还没备齐</Text>
            <Text style={styles.partialText}>
              有一项暂时没能生成，其余部分先用着；补充特征后可重新生成。
            </Text>
          </View>
        )}
        {missingFeatures && (
          <View style={styles.guidance}>
            <Text style={styles.guidanceTitle}>祝福还没想好</Text>
            <Text style={styles.guidanceText}>
              TA 的特征还没记下，补充特征后祝福会更贴合 TA。
            </Text>
            <View style={styles.guidanceRow}>
              <Pressable
                style={[styles.guidanceBtn, styles.guidancePrimary]}
                onPress={() => router.push(`/person/${contact.id}/edit`)}
              >
                <Text style={styles.guidancePrimaryText}>去补充特征</Text>
              </Pressable>
              <Pressable style={styles.guidanceBtn} onPress={skipFeatures}>
                <Text style={styles.guidanceText}>先跳过（按关系备礼物）</Text>
              </Pressable>
            </View>
          </View>
        )}
        <BlessingSection
          blessings={kit.blessings}
          onRegenerate={sceneForGenerate ? regenerate : undefined}
          editable
        />
        <GiftSection gifts={kit.gift_suggestions} platform={settings?.ecommerce_platform ?? '淘宝'} />
        <CardPreview
          contactName={contact.name}
          occasion={kit.occasion_name}
          festivalId={kit.festival_id}
          blessings={kit.blessings}
          relation={contact.relation}
          features={contact.features}
        />
      </>
    );
  } else {
    body = null;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton />

        <View style={styles.head}>
          <View style={styles.titles}>
            <Text style={styles.title}>整套心意</Text>
            <Text style={styles.occ}>
              {kit ? `为 ${contact.name} 备好 · ${kit.occasion_name}` : '心意已装进信封'}
            </Text>
          </View>
          <View style={styles.stamp}>
            <Text style={styles.stampFace}>🌿</Text>
          </View>
        </View>

        {body}
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  },
  titles: {
    flex: 1,
  },
  title: {
    fontFamily: fonts.kai,
    fontSize: 26,
    fontWeight: '500',
    letterSpacing: 2,
    color: colors.ink,
  },
  occ: {
    fontSize: 12.5,
    color: colors.inkSoft,
    marginTop: 4,
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
  genHint: {
    marginTop: 12,
    fontSize: 13,
    color: colors.inkSoft,
  },
  emptyCard: {
    marginTop: 26,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    padding: 26,
    alignItems: 'center',
  },
  emptyTitle: {
    fontFamily: fonts.kai,
    fontSize: 18,
    letterSpacing: 1,
    color: colors.ink,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 21,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: 8,
  },
  retryBtn: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.moss,
    borderRadius: radius.pill,
    paddingHorizontal: 20,
    paddingVertical: 7,
    backgroundColor: colors.mossSoft,
  },
  retryText: {
    fontSize: 13,
    color: colors.moss,
  },
  partialCard: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: colors.goldSoft,
    borderRadius: radius.md,
    backgroundColor: colors.card2,
    padding: 13,
    paddingHorizontal: 15,
  },
  partialTitle: {
    fontFamily: fonts.kai,
    fontSize: 14.5,
    letterSpacing: 1,
    color: colors.ink,
  },
  partialText: {
    fontSize: 12.5,
    lineHeight: 20,
    color: colors.inkSoft,
    marginTop: 3,
  },
  guidance: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    padding: 15,
  },
  guidanceTitle: {
    fontFamily: fonts.kai,
    fontSize: 15,
    letterSpacing: 1,
    color: colors.ink,
  },
  guidanceText: {
    fontSize: 12.5,
    lineHeight: 20,
    color: colors.inkSoft,
    marginTop: 5,
  },
  guidanceRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  guidanceBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: colors.paper,
  },
  guidancePrimary: {
    borderColor: colors.moss,
    backgroundColor: colors.moss,
  },
  guidancePrimaryText: {
    fontSize: 13,
    color: colors.onMoss,
  },
});
