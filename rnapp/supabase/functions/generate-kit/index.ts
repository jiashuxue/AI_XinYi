import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Edge Function generate-kit（T18 + T19 后端分支，plan.md 1.4 / spec 9、11）。
 *
 * 职责：调 DeepSeek（OpenAI 兼容接口，密钥只存服务端环境变量）生成祝福文案与礼物建议，
 * 结果 upsert 写入 kits 表（复用同一行，避免重复调用 AI）。
 *
 * 鉴权：用请求携带的 Bearer JWT 解析当前用户，写入 kits 的 user_id 取自 auth.uid()，
 * 严禁客户端传 user_id（防伪造，RLS WITH CHECK 兜底）。
 *
 * 生成契约（与客户端 `src/hooks/kits.ts` 一致）：
 *   GenerateKitInput = {
 *     contact: { id, name, relation, features },
 *     occasion: { date_id?, festival_id?, occasion_name },
 *     blessing_count,            // 1~5，默认 3
 *     previous_batch?,           // 「换一批」时携带旧批，避免重复
 *     skip_features?,            // 用户选择跳过补特征：礼物按关系给通用建议
 *   }
 *   响应：{ kit: { id, contact_id, date_id, festival_id, occasion_name,
 *                 blessings, gift_suggestions, status: 'ready' | 'partial' } }
 *
 * 特征为空分支（spec 9 / 11）：
 *   - features 为空 & skip_features=false → 祝福不生成（blessings:[]）、礼物不生成、status='partial'
 *     （前端据此引导用户补充特征）；
 *   - features 为空 & skip_features=true  → 祝福仍为空，礼物按关系给通用建议 3 条、status='partial'。
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

type GenerateKitInput = {
  contact: { id: string; name: string; relation: string | null; features: string | null };
  occasion: { date_id?: string | null; festival_id?: number | null; occasion_name: string };
  blessing_count: number;
  previous_batch?: string[];
  skip_features?: boolean;
};

type GiftSuggestion = { title: string; keyword: string };

type KitResult = {
  id: string;
  contact_id: string;
  date_id: string | null;
  festival_id: number | null;
  occasion_name: string;
  blessings: string[];
  gift_suggestions: GiftSuggestion[];
  status: 'ready' | 'partial';
};

// ---------- 常量 ----------

const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat'; // OpenAI 兼容格式，模型 ID 以官方最新为准（plan.md 1.4）
const GIFT_COUNT = 3; // 礼物建议固定 3 条（spec 11）

/** 特征为空、用户选择跳过时，按关系给通用礼物建议（spec 11） */
function genericGiftsByRelation(relation: string | null): GiftSuggestion[] {
  switch (relation) {
    case '家人':
      return [
        { title: '暖心围巾', keyword: '冬季围巾 保暖' },
        { title: '养生茶礼盒', keyword: '养生茶 礼盒' },
        { title: '合照相框', keyword: '定制相框 纪念' },
      ];
    case '恋人':
      return [
        { title: '情侣对戒', keyword: '情侣对戒 银' },
        { title: '香薰蜡烛礼盒', keyword: '香薰蜡烛 礼盒' },
        { title: '手账本套装', keyword: '手账本 套装' },
      ];
    case '挚友':
    case '好友':
      return [
        { title: '蓝牙音箱', keyword: '便携蓝牙音箱' },
        { title: '文创盲盒', keyword: '文创 盲盒' },
        { title: '奶茶券', keyword: '奶茶 兑换券' },
      ];
    case '同事':
      return [
        { title: '桌面绿植', keyword: '桌面绿植 盆栽' },
        { title: '保温杯', keyword: '保温杯 大容量' },
        { title: '手冲咖啡套装', keyword: '手冲咖啡 套装' },
      ];
    case '师长':
      return [
        { title: '钢笔礼盒', keyword: '钢笔 礼盒 墨水' },
        { title: '茶叶礼盒', keyword: '茶叶 礼盒 高端' },
        { title: '按摩靠枕', keyword: '颈椎按摩 靠枕' },
      ];
    default: // 自定义关系
      return [
        { title: '盲盒小惊喜', keyword: '惊喜盲盒 礼物' },
        { title: '定制礼物', keyword: '定制礼物 刻字' },
        { title: '甜品礼盒', keyword: '甜品 礼盒 分享' },
      ];
  }
}

/** 礼物建议去重（按 title + keyword 判重，保序） */
function dedupeGifts(gifts: GiftSuggestion[]): GiftSuggestion[] {
  const seen = new Set<string>();
  const out: GiftSuggestion[] = [];
  for (const g of gifts) {
    const key = `${g.title}|${g.keyword}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(g);
  }
  return out;
}

/**
 * 保证礼物建议固定 3 条（spec 11）：
 * LLM 少返回时，用该关系的通用建议补齐（去重后截断到 3 条）。
 */
function ensureThreeGifts(gifts: GiftSuggestion[], relation: string | null): GiftSuggestion[] {
  const merged = dedupeGifts([...gifts, ...genericGiftsByRelation(relation)]);
  return merged.slice(0, GIFT_COUNT);
}

/** 从 LLM 输出里提取 JSON（容忍 markdown 代码块包裹 / 前后多余文本） */
function extractJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('LLM 未返回合法 JSON');
  return JSON.parse(cleaned.slice(start, end + 1));
}

/** 调 DeepSeek 生成祝福 + 礼物，返回 { blessings, gift_suggestions } */
async function generateByDeepSeek(
  input: GenerateKitInput,
  apiKey: string,
): Promise<{ blessings: string[]; gift_suggestions: GiftSuggestion[] }> {
  const { contact, occasion, blessing_count: count, previous_batch } = input;

  const system =
    '你是替用户为「在乎的人」撰写心意的助手。请根据对方特征与关系，生成贴合、真诚、' +
    '互不重复的祝福文案，并附上贴合对方的礼物建议。' +
    '规则：1) 祝福文案自动带上对方称呼（用对方姓名开头或称呼），不自动署名；' +
    '2) 礼物建议每条附一个明确的搜索关键词。' +
    '3) 只输出 JSON，格式：{"blessings":["文案1","文案2",...],"gift_suggestions":[{"title":"建议名称","keyword":"搜索关键词"},...]}，不要输出任何解释文字。';

  const user = [
    `联系人：姓名「${contact.name}」` + (contact.relation ? `，关系「${contact.relation}」` : '') +
      (contact.features ? `，特征描述：「${contact.features}」` : ''),
    `场景：${occasion.occasion_name}`,
    `祝福条数：${count} 条（1~5）。`,
    previous_batch && previous_batch.length
      ? `上一批祝福文案（请勿与其中任何一条重复）：\n${previous_batch.map((b) => `- ${b}`).join('\n')}`
      : '',
    `礼物建议：固定 ${GIFT_COUNT} 条。`,
    `请输出以上 JSON。`,
  ]
    .filter(Boolean)
    .join('\n');

  const res = await fetch(DEEPSEEK_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.9,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`DeepSeek 请求失败（${res.status}）${detail.slice(0, 200)}`);
  }

  const data = await res.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('DeepSeek 返回为空');

  const parsed = extractJson(content) as {
    blessings?: unknown;
    gift_suggestions?: unknown;
  };

  const blessings = Array.isArray(parsed.blessings)
    ? (parsed.blessings as unknown[]).filter((b): b is string => typeof b === 'string')
    : [];
  const rawGifts = Array.isArray(parsed.gift_suggestions)
    ? (parsed.gift_suggestions as unknown[])
    : [];
  const gift_suggestions = rawGifts
    .filter(
      (g): g is { title: string; keyword: string } =>
        typeof g === 'object' &&
        g !== null &&
        typeof (g as { title?: unknown }).title === 'string' &&
        typeof (g as { keyword?: unknown }).keyword === 'string',
    )
    .slice(0, GIFT_COUNT);

  if (blessings.length === 0 && gift_suggestions.length === 0) {
    throw new Error('DeepSeek 未返回有效内容');
  }
  return { blessings, gift_suggestions };
}

// ---------- 主处理器 ----------

Deno.serve(async (req: Request) => {
  // 预检
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json({ error: '仅支持 POST' }, 405);
  }

  // 1. 鉴权：解析 Bearer JWT，得到当前用户（user_id 以此为准）
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
  const userId = user.id;

  // 2. 解析请求体
  let input: GenerateKitInput;
  try {
    input = (await req.json()) as GenerateKitInput;
  } catch {
    return json({ error: '请求体不是合法 JSON' }, 400);
  }
  if (!input?.contact?.name || !input?.occasion?.occasion_name) {
    return json({ error: '缺少必填参数（contact.name / occasion.occasion_name）' }, 400);
  }

  const blessingCount = Math.min(5, Math.max(1, Math.round(input.blessing_count ?? 3)));
  const contactId = input.contact.id;
  const { date_id = null, festival_id = null } = input.occasion;
  if (!date_id && !festival_id) {
    return json({ error: 'date_id 与 festival_id 至少一个非空' }, 400);
  }

  // 3. 特征为空分支（spec 9 / 11）
  const hasFeatures = (input.contact.features ?? '').trim().length > 0;
  let blessings: string[] = [];
  let giftSuggestions: GiftSuggestion[] = [];
  let status: 'ready' | 'partial' = 'ready';

  if (input.skip_features) {
    // 用户选择跳过：不调 DeepSeek，祝福不生成，礼物按关系给通用建议（spec 11，最高优先级）
    giftSuggestions = genericGiftsByRelation(input.contact.relation);
    status = 'partial';
  } else if (!hasFeatures) {
    // 特征缺失且用户未选择跳过：祝福 / 礼物都不生成，前端引导补特征
    status = 'partial';
  } else {
    // 正常路径：调 DeepSeek 生成
    const apiKey = Deno.env.get('DEEPSEEK_API_KEY');
    if (!apiKey) {
      return json({ error: '服务端未配置 DEEPSEEK_API_KEY' }, 500);
    }
    try {
      const generated = await generateByDeepSeek(input, apiKey);
      blessings = generated.blessings.slice(0, blessingCount);
      // 礼物建议固定 3 条：LLM 少返回时用通用建议补齐，避免不足 3 条
      giftSuggestions = ensureThreeGifts(generated.gift_suggestions, input.contact.relation);
    } catch (e) {
      console.error('generate-kit DeepSeek 调用失败：', (e as Error).message);
      // 透传具体原因便于排查（message 只含 DeepSeek status 与响应片段，不含密钥）
      return json({ error: '心意生成失败：' + (e as Error).message }, 500);
    }
  }

  // 4. 写入 kits 表（复用同一行：date 或 festival 场景）
  // 说明：迁移中的 kits_unique_by_date / kits_unique_by_festival 是「部分唯一索引」（带
  // WHERE 谓词），PostgREST 的 on_conflict 无法为部分唯一索引推断 ON CONFLICT 目标
  // （会报 42P10），故改为「先查已有行，再 update 或 insert」；DB 的部分唯一索引仍作并发兜底。
  const kitRow = {
    user_id: userId,
    contact_id: contactId,
    date_id,
    festival_id,
    occasion_name: input.occasion.occasion_name,
    blessings,
    gift_suggestions: giftSuggestions,
    status,
  };

  // 查该场景是否已有 kit 行（date 场景按 date_id，festival 场景按 festival_id）
  const baseFind = supabase
    .from('kits')
    .select('id')
    .eq('user_id', userId)
    .eq('contact_id', contactId);
  const findQuery = date_id
    ? baseFind.eq('date_id', date_id)
    : baseFind.eq('festival_id', festival_id as number);
  const { data: existing, error: findError } = await findQuery.maybeSingle();
  if (findError) {
    console.error('generate-kit 查询已有心意失败：', findError.message);
    return json({ error: '保存心意失败' }, 500);
  }

  const { data: kit, error } = existing
    ? await supabase.from('kits').update(kitRow).eq('id', existing.id).select('*').single()
    : await supabase.from('kits').insert(kitRow).select('*').single();
  if (error) {
    console.error('generate-kit 写入失败：', error.message);
    return json({ error: '保存心意失败' }, 500);
  }

  const result: KitResult = {
    id: kit.id,
    contact_id: kit.contact_id,
    date_id: kit.date_id,
    festival_id: kit.festival_id,
    occasion_name: kit.occasion_name,
    blessings: kit.blessings,
    gift_suggestions: kit.gift_suggestions,
    status: kit.status,
  };

  return json({ kit: result });
});
