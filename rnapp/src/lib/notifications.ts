import { Platform } from 'react-native';
// 仅类型导入（编译期擦除，不触发模块运行时加载）
import type * as ExpoNotifications from 'expo-notifications';

import { Contact, ContactDate } from '@/hooks/contacts';
import { Settings } from '@/hooks/settings';
import { dateTypeLabel, nextOccurrence } from '@/lib/dates';
import { fetchFestivals, festivalNextOccurrence } from '@/lib/festivals';

/**
 * 本地通知（T14 / T15，plan.md 1.5）：
 * - T14：应用内展示行为 + Android 通知渠道 + 权限申请；
 * - T15：进入 App 时扫描未来 remind_days 天内到期日期，为「到期日 − remind_days」当日上午
 *   安排提醒；公历日期按年循环触发兜底（长期不打开 App 次年仍能提醒），农历因每年对应公历
 *   不同只安排今年一次性（次年换算依赖打开 App 刷新）。
 *
 * 注意：expo-notifications 的 index.js 顶层会加载 topicSubscription，进而 require 原生模块
 * `ExpoTopicSubscriptionModule`；部分旧版 Expo Go 缺少该模块，import 即抛错、拖垮整个 App。
 * 因此这里改用运行时安全加载：缺原生模块时通知功能整体降级（返回「不可用」），不影响其他功能；
 * 在最新版 Expo Go 或独立构建（development build）中自动启用。
 */

// 模块级安全引用：成功加载为 expo-notifications，失败为 null（通知降级）
declare const require: (id: string) => any;
export let notifications: typeof import('expo-notifications') | null = null;
try {
  notifications = require('expo-notifications');
} catch {
  notifications = null;
}

/** 通知功能是否可用（Expo Go 缺原生模块时为 false，调用方据此降级） */
export function notificationsAvailable(): boolean {
  return notifications !== null;
}

/** 通知内携带的上下文（T17 / T23 深链到整套心意页；节日提醒时 dateId 为 null、携带 festivalId） */
export type ReminderData = {
  type: 'kit';
  contactId: string;
  dateId: string | null;
  festivalId?: number;
  occasionName: string;
};

const CHANNEL_ID = 'reminders';
/** 提醒送达时间：当日上午 9 点 */
const REMIND_HOUR = 9;

/** T14：配置应用内展示行为与 Android 通知渠道（启动时调用一次） */
export function configureNotifications() {
  const N = notifications;
  if (!N) return;
  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    N.setNotificationChannelAsync(CHANNEL_ID, {
      name: '心意提醒',
      importance: N.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    }).catch(() => {});
  }
}

/** T14：申请系统通知权限（用户拒绝后不再打扰）；通知不可用时返回 false */
export async function requestNotificationPermission(): Promise<boolean> {
  const N = notifications;
  if (!N) return false;
  const current = await N.getPermissionsAsync();
  if (current.status === 'granted') return true;
  const asked = await N.requestPermissionsAsync();
  return asked.status === 'granted';
}

/**
 * T15 / T23：按当前联系人 / 日期 / 设置重排全部提醒（先清空再安排，保证设置变更即时生效）。
 * - 总开关关闭 / 联系人单独关闭 → 跳过；
 * - 公历日期：安排一条「每年循环」（今年提醒日未到则今年触发，已过则从明年起）；
 * - 农历日期：仅当今年提醒日未到时安排一次性（跨年换算需打开 App 刷新）；
 * - T23 节日：公历节日对所有已开启提醒的联系人、农历节日仅「家人」；固定公历节日按年循环兜底，
 *   浮动（nth_weekday）/ 农历节日逐年浮动只排当年一次性（明年打开 App 重排）；
 * - 提醒日已过（生日临门一脚）今年不再补发系统通知，由主页「今日心意」提示（实现取舍）。
 */
export async function scheduleReminders(
  contacts: Contact[],
  dates: ContactDate[],
  settings: Settings,
  today = new Date(),
) {
  const N = notifications;
  if (!N) return;

  await N.cancelAllScheduledNotificationsAsync();
  if (!settings.notifications_enabled) return;

  const enabled = new Map(contacts.filter((c) => c.reminders_enabled).map((c) => [c.id, c]));

  for (const date of dates) {
    const contact = enabled.get(date.contact_id);
    if (!contact) continue;

    // 到期日（今年已过则明年）与提醒日 = 到期日 − remind_days
    const occur = nextOccurrence(date, today);
    const remind = new Date(occur.date);
    remind.setHours(REMIND_HOUR, 0, 0, 0);
    remind.setDate(remind.getDate() - settings.remind_days);

    const label = dateTypeLabel(date.date_type);
    const content: ExpoNotifications.NotificationContentInput = {
      title: `${contact.name}的${label}`,
      body: `还有 ${settings.remind_days} 天，心意已替你备好`,
      data: { type: 'kit', contactId: contact.id, dateId: date.id, occasionName: label } as ReminderData,
    };

    if (date.calendar === 'solar') {
      // 公历：按年循环兜底，一次安排覆盖今年与未来（提醒日已过则明年起）
      await N.scheduleNotificationAsync({
        content,
        trigger: {
          type: N.SchedulableTriggerInputTypes.YEARLY,
          day: remind.getDate(),
          month: remind.getMonth() + 1,
          hour: REMIND_HOUR,
          minute: 0,
          channelId: CHANNEL_ID,
        },
      });
    } else if (remind.getTime() > today.getTime()) {
      // 农历：仅今年一次性（明年打开 App 时重排换算）
      await N.scheduleNotificationAsync({
        content,
        trigger: {
          type: N.SchedulableTriggerInputTypes.DATE,
          date: remind.getTime(),
          channelId: CHANNEL_ID,
        },
      });
    }
  }

  // T23：节日纳入提醒调度（spec 6 / 8，plan.md 1.5）
  // 公历节日 → 对所有已开启提醒的联系人；农历节日 → 仅关系「家人」。
  const festivals = await fetchFestivals();
  for (const festival of festivals) {
    const occur = festivalNextOccurrence(festival, today);
    const remind = new Date(occur.date);
    remind.setHours(REMIND_HOUR, 0, 0, 0);
    remind.setDate(remind.getDate() - settings.remind_days);

    const eligible = Array.from(enabled.values()).filter(
      (c) => festival.calendar === 'solar' || c.relation === '家人',
    );
    if (!eligible.length) continue;

    for (const contact of eligible) {
      const content: ExpoNotifications.NotificationContentInput = {
        title: `${contact.name} · ${festival.name}`,
        body: `还有 ${settings.remind_days} 天，心意已替你备好`,
        data: {
          type: 'kit',
          contactId: contact.id,
          dateId: null,
          festivalId: festival.id,
          occasionName: festival.name,
        } as ReminderData,
      };

      if (festival.rule === 'fixed' && festival.calendar === 'solar') {
        // 固定公历节日：按年循环兜底（今年已过则从明年起）
        await N.scheduleNotificationAsync({
          content,
          trigger: {
            type: N.SchedulableTriggerInputTypes.YEARLY,
            day: remind.getDate(),
            month: remind.getMonth() + 1,
            hour: REMIND_HOUR,
            minute: 0,
            channelId: CHANNEL_ID,
          },
        });
      } else if (remind.getTime() > today.getTime()) {
        // 浮动（nth_weekday）/ 农历节日：只排当年一次性（明年打开 App 重排换算）
        await N.scheduleNotificationAsync({
          content,
          trigger: {
            type: N.SchedulableTriggerInputTypes.DATE,
            date: remind.getTime(),
            channelId: CHANNEL_ID,
          },
        });
      }
    }
  }
}
