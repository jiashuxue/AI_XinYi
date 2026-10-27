import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

// 连接信息来自 .env（EXPO_PUBLIC_ 前缀会在打包时内联）
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '缺少 Supabase 连接配置：请在 rnapp/.env 中设置 EXPO_PUBLIC_SUPABASE_URL 与 EXPO_PUBLIC_SUPABASE_ANON_KEY。'
  );
}

/**
 * SSR 兼容：Expo Router 会在 Node 环境执行本模块做 web 渲染，而 AsyncStorage 的
 * getItem 依赖 window/localStorage，此时若把 AsyncStorage 交给 supabase-js 会崩溃。
 * 因此仅在有 window（客户端 / RN）时使用 AsyncStorage 持久化会话；Node 渲染环境
 * 交给 supabase-js 默认的内存 storage，且不持久化，仅用于渲染。
 */
const isSSR = typeof window === 'undefined';

/**
 * 客户端请求层唯一入口（T07）。会话持久化到 AsyncStorage；数据读写由 Supabase RLS 隔离。
 */
export const supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
  auth: {
    ...(isSSR
      ? { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
      : {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false, // RN 无需从 URL 中解析会话
        }),
  },
});
