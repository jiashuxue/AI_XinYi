import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { shopSearchUrl } from '@/lib/shop';
import { cardShadow, colors, fonts, radius } from '@/theme';
import { GiftSuggestion } from '@/types/kit';

/**
 * 礼物建议区（T21，spec 11 / 12）：
 * - 固定展示 3 条礼物建议（名称 + 搜索关键词）；
 * - 每条附「去看看」→ 按所选电商平台拼搜索页并打开；
 * - 平台未知或打开失败时提示可切换到其他平台（设置页已支持切换）。
 */
export function GiftSection({
  gifts,
  platform,
}: {
  gifts: GiftSuggestion[];
  platform: string;
}) {
  const goSee = async (gift: GiftSuggestion) => {
    const url = shopSearchUrl(platform, gift.keyword);
    if (!url) {
      Alert.alert('无法跳转', '当前平台暂不支持该关键词，可到「设置」切换其他平台再试。');
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('无法跳转', '打不开平台搜索页，可到「设置」切换其他平台再试。');
    }
  };

  if (gifts.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>礼物建议</Text>
        <Text style={styles.empty}>礼物建议还没生成，先补充一点对方特征吧。</Text>
      </View>
    );
  }

  // spec 11：固定 3 条
  const items = gifts.slice(0, 3);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.sectionTitle}>礼物建议</Text>
        <Text style={styles.platform}>去 {platform} 看看</Text>
      </View>

      {items.map((gift, index) => (
        <View key={index} style={styles.row}>
          <View style={styles.giftBody}>
            <Text style={styles.giftTitle}>{gift.title}</Text>
            <Text style={styles.giftKeyword}>{gift.keyword}</Text>
          </View>
          <Pressable style={styles.goBtn} onPress={() => goSee(gift)} hitSlop={6}>
            <Text style={styles.goText}>去看看</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    padding: 16,
    ...cardShadow,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: fonts.kai,
    fontSize: 17,
    letterSpacing: 2,
    color: colors.ink,
  },
  platform: {
    fontSize: 12,
    color: colors.inkSoft,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
  giftBody: {
    flex: 1,
  },
  giftTitle: {
    fontFamily: fonts.kai,
    fontSize: 15,
    letterSpacing: 1,
    color: colors.ink,
  },
  giftKeyword: {
    fontSize: 12,
    color: colors.inkSoft,
    marginTop: 3,
  },
  goBtn: {
    borderWidth: 1,
    borderColor: colors.moss,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: colors.mossSoft,
  },
  goText: {
    fontSize: 12.5,
    color: colors.moss,
  },
  empty: {
    fontSize: 13,
    lineHeight: 21,
    color: colors.inkSoft,
  },
});
