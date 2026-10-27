import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius } from '@/theme';

/** 骨架占位卡：虚线边框 + 楷体标题 + 说明，供后续里程碑替换为真实内容。 */
export function PlaceholderCard({ title, note }: { title: string; note: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.note}>{note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    padding: 22,
    alignItems: 'center',
  },
  title: {
    fontFamily: fonts.kai,
    fontSize: 18,
    color: colors.ink,
    letterSpacing: 1,
    marginBottom: 8,
  },
  note: {
    fontSize: 13.5,
    lineHeight: 22,
    color: colors.inkSoft,
    textAlign: 'center',
  },
});
