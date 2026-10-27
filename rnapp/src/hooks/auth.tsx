import { User } from '@supabase/supabase-js';
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { ensureSettings } from '@/lib/settings';
import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  /** 当前登录用户；未登录为 null */
  user: User | null;
  /** 首次从本地恢复会话期间为 true（Auth 守卫等待中） */
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true });

/**
 * 会话提供者（T05）：启动时从本地恢复会话，随后监听 Supabase Auth 变化；
 * 登录成功为用户初始化一行默认设置（T06，幂等、用户无感知）。
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 恢复 AsyncStorage 中持久化的会话
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // 监听后续会话变化（登录 / 登出 / token 刷新）
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = session?.user ?? null;
      setUser(next);
      if (next) {
        ensureSettings(next.id); // T06：确保默认设置行存在
      }
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo(() => ({ user, loading }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** 读取当前会话状态（须在 AuthProvider 内使用） */
export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
