import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, fonts } from '@/theme';

/** 页面返回按钮，参照原型 .back（楷体 + 左箭头） */
export function BackButton() {
  return (
    <Pressable style={styles.btn} onPress={() => router.back()} hitSlop={10}>
      <Text style={styles.label}>‹ 返回</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingRight: 12,
  },
  label: {
    fontFamily: fonts.kai,
    fontSize: 15,
    color: colors.ink,
  },
});
