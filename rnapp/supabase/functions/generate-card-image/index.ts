import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Edge Function generate-card-image（M9 T33）。
 *
 * 职责：调火山方舟 doubao-seedream 文生图模型，为电子贺卡生成 3:4 竖版插画
 * （默认 1080×1440，满足火山方舟面积 ≥ 921600 像素的要求），返回图片 URL 与尺寸。
 *
 * 鉴权：仅校验请求携带的 Bearer JWT 是否属于已登录用户（本函数不写数据库，
 * 用 supabase.auth.getUser() 确认 JWT 有效即可）。API key 只读服务端环境变量
 * VOLC_ARK_API_KEY，严禁写进代码 / 字符串字面量 / 日志。
 *
 * 请求契约（与客户端 `src/lib/card-image.ts` 一致）：
 *   { prompt: string, size?: string }  // size 缺省 1080x1440
 *   响应：{ url, size, output_format }
 */

// ---------- CORS ----------

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

// ---------- 请求 / 响应契约 ----------

type GenerateCardImageInput = {
  prompt: string;
  size?: string;
};

type GenerateCardImageResult = {
  url: string;
  size: string;
  output_format: string;
};

// ---------- 常量 ----------

const VOLC_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
const VOLC_MODEL = 'doubao-seedream-5-0-flash-260915';
const DEFAULT_SIZE = '1080x1440'; // 3:4 竖版，火山方舟要求的面积下限之上

// ---------- 主处理器 ----------

Deno.serve(async (req: Request) => {
  // 预检
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json({ error: '仅支持 POST' }, 405);
  }

  // 1. 鉴权：解析 Bearer JWT，只确认登录有效即可（本函数不写数据库）
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return json({ error: '未登录（缺少 Authorization 头）' }, 401);
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: '服务端缺少 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY' }, 500);
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return json({ error: '登录已失效' }, 401);
  }

  // 2. 读取火山方舟 API key（只存 Supabase secrets，禁止写进代码）
  const apiKey = Deno.env.get('VOLC_ARK_API_KEY');
  if (!apiKey) {
    return json({ error: '服务端未配置 VOLC_ARK_API_KEY' }, 500);
  }

  // 3. 解析请求体
  let input: GenerateCardImageInput;
  try {
    input = (await req.json()) as GenerateCardImageInput;
  } catch {
    return json({ error: '请求体不是合法 JSON' }, 400);
  }
  const prompt = (input?.prompt ?? '').trim();
  if (!prompt) {
    return json({ error: '缺少必填参数（prompt）' }, 400);
  }
  const size = (input?.size ?? '').trim() || DEFAULT_SIZE;

  // 4. 调火山方舟文生图（OpenAI 兼容图像生成接口）
  let res: Response;
  try {
    res = await fetch(VOLC_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: VOLC_MODEL,
        prompt,
        response_format: 'url',
        size,
        stream: false,
        watermark: true,
      }),
    });
  } catch (e) {
    console.error('generate-card-image 火山方舟请求失败：', (e as Error).message);
    return json({ error: '插画生成失败：网络异常，请稍后重试' }, 502);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    // 透传上游 status 与片段便于排查；响应片段不含密钥
    console.error('generate-card-image 火山方舟返回错误：', res.status, detail.slice(0, 500));
    return json({ error: `插画生成失败（${res.status}）${detail.slice(0, 200)}` }, 502);
  }

  // 5. 解析返回的图片地址
  let data: {
    data?: Array<{ url?: string; size?: string; output_format?: string }>;
  };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    return json({ error: '插画生成失败：上游返回不是合法 JSON' }, 502);
  }

  const image = data?.data?.[0];
  if (!image?.url) {
    return json({ error: '插画生成失败：上游未返回图片 URL' }, 502);
  }

  const result: GenerateCardImageResult = {
    url: image.url,
    size: image.size ?? size,
    output_format: image.output_format ?? 'png',
  };
  return json(result);
});
