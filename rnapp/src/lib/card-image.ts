import { supabase } from '@/lib/supabase';

/**
 * 贺卡 AI 插画（M9 T34）：
 * 调用 Edge Function generate-card-image 生成 3:4 竖版插画（默认 1080×1440）。
 * `supabase.functions.invoke` 会自动携带当前登录用户的 JWT；错误时 throw，由调用方 Alert 展示。
 */

export type CardImageResult = {
  url: string;
  size: string;
  output_format: string;
};

export async function generateCardImage(
  prompt: string,
  size = '1080x1440',
): Promise<CardImageResult> {
  const { data, error } = await supabase.functions.invoke<CardImageResult>('generate-card-image', {
    body: { prompt, size },
  });
  if (error) throw error;
  if (!data?.url) throw new Error('生成插画失败：未返回图片地址');
  return data;
}
