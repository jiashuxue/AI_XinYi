import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme';

function TabIcon({ icon }: { icon: string; focused: boolean }) {
  return <Text style={styles.icon}>{icon}</Text>;
}

function TabLabel({ title, focused }: { title: string; focused: boolean }) {
  return (
    <Text style={[styles.label, focused ? styles.labelOn : styles.labelOff]}>{title}</Text>
  );
}

/**
 * 底部 Tab：今日 / 在乎的人 / 我的。
 * 视觉参照原型底部导航：明信片白底 + 顶细线 + emoji 图标；
 * 选中项为苔藓绿楷体，未选中为灰绿墨。
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.moss,
        tabBarInactiveTintColor: colors.inkSoft,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '今日',
          tabBarIcon: (props) => <TabIcon icon="✉️" focused={props.focused} />,
          tabBarLabel: ({ focused }) => <TabLabel title="今日" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="people"
        options={{
          title: '在乎的人',
          tabBarIcon: (props) => <TabIcon icon="🫧" focused={props.focused} />,
          tabBarLabel: ({ focused }) => <TabLabel title="在乎的人" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '我的',
          tabBarIcon: (props) => <TabIcon icon="🪶" focused={props.focused} />,
          tabBarLabel: ({ focused }) => <TabLabel title="我的" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: 'rgba(247, 246, 238, 0.96)', // 明信片白，与原型一致
    borderTopColor: colors.line,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
  },
  icon: {
    fontSize: 20,
    lineHeight: 22,
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  labelOn: {
    color: colors.moss,
    fontFamily: fonts.kai,
  },
  labelOff: {
    color: colors.inkSoft,
  },
});
