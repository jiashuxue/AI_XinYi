import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlaceholderCard } from '@/components/placeholder-card';
import { colors, pagePadding } from '@/theme';

/** 独立路由页（登录 / 联系人 / 整套心意）的骨架占位，后续里程碑逐页替换为真实内容。 */
export function RoutePlaceholder({ title, note }: { title: string; note: string }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.center}>
        <PlaceholderCard title={title} note={note} />
      </View>
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
    justifyContent: 'center',
  },
});
