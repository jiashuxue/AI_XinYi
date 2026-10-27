import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';

export type Contact = {
  id: string;
  name: string;
  relation: string | null;
  features: string | null;
  reminders_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type ContactDate = {
  id: string;
  contact_id: string;
  date_type: 'birthday' | 'anniversary';
  calendar: 'solar' | 'lunar';
  month: number;
  day: number;
};

export type DateInput = {
  date_type: 'birthday' | 'anniversary';
  calendar: 'solar' | 'lunar';
  month: number;
  day: number;
};

/** 关系预设（spec 1 / 已拍板，plan.md 关键决策 #4）；自定义关系由用户输入 */
export const RELATIONS = ['家人', '恋人', '挚友', '好友', '同事', '师长'] as const;

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('未登录');
  return data.user.id;
}

// ---------- 查询 ----------

/** 联系人 + 全部日期（列表页需要按联系人聚合最近日期）；未登录返回空 */
export function useContacts() {
  return useQuery({
    queryKey: ['contacts'],
    queryFn: async (): Promise<{ contacts: Contact[]; dates: ContactDate[] }> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return { contacts: [], dates: [] };
      const [{ data: contacts }, { data: dates }] = await Promise.all([
        supabase.from('contacts').select('*').order('created_at', { ascending: true }),
        supabase.from('dates').select('*'),
      ]);
      return { contacts: contacts ?? [], dates: dates ?? [] };
    },
  });
}

/** 单个联系人 + 其日期（详情 / 编辑页） */
export function useContact(id: string) {
  return useQuery({
    queryKey: ['contacts', id],
    enabled: !!id,
    queryFn: async (): Promise<{ contact: Contact | null; dates: ContactDate[] }> => {
      const [{ data: contact }, { data: dates }] = await Promise.all([
        supabase.from('contacts').select('*').eq('id', id).maybeSingle(),
        supabase.from('dates').select('*').eq('contact_id', id),
      ]);
      return { contact, dates: dates ?? [] };
    },
  });
}

// ---------- 变更 ----------

async function replaceDates(contactId: string, dates: DateInput[], userId: string) {
  if (!dates.length) return;
  // dates.user_id 为 NOT NULL（RLS 隔离依据），必须显式带上当前用户
  const rows = dates.map((d) => ({ ...d, contact_id: contactId, user_id: userId }));
  const { error } = await supabase.from('dates').insert(rows);
  if (error) throw error;
}

/** 新建联系人（T09/T10），含 10 位上限校验（T12） */
export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      relation: string | null;
      features: string | null;
      dates: DateInput[];
    }) => {
      const userId = await currentUserId();

      // T12：应用层校验每位用户最多 10 位（spec 1）
      const { count } = await supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);
      if ((count ?? 0) >= 10) {
        throw new Error('每位用户最多可录入 10 位联系人');
      }

      const { data: contact, error } = await supabase
        .from('contacts')
        .insert({
          user_id: userId,
          name: input.name.trim(),
          relation: input.relation,
          features: input.features || null,
        })
        .select('*')
        .single();
      if (error) throw error;

      await replaceDates(contact.id, input.dates, userId);
      return contact;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      router.back();
    },
  });
}

/** 编辑联系人：更新 contacts 行，删除旧日期后重建（T09/T10） */
export function useUpdateContact(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      relation: string | null;
      features: string | null;
      dates: DateInput[];
    }) => {
      const userId = await currentUserId();
      const { error } = await supabase
        .from('contacts')
        .update({ name: input.name.trim(), relation: input.relation, features: input.features || null })
        .eq('id', id);
      if (error) throw error;

      const { error: delErr } = await supabase.from('dates').delete().eq('contact_id', id);
      if (delErr) throw delErr;

      await replaceDates(id, input.dates, userId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      router.back();
    },
  });
}

/** 单个联系人提醒开关（T11，reminders_enabled） */
export function useToggleReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reminders_enabled }: { id: string; reminders_enabled: boolean }) => {
      const { error } = await supabase
        .from('contacts')
        .update({ reminders_enabled })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

/** 删除联系人：数据库级联移除其 dates 与 kits（T12 / spec 4） */
export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('contacts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      router.back();
    },
  });
}
