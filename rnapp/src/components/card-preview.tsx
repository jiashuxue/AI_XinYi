import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { Image } from 'expo-image';

import { exportCardToLibrary } from '@/lib/card-export';
import { generateCardImage } from '@/lib/card-image';
import { cardShadow, colors, fonts, radius } from '@/theme';

/**
 * 电子贺卡（M7 T29/T30/T31/T32 + M9 T34，spec 13 / 14）：
 * - 四套模板（生日 / 节日 / 感谢 / 通用），按场景自动推荐、可手动切换；
 * - 祝福语默认取第一条，可从已生成条数中换选；
 * - 内容自上而下：deco → 分隔线 → 祝福语 → 分隔线 →「给{姓名}　{occasion_name}」，不署名；
 * - 导出：captureRef 捕获贺卡 View → 保存相册，可重复导出；
 * - M9：AI 生成插画作为贺卡背景，导出时一并捕获。
 */

/**
 * 四套模板配色，沿用 prototype/index-v2.html 的 .tpl-*：
 * 背景色取原型渐变起始色（纯色近似，不引入 expo-linear-gradient）。
 */
const TEMPLATES = [
  {
    key: 'birthday',
    name: '生日',
    bg: '#F4F0DF', // .tpl-birthday 渐变起始色
    deco: '🌼 🌿 🌼',
    lineColor: '#B08D42', // 金色分隔线（colors.gold）
    msgColor: '#3C4434',
    toColor: '#7A7A5E',
  },
  {
    key: 'festival',
    name: '节日',
    bg: '#31513D', // .tpl-festival 渐变起始色（深苔绿）
    deco: '🏮 ✨ 🏮',
    lineColor: '#B08D42', // 金色分隔线
    msgColor: '#F6F0E0', // 深底上的浅色文字
    toColor: '#D9CCA4',
  },
  {
    key: 'thanks',
    name: '感谢',
    bg: '#EEF0E8',
    deco: '✉️ 🌿 ✉️',
    lineColor: '#B08D42', // 金色分隔线
    msgColor: '#3C4636',
    toColor: '#6E7662',
  },
  {
    key: 'universal',
    name: '通用',
    bg: '#F7F6EE',
    deco: '🌟 ☾ 🌟',
    lineColor: '#31513D', // 苔绿分隔线（colors.moss）
    msgColor: '#44483B',
    toColor: '#7A806E',
  },
] as const;

type TemplateKey = (typeof TEMPLATES)[number]['key'];

/** 按场景自动推荐模板（T29）：节日 → 节日；生日 → 生日；纪念日 → 感谢；其余 → 通用 */
function recommendTemplate(festivalId: number | null | undefined, occasion: string): TemplateKey {
  if (festivalId != null) return 'festival';
  if (occasion.includes('生日')) return 'birthday';
  if (occasion.includes('纪念日')) return 'thanks';
  return 'universal';
}

/**
 * 按场景拼文生图 prompt（T34）：
 * - 生日 / 纪念日 / 其余：可追加「关系主题」与「特征元素」；
 * - 节日场景（festivalId 非空或 occasion 含「节日」）：只按 occasion 描述氛围，不追加关系 / 特征；
 * - 结尾统一加「竖版构图，无文字」，避免插画里出现乱码文字。
 */
function buildCardImagePrompt(
  occasion: string,
  festivalId: number | null | undefined,
  relation: string | null | undefined,
  features: string | null | undefined,
): string {
  const tail = '，竖版构图，无文字';
  const relationPart = relation?.trim() ? `，${relation.trim()}主题` : '';
  const featuresPart = features?.trim() ? `，融入「${features.trim()}」的元素` : '';

  if (occasion.includes('生日')) {
    return `温馨的生日贺卡插画，暖黄色调，柔光，花朵与烛光点缀${relationPart}${featuresPart}${tail}`;
  }
  if (occasion.includes('纪念日')) {
    return `温馨的纪念日贺卡插画，暖色调，柔光${relationPart}${featuresPart}${tail}`;
  }
  if (festivalId != null || occasion.includes('节日')) {
    return `${occasion}贺卡插画，节日氛围，暖色调，柔光${tail}`;
  }
  return `温馨的贺卡插画，暖色调，柔光${relationPart}${featuresPart}${tail}`;
}

export function CardPreview({
  contactName,
  occasion,
  festivalId,
  blessings,
  relation,
  features,
}: {
  contactName: string;
  occasion: string;
  festivalId?: number | null;
  blessings: string[];
  relation?: string | null;
  features?: string | null;
}) {
  const [templateKey, setTemplateKey] = useState<TemplateKey>(() =>
    recommendTemplate(festivalId, occasion),
  );
  const [blessingIndex, setBlessingIndex] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [cardImageUrl, setCardImageUrl] = useState<string | null>(null);
  const [generatingImage, setGeneratingImage] = useState(false);
  const cardRef = useRef<ViewInstance>(null);

  // 换一批 / 重生成后条数变化，避免祝福语下标越界
  useEffect(() => {
    if (blessings.length === 0) return;
    setBlessingIndex((index) => (index < blessings.length ? index : 0));
  }, [blessings.length]);

  const tpl = TEMPLATES.find((t) => t.key === templateKey) ?? TEMPLATES[0];
  const blessing = blessings[blessingIndex] ?? '';
  const hasBlessing = blessings.length > 0;

  const onExport = async () => {
    if (!hasBlessing || exporting) return;
    setExporting(true);
    try {
      const result = await exportCardToLibrary(cardRef);
      if (result.ok) Alert.alert('导出成功', result.message);
      else Alert.alert('导出失败', result.message);
    } catch (e) {
      Alert.alert('导出失败', (e as Error).message || '导出贺卡失败，请重试。');
    } finally {
      setExporting(false);
    }
  };

  // AI 生成插画（T34）：按场景拼 prompt → 调 generate-card-image → 成功后作为贺卡背景
  const onGenerateImage = async () => {
    if (generatingImage) return;
    setGeneratingImage(true);
    try {
      const prompt = buildCardImagePrompt(occasion, festivalId, relation, features);
      const result = await generateCardImage(prompt);
      setCardImageUrl(result.url);
    } catch (e) {
      Alert.alert('生成失败', (e as Error).message || '插画生成失败，请稍后重试');
    } finally {
      setGeneratingImage(false);
    }
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>贺卡</Text>

      {/* 贺卡正面：竖版 3:4，外层 frame 负责圆角 / 边框 / 阴影并作为捕获节点 */}
      <View
        ref={cardRef}
        collapsable={false}
        style={[styles.cardframe, { backgroundColor: tpl.bg }]}
      >
        {/* AI 插画背景（T34）：有图时绝对定位铺满，文字层（deco / 分隔线 / 祝福语 / 称呼）叠在其上 */}
        {cardImageUrl ? (
          <>
            <Image source={{ uri: cardImageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <View style={[StyleSheet.absoluteFill, styles.cardImageOverlay]} />
          </>
        ) : null}
        <View style={styles.tpl}>
          <View style={styles.deco}>
            {tpl.deco.split(' ').map((item, index) => (
              <Text key={index} style={styles.decoItem}>
                {item}
              </Text>
            ))}
          </View>
          <View style={[styles.cardLine, { backgroundColor: tpl.lineColor }]} />
          <View style={styles.msgWrap}>
            <Text style={[styles.cardMsg, { color: tpl.msgColor }]}>
              {hasBlessing ? blessing : '祝福还没生成'}
            </Text>
          </View>
          <View style={[styles.cardLine, { backgroundColor: tpl.lineColor }]} />
          <Text style={[styles.cardTo, { color: tpl.toColor }]}>
            给{contactName}　{occasion}
          </Text>
        </View>
      </View>

      {/* 四套模板切换（T29）：四个小方块，选中态描边苔绿 */}
      <View style={styles.pickRow}>
        {TEMPLATES.map((t) => (
          <Pressable
            key={t.key}
            style={[styles.pickItem, templateKey === t.key && styles.pickItemOn]}
            onPress={() => setTemplateKey(t.key)}
          >
            <View style={[styles.pickSwatch, { backgroundColor: t.bg }]} />
            <Text style={styles.pickName}>{t.name}</Text>
          </Pressable>
        ))}
      </View>

      {/* AI 生成插画（T34）：主按钮风格（苔绿），生成中禁用并显示进度文案 */}
      <Pressable
        style={[styles.imageBtn, generatingImage && styles.imageBtnDisabled]}
        onPress={onGenerateImage}
        disabled={generatingImage}
      >
        <Text style={[styles.imageBtnText, generatingImage && styles.imageBtnTextDisabled]}>
          {generatingImage ? '生成插画中…' : 'AI 生成插画'}
        </Text>
      </Pressable>

      {/* 祝福语选择（T30）：横排「第 1 条 / 第 2 条…」小按钮 */}
      <Text style={styles.pickerLabel}>祝福语</Text>
      {!hasBlessing ? (
        <Text style={styles.emptyHint}>祝福还没生成</Text>
      ) : (
        <View style={styles.blessRow}>
          {blessings.map((_, index) => (
            <Pressable
              key={index}
              style={[styles.blessChip, blessingIndex === index && styles.blessChipOn]}
              onPress={() => setBlessingIndex(index)}
            >
              <Text
                style={[
                  styles.blessChipText,
                  blessingIndex === index && styles.blessChipTextOn,
                ]}
              >
                第 {index + 1} 条
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* 导出（T32）：无祝福时置灰，避免导出空白贺卡 */}
      <Pressable
        style={[styles.exportBtn, !hasBlessing && styles.exportBtnDisabled]}
        onPress={onExport}
        disabled={!hasBlessing || exporting}
      >
        <Text style={[styles.exportText, !hasBlessing && styles.exportTextDisabled]}>
          {exporting ? '导出中…' : '导出贺卡为图片'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 22,
  },
  title: {
    fontFamily: fonts.kai,
    fontSize: 17,
    letterSpacing: 2,
    color: colors.ink,
    marginBottom: 10,
  },
  cardframe: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    overflow: 'hidden',
    ...cardShadow,
  },
  cardImageOverlay: {
    // 接近 colors.card 的浅色半透明遮罩，保证叠在插画上的文字可读
    backgroundColor: 'rgba(247,246,238,0.72)',
  },
  tpl: {
    aspectRatio: 390 / 520, // 竖版 3:4，对应原型 .cardframe .tpl 的 390/520
    padding: 22,
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  deco: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  decoItem: {
    fontSize: 18,
  },
  cardLine: {
    height: 1.5,
  },
  msgWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 6,
  },
  cardMsg: {
    fontFamily: fonts.kai,
    fontSize: 19,
    lineHeight: 33, // 原型 .card-msg line-height 1.75
    letterSpacing: 1,
  },
  cardTo: {
    fontFamily: fonts.kai,
    fontSize: 13,
    letterSpacing: 1,
    textAlign: 'right',
  },
  pickRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  pickItem: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    paddingVertical: 9,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 6,
  },
  pickItemOn: {
    borderColor: colors.moss,
  },
  pickSwatch: {
    alignSelf: 'stretch',
    height: 26,
    borderRadius: 4,
  },
  pickName: {
    fontSize: 12,
    color: colors.inkSoft,
  },
  pickerLabel: {
    fontSize: 13.5,
    color: colors.inkSoft,
    marginTop: 14,
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 13,
    color: colors.inkSoft,
  },
  blessRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  blessChip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: 13,
    paddingVertical: 6,
    backgroundColor: colors.paper,
  },
  blessChipOn: {
    borderColor: colors.moss,
    backgroundColor: colors.mossSoft,
  },
  blessChipText: {
    fontSize: 12.5,
    color: colors.inkSoft,
  },
  blessChipTextOn: {
    color: colors.moss,
  },
  imageBtn: {
    marginTop: 14,
    backgroundColor: colors.moss,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  imageBtnDisabled: {
    backgroundColor: colors.line,
  },
  imageBtnText: {
    fontFamily: fonts.kai,
    fontSize: 15,
    letterSpacing: 2,
    color: colors.onMoss,
  },
  imageBtnTextDisabled: {
    color: colors.inkSoft,
  },
  exportBtn: {
    marginTop: 16,
    backgroundColor: colors.moss,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  exportBtnDisabled: {
    backgroundColor: colors.line,
  },
  exportText: {
    fontFamily: fonts.kai,
    fontSize: 15,
    letterSpacing: 2,
    color: colors.onMoss,
  },
  exportTextDisabled: {
    color: colors.inkSoft,
  },
});
