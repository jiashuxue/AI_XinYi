import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { GenerateKitInput, GenerateKitResult, Kit } from '@/types/kit';

/**
 * 整套心意数据层（M4/M5/M6 复用）：
 * - 读取 kits 表（RLS 按用户隔离，user_id 由会话自动带上）；
 * - 调用 Edge Function generate-kit 生成（supabase.functions.invoke 自动携带用户 JWT）。
 * 参考 contacts.ts / settings.ts 的 TanStack Query 写法。
 */

/** 当前用户全部 kits（如「今日心意」聚合 / 预生成扫描用） */
export function useKits() {
  return useQuery({
    queryKey: ['kits'],
    queryFn: async (): Promise<Kit[]> => {
      const { data } = await supabase.from('kits').select('*');
      return (data ?? []) as Kit[];
    },
  });
}

/** 某位联系人的全部 kits（不同日期 / 节日各一份，data-model 2.5） */
export function useContactKits(contactId: string) {
  return useQuery({
    queryKey: ['kits', 'contact', contactId],
    enabled: !!contactId,
    queryFn: async (): Promise<Kit[]> => {
      const { data } = await supabase.from('kits').select('*').eq('contact_id', contactId);
      return (data ?? []) as Kit[];
    },
  });
}

/**
 * 读取「联系人 + 场景」对应的那一份整套心意：
 * - 带 scene（date_id / festival_id）→ 取该场景的 kit（唯一索引保证至多一条）；
 * - 不带 scene（从主页 / 通知直接进入）→ 取该联系人最近生成的一份（created_at 倒序第一条），
 *   供心意包页「未指明场景」时展示。
 */
export function useKit(contactId: string, scene?: { date_id?: string; festival_id?: number }) {
  return useQuery({
    queryKey: ['kits', 'contact', contactId, scene?.date_id ?? null, scene?.festival_id ?? null],
    enabled: !!contactId,
    queryFn: async (): Promise<Kit | null> => {
      let query = supabase.from('kits').select('*').eq('contact_id', contactId);
      if (scene?.date_id) query = query.eq('date_id', scene.date_id);
      if (scene?.festival_id) query = query.eq('festival_id', scene.festival_id);
      if (!scene?.date_id && !scene?.festival_id) {
        const { data } = await query.order('created_at', { ascending: false }).limit(1);
        return (data?.[0] as Kit) ?? null;
      }
      const { data } = await query.maybeSingle();
      return (data as Kit) ?? null;
    },
  });
}

/**
 * 调用 Edge Function generate-kit（M4 T19/T20、M5 T24、M6 T26/T28 共用）。
 * invoke 会自动附带当前登录用户的 JWT；Edge Function 据此解析 user_id 写入 kits（RLS 隔离）。
 */
export async function generateKit(input: GenerateKitInput): Promise<GenerateKitResult> {
  const { data, error } = await supabase.functions.invoke<GenerateKitResult>('generate-kit', {
    body: input,
  });
  if (error) throw error;
  if (!data?.kit) throw new Error('生成心意失败：未返回内容');
  return data;
}
