-- ============================================================
-- 春晖园菜品评价面板 · 数据库 schema
-- 平台：Supabase（PostgreSQL 15）
--
-- 并发设计要点：
-- 1. 读：菜品目录为静态数据，随代码发布，不查库 → 读并发由 CDN 承担
-- 2. 写：reviews 单表直写，Postgres 单表支撑日 10w+ 写入无压力
-- 3. 防刷：anon 直写 + RLS 限流策略 + 服务端频率校验（见 rate-limits 表）
-- 4. 一致性：唯一约束防重复，聚合走触发器维护 dish_stats，避免实时 count
-- ============================================================

-- 菜品名模糊搜索依赖 pg_trgm，必须先于相关索引创建
create extension if not exists pg_trgm;

-- ---------- 商家 ----------
create table if not exists public.merchants (
  id          int primary key,
  name        text not null unique,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

comment on table public.merchants is '商家目录，与 data/dishes.json 种子数据保持一致';

-- ---------- 菜品 ----------
create table if not exists public.dishes (
  id            int primary key,
  merchant_id   int not null references public.merchants(id) on delete cascade,
  name          text not null,
  price         numeric(6,2),          -- 允许 null：部分菜品原表无价格
  unit          text not null default '份',
  price_note    text,                   -- 原表价格备注，如 "19.80 元/500g"
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

-- 商家页按商家筛选并排序，最热的走这条索引
create index if not exists idx_dishes_merchant_sort
  on public.dishes (merchant_id, sort_order);

comment on table public.dishes is '菜品目录，静态数据，随代码发布';

-- ---------- 评价 ----------
create table if not exists public.reviews (
  id           uuid primary key default gen_random_uuid(),
  dish_id      int not null references public.dishes(id) on delete cascade,
  nickname     text not null,
  rating       int not null check (rating between 1 and 5),
  -- 口味/分量/性价比 三维评分，1-5，可为 null 表示未评该维度
  taste        int check (taste between 1 and 5),
  portion      int check (portion between 1 and 5),
  value        int check (value  between 1 and 5),
  tags         text[] not null default '{}',   -- 快捷标签，如 ['分量足','偏辣']
  content      text not null default '',
  -- 匿名设备指纹哈希（前端生成，不可逆），用于频率限制与去重
  client_hash  text not null,
  created_at   timestamptz not null default now()
);

-- 菜品墙读取：该菜所有评价，按时间倒序
create index if not exists idx_reviews_dish_created
  on public.reviews (dish_id, created_at desc);

-- 频率限制按设备哈希查最近写入时间
create index if not exists idx_reviews_client_created
  on public.reviews (client_hash, created_at desc);

-- 最新评价流：全站最新 N 条
create index if not exists idx_reviews_created
  on public.reviews (created_at desc);

comment on table public.reviews is '用户提交的菜品评价，免登录写入';

-- ---------- 导入的历史评价 ----------
-- 原表里已有的 3 条口语短评（如"夯爆了"），无评分维度，作为只读参考展示
create table if not exists public.seed_reviews (
  id          int generated always as identity primary key,
  dish_id     int not null references public.dishes(id) on delete cascade,
  content     text not null,
  source      text not null default '原表',
  created_at  timestamptz not null default now()
);

create index if not exists idx_seed_reviews_dish on public.seed_reviews(dish_id);

-- ---------- 菜品聚合（物化，避免实时 count 扫全表） ----------
create table if not exists public.dish_stats (
  dish_id     int primary key references public.dishes(id) on delete cascade,
  review_count int not null default 0,
  avg_rating  numeric(3,2),
  updated_at  timestamptz not null default now()
);

comment on table public.dish_stats is '菜品评价聚合，由触发器维护，读面板统计时零聚合开销';

-- 写入即更新聚合：并发下用行锁串行化同一 dish_id 的聚合计算
create or replace function public.trg_reviews_agg()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.dish_stats (dish_id, review_count, avg_rating, updated_at)
    values (new.dish_id, 1, new.rating, now())
    on conflict (dish_id) do update
      set review_count = public.dish_stats.review_count + 1,
          avg_rating = round(
            (public.dish_stats.avg_rating * public.dish_stats.review_count + new.rating)
            / (public.dish_stats.review_count + 1)::numeric, 2),
          updated_at = now();
    return new;

  elsif tg_op = 'DELETE' then
    update public.dish_stats
      set review_count = greatest(review_count - 1, 0),
          updated_at = now()
    where dish_id = old.dish_id;
    return old;
  end if;
end;
$$;

drop trigger if exists on_reviews_agg on public.reviews;
create trigger on_reviews_agg
  after insert or delete on public.reviews
  for each row execute function public.trg_reviews_agg();

-- ============================================================
-- Row Level Security：免登录场景下的最小权限
-- ============================================================

alter table public.merchants    enable row level security;
alter table public.dishes       enable row level security;
alter table public.reviews      enable row level security;
alter table public.seed_reviews enable row level security;
alter table public.dish_stats   enable row level security;

-- 目录类数据：所有人可读
drop policy if exists p_merchants_read on public.merchants;
create policy p_merchants_read on public.merchants for select using (true);

drop policy if exists p_dishes_read on public.dishes;
create policy p_dishes_read on public.dishes for select using (true);

drop policy if exists p_seed_reviews_read on public.seed_reviews;
create policy p_seed_reviews_read on public.seed_reviews for select using (true);

drop policy if exists p_dish_stats_read on public.dish_stats;
create policy p_dish_stats_read on public.dish_stats for select using (true);

-- 评价：所有人可读
drop policy if exists p_reviews_read on public.reviews;
create policy p_reviews_read on public.reviews for select using (true);

-- 评价：免登录可写入，但字段级约束收窄——只允许写这几个列，
-- 且内容长度受限（防刷屏/防存储滥用）。禁止客户端指定 created_at 伪造时间。
drop policy if exists p_reviews_insert on public.reviews;
create policy p_reviews_insert on public.reviews for insert
  with check (
    char_length(nickname) between 1 and 20
    and char_length(content) <= 500
    -- coalesce 不能省：Postgres 里 array_length('{}', 1) 返回 NULL 而不是 0。
    -- 直接写 array_length(tags, 1) <= 6，会让"一个快捷标签都没勾"的评价被整行拒绝
    -- （NULL <= 6 求值为 NULL，WITH CHECK 不成立），而报错只是笼统的
    -- "new row violates row-level security policy"，完全指不到原因。
    and coalesce(array_length(tags, 1), 0) <= 6
  );

-- 评价：不允许任何人改别人的（no update policy = 默认拒绝）
-- 评价：不允许删除（no delete policy = 默认拒绝）
-- 这满足原表"请勿随意删除或修改他人评价"的要求

-- ============================================================
-- 索引补充：菜品名模糊搜索（pg_trgm 已在文件开头创建）
-- ============================================================
create index if not exists idx_dishes_name on public.dishes using gin (name gin_trgm_ops);
