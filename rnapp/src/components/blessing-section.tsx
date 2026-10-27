import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { cardShadow, colors, fonts, radius } from '@/theme';

/**
 * 祝福文案区（T20，spec 9 / 10）：
 * - 默认展示 3 条，条数随设置 1~5（由调用方传入 blessings）；
 * - 可「换一批」重新生成（onRegenerate，调用方携带 previous_batch 避免重复）；
 * - 每条可本地编辑文案（仅组件内 state，不写回数据库），编辑后一键复制到聊天软件。
 */
export function BlessingSection({
  blessings,
  onRegenerate,
  editable = true,
}: {
  blessings: string[];
  onRegenerate?: () => void;
  editable?: boolean;
}) {
  // 本地编辑态：换一批后由调用方传入新批次，这里同步
  const [items, setItems] = useState<string[]>(blessings);

  useEffect(() => {
    setItems(blessings);
  }, [blessings]);

  if (blessings.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>祝福文案</Text>
        <Text style={styles.empty}>祝福还没生成，先补充一点对方特征吧。</Text>
      </View>
    );
  }

  const updateItem = (index: number, text: string) => {
    setItems((prev) => prev.map((item, i) => (i === index ? text : item)));
  };

  const copy = async (text: string) => {
    try {
      await Clipboard.setStringAsync(text);
      Alert.alert('已复制', '祝福已复制，去聊天软件粘贴就能发送。');
    } catch {
      Alert.alert('复制失败', '请长按文案手动复制。');
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.sectionTitle}>祝福文案</Text>
        {onRegenerate && (
          <Pressable style={styles.regenerate} onPress={onRegenerate} hitSlop={6}>
            <Text style={styles.regenerateText}>换一批</Text>
          </Pressable>
        )}
      </View>

      {items.map((item, index) => (
        <View key={index} style={styles.row}>
          <Text style={styles.no}>{index + 1}</Text>
          {editable ? (
            <TextInput
              style={styles.input}
              value={item}
              onChangeText={(text) => updateItem(index, text)}
              multiline
              textAlignVertical="top"
            />
          ) : (
            <Text style={styles.bless}>{item}</Text>
          )}
          <Pressable style={styles.copyBtn} onPress={() => copy(item)} hitSlop={6}>
            <Text style={styles.copyText}>复制</Text>
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
  regenerate: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: colors.paper,
  },
  regenerateText: {
    fontSize: 12,
    color: colors.moss,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
  no: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.mossSoft,
    textAlign: 'center',
    lineHeight: 22,
    fontSize: 12,
    color: colors.moss,
    marginTop: 3,
  },
  bless: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: colors.ink,
  },
  input: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: colors.ink,
    padding: 0,
  },
  copyBtn: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: colors.paper,
  },
  copyText: {
    fontSize: 12,
    color: colors.inkSoft,
  },
  empty: {
    fontSize: 13,
    lineHeight: 21,
    color: colors.inkSoft,
  },
});
