# AI 心意管家 · 数据模型（data-model.md）

> **依据与约束**
> - 本文件以 spec.md（产品规格）与 plan.md（技术计划）为唯一依据，字段名、表名、枚举值与两者保持一致，未改写、未新增业务功能。
> - 目标平台为 Supabase（Postgres + Auth + RLS）。附录 A 提供了可直接执行的建表 SQL。
> - 所有业务数据表除 `festivals`（内置、公开读）外均开启行级安全（RLS），仅本人（`auth.uid()`）可读写——对应 spec 隐私承诺「联系人信息仅用于为用户本人生成心意，App 不对外共享」。

---

## 一、数据模型总览

```
auth.users（Supabase Auth 自带）
   │ 1 ──── 1 ──── settings（用户设置：每用户一行）
   │ 1 ──── N ──── contacts（联系人）
   │                    │ 1 ──── N ──── dates（特殊日期）
   │                    └──── 1 ──── N ──── kits（整套心意）
   └─────── 1 ──── N ──── kits（kits.user_id 冗余，便于 RLS 与查询）
                                            ▲
                                            │ festival_id
                        festivals（内置节日表，公开读）── 1 ──── N ──── kits
```

共 5 张业务表：`contacts`、`dates`、`settings`、`festivals`、`kits`。其中 `festivals` 为内置种子数据（15 条），无用户归属。

---

## 二、表定义

### 2.1 `contacts`（联系人）

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|:---:|--------|------|
| id | `uuid` | 是 | `gen_random_uuid()` | 主键 |
| user_id | `uuid` | 是 | — | 归属用户，FK → auth.users，RLS 隔离 |
| name | `text` | 是 | — | 姓名（spec 1：必填项） |
| relation | `text` | 否 | — | 关系：家人 / 恋人 / 挚友 / 好友 / 同事 / 师长 / 自定义，一位联系人只选一个；预设在应用层，数据库不限枚举（自定义关系） |
| features | `text` | 否 | — | 特征描述，可缺省、之后随时补充（spec 1 / 3） |
| reminders_enabled | `boolean` | 是 | `true` | 每位联系人的提醒可单独关闭（spec 5） |
| created_at / updated_at | `timestamptz` | 是 | `now()` | 创建 / 更新时间 |

业务规则：每位用户最多可录入 10 位联系人（spec 1）；应用层校验，数据库触发器兜底（见附录 A 可选段）。

### 2.2 `dates`（特殊日期）

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|:---:|--------|------|
| id | `uuid` | 是 | `gen_random_uuid()` | 主键 |
| user_id | `uuid` | 是 | — | 归属用户（冗余，便于 RLS 与查询），FK → auth.users |
| contact_id | `uuid` | 是 | — | 归属联系人，FK → contacts（ON DELETE CASCADE） |
| date_type | `text` | 是 | — | `birthday`（生日）/ `anniversary`（纪念日） |
| calendar | `text` | 是 | — | `solar`（公历）/ `lunar`（农历） |
| month | `int` | 是 | — | 月（1～12） |
| day | `int` | 是 | — | 日（1～31） |
| created_at | `timestamptz` | 是 | `now()` | 创建时间 |

业务规则（spec 2 / 8）：

- 一位联系人可填多个特殊日期（1 个生日 + 多个纪念日，纪念日不区分具体类型）。
- 生日只能在公历与农历中二选一，不可两者并存——用部分唯一索引强制：每个联系人最多一条 `date_type='birthday'`。
- 农历仅允许用于生日（纪念日恒为公历）。
- 日期可缺省、随时补录；保存后每年临近触发提醒（跨年换算在应用层完成，见 plan.md 1.5）。

### 2.3 `settings`（用户设置）

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|:---:|--------|------|
| user_id | `uuid` | 是 | — | 主键，FK → auth.users，每用户一行 |
| remind_days | `int` | 是 | `3` | 提前天数，允许 1～14（spec 5，全局统一） |
| blessing_count | `int` | 是 | `3` | 祝福文案条数，允许 1～5（spec 9） |
| ecommerce_platform | `text` | 是 | `'淘宝'` | 默认电商平台，可随时切换（spec 12）：淘宝 / 京东 / 拼多多 / 抖音电商 |
| notifications_enabled | `boolean` | 是 | `true` | 一键关闭全部提醒（spec 5） |
| created_at / updated_at | `timestamptz` | 是 | `now()` | 创建 / 更新时间 |

### 2.4 `festivals`（内置节日表，种子数据，公开读）

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|:---:|--------|------|
| id | `int` | 是 | — | 主键 |
| name | `text` | 是 | — | 节日名，spec 原文：元旦、情人节、妇女节、劳动节、母亲节、父亲节、教师节、国庆节、感恩节、圣诞节（公历 10 个）+ 春节、元宵节、端午节、中秋节、重阳节（农历 5 个） |
| calendar | `text` | 是 | — | `solar`（公历）/ `lunar`（农历） |
| rule | `text` | 是 | — | `fixed`（固定月日）/ `nth_weekday`（第 N 个星期几，用于母亲节、父亲节、感恩节） |
| month | `int` | 是 | — | 月（1～12），两种规则都用 |
| day | `int` | 否 | — | 日（1～31），仅 `fixed` 规则使用 |
| weekday | `int` | 否 | — | 星期几（0=周日 … 6=周六），仅 `nth_weekday` 规则使用 |
| occurrence | `int` | 否 | — | 第几个星期几，仅 `nth_weekday` 规则使用（如母亲节 = 5 月第 2 个周日） |
| relation_only | `text` | 否 | — | `family`：农历节日仅对关系为「家人」的联系人；公历节日为 NULL（spec 8） |

业务规则（spec 6 / 8）：第一版仅内置、不可自定义增删；10 公历节日对所有已录入联系人生成心意，5 农历节日仅对 `relation='家人'` 的联系人。

### 2.5 `kits`（整套心意，预生成缓存）

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|:---:|--------|------|
| id | `uuid` | 是 | `gen_random_uuid()` | 主键 |
| user_id | `uuid` | 是 | — | 归属用户（冗余），FK → auth.users |
| contact_id | `uuid` | 是 | — | 归属联系人，FK → contacts（ON DELETE CASCADE，删除联系人一并移除其心意，spec 4） |
| date_id | `uuid` | 否 | — | 关联 dates（生日 / 纪念日）；与 festival_id 至少一个非空 |
| festival_id | `int` | 否 | — | 关联 festivals（节日）；与 date_id 至少一个非空 |
| occasion_name | `text` | 是 | — | 贺卡「日期名称」：生日 / 纪念日 / 节日名（如「中秋节」） |
| blessings | `jsonb` | 是 | — | 祝福文案数组，条数 = settings.blessing_count（1～5，默认 3），互不重复、带称呼、不署名 |
| gift_suggestions | `jsonb` | 是 | — | 礼物建议数组，固定 3 条，每条 `{ "title": "建议名称", "keyword": "搜索关键词" }` |
| status | `text` | 是 | `'ready'` | `ready` / `partial`（降级：某项未能生成时，spec 7） |
| created_at / updated_at | `timestamptz` | 是 | `now()` | 创建 / 更新时间 |

业务规则（spec 7 / plan.md 1.4）：

- 每位联系人的心意分别生成；节日场景对每个符合条件的联系人各生成一份 kit。
- 同一 `(user_id, contact_id, date_id)` 或 `(user_id, contact_id, festival_id)` 唯一，生成 / 换一批复用同一行（upsert），避免重复调用 AI。

---

## 三、表与表的关系

| 表 A | 关系 | 表 B | 外键字段 | 说明 |
|------|------|------|----------|------|
| auth.users | 1 → N | contacts | contacts.user_id | 一个用户可有多位联系人 |
| auth.users | 1 → N | dates | dates.user_id | 冗余字段，RLS 与跨表查询用 |
| auth.users | 1 → N | kits | kits.user_id | 冗余字段，RLS 与跨表查询用 |
| auth.users | 1 → 1 | settings | settings.user_id | 每用户一行设置 |
| contacts | 1 → N | dates | dates.contact_id | 一位联系人可填多个特殊日期 |
| contacts | 1 → N | kits | kits.contact_id | 一位联系人可有多份整套心意（不同日期 / 节日各一份） |
| dates | 1 → N | kits | kits.date_id | 一个日期（生日 / 纪念日）对应一份整套心意 |
| festivals | 1 → N | kits | kits.festival_id | 一个节日对每位符合条件的联系人各生成一份整套心意 |

外键级联：删除用户 → 级联删除其全部数据；删除联系人 → 级联删除其 dates 与 kits（spec 4「删除后其相关提醒与内容一并移除」）；删除日期 → 级联删除对应 kit。

---

## 四、关键索引

| 索引 | 类型 | 目的 |
|------|------|------|
| contacts(user_id) | 普通 | 按用户列出联系人 |
| dates(user_id) | 普通 | 按用户查询日期（主页 30 天、提醒调度） |
| dates(contact_id) | 普通 | 按联系人查日期（详情页） |
| dates(contact_id) WHERE date_type='birthday' | 部分唯一 | 强制生日二选一（每联系人最多一条生日） |
| kits(user_id) | 普通 | 按用户查询整套心意 |
| kits(contact_id) | 普通 | 按联系人查询心意 |
| kits(festival_id) | 普通 | 节日场景聚合（某节日各联系人心意） |
| kits(user_id, contact_id, date_id) WHERE date_id IS NOT NULL | 部分唯一 | 同一日期只生成一份，upsert 复用 |
| kits(user_id, contact_id, festival_id) WHERE festival_id IS NOT NULL | 部分唯一 | 同一节日同一联系人只生成一份 |

---

## 五、行级安全（RLS）

| 表 | 策略 | 规则 |
|----|------|------|
| contacts | `user_id = auth.uid()` | 仅本人可读写 |
| dates | `user_id = auth.uid()` | 仅本人可读写 |
| settings | `user_id = auth.uid()` | 仅本人可读写 |
| kits | `user_id = auth.uid()` | 仅本人可读写 |
| festivals | `using true`（仅 SELECT） | 内置节日，所有人可读、不开放写入（种子由迁移脚本 / service_role 维护） |

> 实现提示：`user_id` 字段与 `auth.uid()` 的对应是 RLS 的唯一依据，应用层写入时必须由服务端会话填充该字段，防止用户伪造他人 user_id（RLS `WITH CHECK` 已拦截）。

---

## 六、种子数据：`festivals`（15 条）

| id | name | calendar | rule | month | day | weekday | occurrence | relation_only |
|----|------|----------|------|-------|-----|---------|------------|---------------|
| 1 | 元旦 | solar | fixed | 1 | 1 | NULL | NULL | NULL |
| 2 | 情人节 | solar | fixed | 2 | 14 | NULL | NULL | NULL |
| 3 | 妇女节 | solar | fixed | 3 | 8 | NULL | NULL | NULL |
| 4 | 劳动节 | solar | fixed | 5 | 1 | NULL | NULL | NULL |
| 5 | 母亲节 | solar | nth_weekday | 5 | NULL | 0（周日） | 2 | NULL |
| 6 | 父亲节 | solar | nth_weekday | 6 | NULL | 0（周日） | 3 | NULL |
| 7 | 教师节 | solar | fixed | 9 | 10 | NULL | NULL | NULL |
| 8 | 国庆节 | solar | fixed | 10 | 1 | NULL | NULL | NULL |
| 9 | 感恩节 | solar | nth_weekday | 11 | NULL | 4（周四） | 4 | NULL |
| 10 | 圣诞节 | solar | fixed | 12 | 25 | NULL | NULL | NULL |
| 11 | 春节 | lunar | fixed | 1 | 1 | NULL | NULL | family |
| 12 | 元宵节 | lunar | fixed | 1 | 15 | NULL | NULL | family |
| 13 | 端午节 | lunar | fixed | 5 | 5 | NULL | NULL | family |
| 14 | 中秋节 | lunar | fixed | 8 | 15 | NULL | NULL | family |
| 15 | 重阳节 | lunar | fixed | 9 | 9 | NULL | NULL | family |

`weekday` 约定：0=周日，1=周一，…，6=周六。农历节日按农历月日换算当年公历（lunar-javascript，闰月以当年实际对应日为准）。

---

## 附录 A：建表 SQL（可直接在 Supabase SQL 编辑器执行）

```sql
-- ============================================================
-- AI 心意管家 · Supabase 数据模型
-- 前提：已创建 Supabase 项目（auth.users 为 Auth 自带表）
-- ============================================================

-- ---------- 1. contacts 联系人 ----------
create table contacts (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users (id) on delete cascade,
  name              text        not null,
  relation          text,
  features          text,
  reminders_enabled boolean     not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---------- 2. dates 特殊日期 ----------
create table dates (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  contact_id uuid        not null references contacts (id) on delete cascade,
  date_type  text        not null check (date_type in ('birthday', 'anniversary')),
  calendar   text        not null check (calendar in ('solar', 'lunar')),
  month      int         not null check (month between 1 and 12),
  day        int         not null check (day between 1 and 31),
  created_at timestamptz not null default now(),
  -- 农历仅允许用于生日（纪念日恒为公历）
  check (not (date_type = 'anniversary' and calendar = 'lunar'))
);

-- 生日二选一：每个联系人最多一条生日
create unique index dates_one_birthday_per_contact
  on dates (contact_id) where date_type = 'birthday';

-- ---------- 3. settings 用户设置 ----------
create table settings (
  user_id              uuid        primary key references auth.users (id) on delete cascade,
  remind_days          int         not null default 3 check (remind_days between 1 and 14),
  blessing_count       int         not null default 3 check (blessing_count between 1 and 5),
  ecommerce_platform   text        not null default '淘宝'
                                    check (ecommerce_platform in ('淘宝', '京东', '拼多多', '抖音电商')),
  notifications_enabled boolean    not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ---------- 4. festivals 内置节日表 ----------
create table festivals (
  id            int  primary key,
  name          text not null,
  calendar      text not null check (calendar in ('solar', 'lunar')),
  rule          text not null check (rule in ('fixed', 'nth_weekday')),
  month         int  not null check (month between 1 and 12),
  day           int  check (day between 1 and 31),
  weekday       int  check (weekday between 0 and 6),
  occurrence    int,
  relation_only text,
  -- fixed：必须填 day，不可填 weekday/occurrence；nth_weekday：必须填 weekday/occurrence，day 为空
  check (
    (rule = 'fixed'       and day is not null and weekday is null and occurrence is null) or
    (rule = 'nth_weekday' and day is null and weekday is not null and occurrence is not null)
  )
);

-- ---------- 5. kits 整套心意 ----------
create table kits (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users (id) on delete cascade,
  contact_id       uuid        not null references contacts (id) on delete cascade,
  date_id          uuid        references dates (id) on delete cascade,
  festival_id      int         references festivals (id),
  occasion_name    text        not null,
  blessings        jsonb       not null,
  gift_suggestions jsonb       not null,
  status           text        not null default 'ready' check (status in ('ready', 'partial')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- 生日/纪念日 与 节日 至少一个非空
  check (date_id is not null or festival_id is not null)
);

-- 同一日期 / 同一节日 + 同一联系人只生成一份
create unique index kits_unique_by_date
  on kits (user_id, contact_id, date_id) where date_id is not null;
create unique index kits_unique_by_festival
  on kits (user_id, contact_id, festival_id) where festival_id is not null;

-- ---------- 索引 ----------
create index contacts_user_id     on contacts (user_id);
create index dates_user_id        on dates (user_id);
create index dates_contact_id     on dates (contact_id);
create index kits_user_id         on kits (user_id);
create index kits_contact_id      on kits (contact_id);
create index kits_festival_id     on kits (festival_id);

-- ---------- updated_at 自动更新 ----------
create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger contacts_touch before update on contacts for each row execute function touch_updated_at();
create trigger settings_touch before update on settings for each row execute function touch_updated_at();
create trigger kits_touch     before update on kits     for each row execute function touch_updated_at();

-- ---------- 行级安全（RLS） ----------
alter table contacts  enable row level security;
alter table dates     enable row level security;
alter table settings  enable row level security;
alter table kits      enable row level security;
alter table festivals enable row level security;

-- 用户数据：仅本人可读写
create policy contacts_owner on contacts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy dates_owner on dates for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy settings_owner on settings for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy kits_owner on kits for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 节日表：仅公开读，不开放写入（种子由迁移脚本 / service_role 维护）
create policy festivals_read on festivals for select using (true);

-- ---------- 种子数据：festivals（15 条） ----------
insert into festivals (id, name, calendar, rule, month, day, weekday, occurrence, relation_only) values
  (1,  '元旦',   'solar', 'fixed',       1,  1,  null, null, null),
  (2,  '情人节', 'solar', 'fixed',       2, 14,  null, null, null),
  (3,  '妇女节', 'solar', 'fixed',       3,  8,  null, null, null),
  (4,  '劳动节', 'solar', 'fixed',       5,  1,  null, null, null),
  (5,  '母亲节', 'solar', 'nth_weekday', 5, null, 0,    2,    null),
  (6,  '父亲节', 'solar', 'nth_weekday', 6, null, 0,    3,    null),
  (7,  '教师节', 'solar', 'fixed',       9, 10,  null, null, null),
  (8,  '国庆节', 'solar', 'fixed',      10,  1,  null, null, null),
  (9,  '感恩节', 'solar', 'nth_weekday',11, null, 4,    4,    null),
  (10, '圣诞节', 'solar', 'fixed',      12, 25,  null, null, null),
  (11, '春节',   'lunar', 'fixed',       1,  1,  null, null, 'family'),
  (12, '元宵节', 'lunar', 'fixed',       1, 15,  null, null, 'family'),
  (13, '端午节', 'lunar', 'fixed',       5,  5,  null, null, 'family'),
  (14, '中秋节', 'lunar', 'fixed',       8, 15,  null, null, 'family'),
  (15, '重阳节', 'lunar', 'fixed',       9,  9,  null, null, 'family');

-- ============================================================
-- 可选：数据库层兜底「每位用户最多 10 位联系人」（主校验在应用层）
-- ============================================================
-- create or replace function enforce_max_contacts() returns trigger as $$
-- begin
--   if (select count(*) from contacts where user_id = new.user_id) >= 10 then
--     raise exception '每位用户最多可录入 10 位联系人';
--   end if;
--   return new;
-- end;
-- $$ language plpgsql;
--
-- create trigger contacts_max_10 before insert on contacts
--   for each row execute function enforce_max_contacts();
