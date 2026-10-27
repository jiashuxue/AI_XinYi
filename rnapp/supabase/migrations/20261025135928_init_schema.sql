-- ============================================================
-- AI 心意管家 · Supabase 数据模型（初始迁移）
-- 依据 data-model.md 附录 A，原样落地：建表 + 索引 + 约束 + 触发器 + RLS + 节日种子
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
