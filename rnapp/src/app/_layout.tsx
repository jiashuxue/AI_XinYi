import { QueryClientProvider } from '@tanstack/react-query';
import { router, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AuthProvider, useAuth } from '@/hooks/auth';
import { useContacts } from '@/hooks/contacts';
import { preGenerateKits } from '@/hooks/pregen';
import { useSettings } from '@/hooks/settings';
import { ReminderData, configureNotifications, notifications, requestNotificationPermission, scheduleReminders } from '@/lib/notifications';
import { queryClient } from '@/lib/query';
import { colors } from '@/theme';

/**
 * 根布局：请求层 Provider（TanStack Query）+ 会话（AuthProvider）+ Auth 守卫。
 * 路由结构严格按 plan.md 第三章：未登录仅暴露 auth；登录后开放 (tabs) 与
 * person / kit 各页；Auth 守卫由 Stack.Protected 承担（T05）。
 */
export default function RootLayout() {
  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style="dark" />
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {/* 通知功能可用时才挂载深链监听（内部使用 expo-notifications hooks） */}
          {notifications && <NotificationDeepLink />}
          <RootNavigator />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

/**
 * T17：通知点击经深链进入整套心意页。
 * T27：深链统一携带场景（dateId / festivalId / occasion），供 kit 页定位对应那一份心意。
 * 独立成子组件的原因：内部使用了 expo-notifications 的 hook（useLastNotificationResponse），
 * 只在通知可用（原生模块存在）时才挂载，避免 Expo Go 缺模块时 App 崩溃。
 */
function NotificationDeepLink() {
  const N = notifications;
  const lastResponse = N!.useLastNotificationResponse();

  // 前台 / 后台点击通知
  useEffect(() => {
    const sub = N!.addNotificationResponseReceivedListener((resp) => {
      const data = resp.notification.request.content.data as ReminderData | undefined;
      if (data?.type === 'kit' && data.contactId) pushKitWithScene(data);
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 冷启动（App 被通知拉起）时 lastResponse 已携带点击的通知
  useEffect(() => {
    if (!lastResponse) return;
    const data = lastResponse.notification.request.content.data as ReminderData | undefined;
    if (data?.type === 'kit' && data.contactId) pushKitWithScene(data);
  }, [lastResponse]);

  return null;
}

/** T27：进整套心意页并携带场景（dateId / festivalId / occasion），无场景时省略 */
function pushKitWithScene(data: ReminderData) {
  router.push({
    pathname: '/kit/[id]',
    params: {
      id: data.contactId,
      dateId: data.dateId ?? undefined,
      festivalId: data.festivalId ?? undefined,
      occasion: data.occasionName,
    },
  });
}

/** 根导航：按登录状态分发路由（loading 期间显示加载页） */
function RootNavigator() {
  const { user, loading } = useAuth();
  const { data: contactsData } = useContacts();
  const { data: settings } = useSettings();

  // T14：应用内展示配置 + Android 渠道在启动时配置一次；登录后申请系统通知权限
  useEffect(() => {
    configureNotifications();
  }, []);
  useEffect(() => {
    if (user) requestNotificationPermission().catch(() => {});
  }, [user]);

  // T15 / T26：数据就绪后（含设置 / 联系人变化）重排提醒 + 预生成整套心意
  // （预生成已缓存跳过、控 AI 成本；失败不阻断主流程）
  useEffect(() => {
    if (!user || !contactsData || !settings) return;
    scheduleReminders(contactsData.contacts, contactsData.dates, settings).catch(() => {});
    preGenerateKits(contactsData.contacts, contactsData.dates, settings).catch(() => {});
  }, [user, contactsData, settings]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.moss} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
      {/* 已登录：主界面 + 业务路由 */}
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="person/[id]" />
        <Stack.Screen name="person/new" />
        <Stack.Screen name="person/[id]/edit" />
        <Stack.Screen name="kit/[id]" />
      </Stack.Protected>
      {/* 未登录：登录 / 注册；已登录时访问则回到首页 */}
      <Stack.Protected guard={!user} redirectTo="/">
        <Stack.Screen name="auth" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
  },
});

// 导航系统主题：整屏默认纸色背景，主强调为苔藓绿（对齐 theme.ts）
const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.moss,
    background: colors.paper,
    card: colors.card,
    text: colors.ink,
    border: colors.line,
    notification: colors.moss,
  },
};
