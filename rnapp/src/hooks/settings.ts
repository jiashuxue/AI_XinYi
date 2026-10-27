import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type Settings = {
  user_id: string;
  remind_days: number;
  blessing_count: number;
  ecommerce_platform: string;
  notifications_enabled: boolean;
};

/** 当前用户设置（settings 表，每用户一行；T06 已保证存在）；未登录返回 null */
export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase.from('settings').select('*').maybeSingle();
      if (error) throw error;
      return data as Settings | null;
    },
  });
}

/** 更新设置的单个或多个字段（T13：提前天数 / 祝福条数 / 平台 / 总开关） */
export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Pick<Settings, 'remind_days' | 'blessing_count' | 'ecommerce_platform' | 'notifications_enabled'>>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('未登录');
      const { error } = await supabase.from('settings').update(patch).eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

/** 默认电商平台选项（spec 12 / 已拍板决策 #6，全保留可切换） */
export const PLATFORMS = ['淘宝', '京东', '拼多多', '抖音电商'] as const;
