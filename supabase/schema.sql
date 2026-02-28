-- ================================================================
-- 51期 六華同窓会 スケジュール管理 DB スキーマ
-- Supabase の SQL Editor でこのファイルをまるごと実行してください
-- ================================================================

-- ── テーブル作成 ──────────────────────────────────────────────

-- セクション（執行部 / 各会合・営業・挨拶 / 挨拶文の奉稿 など）
create table if not exists public.sections (
  id          uuid    default gen_random_uuid() primary key,
  name        text    not null,
  color       text    default '#3B82F6',
  is_sub      boolean default false,        -- サブセクション（インデント表示）
  sort_order  integer default 0,
  is_open     boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- タスク
create table if not exists public.tasks (
  id          uuid    default gen_random_uuid() primary key,
  section_id  uuid    references public.sections(id) on delete cascade,
  name        text    not null,
  due_date    date,                          -- カレンダーで設定する日付
  sort_order  integer default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- タスク × 月 ごとのセル情報
create table if not exists public.task_cells (
  id          uuid    default gen_random_uuid() primary key,
  task_id     uuid    references public.tasks(id) on delete cascade,
  month_id    integer not null check (month_id between 1 and 13),
  content     text,                          -- '済' / '予定' / 'R7.12.19' など
  assignee    text,
  memo        text,
  cell_date   date,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique(task_id, month_id)
);

-- マイルストーン（主なイベント行）
create table if not exists public.milestones (
  month_id    integer primary key check (month_id between 1 and 13),
  text        text    not null,
  is_main     boolean default false,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- コメント
create table if not exists public.comments (
  id          uuid    default gen_random_uuid() primary key,
  task_id     uuid    references public.tasks(id) on delete cascade,
  month_id    integer not null,
  text        text    not null,
  author      text    default '委員',
  created_at  timestamptz default now()
);

-- ── RLS（行レベルセキュリティ） ────────────────────────────────
-- 今は全員読み書き可。認証追加後に絞る想定
alter table public.sections   enable row level security;
alter table public.tasks       enable row level security;
alter table public.task_cells  enable row level security;
alter table public.milestones  enable row level security;
alter table public.comments    enable row level security;

create policy "public_all" on public.sections   for all using (true) with check (true);
create policy "public_all" on public.tasks       for all using (true) with check (true);
create policy "public_all" on public.task_cells  for all using (true) with check (true);
create policy "public_all" on public.milestones  for all using (true) with check (true);
create policy "public_all" on public.comments    for all using (true) with check (true);

-- ── リアルタイム有効化 ─────────────────────────────────────────
alter publication supabase_realtime add table public.sections;
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.task_cells;
alter publication supabase_realtime add table public.milestones;
alter publication supabase_realtime add table public.comments;

-- ── 初期データ投入 ─────────────────────────────────────────────

-- セクション
insert into public.sections (name, color, is_sub, sort_order) values
  ('執行部',             '#3B82F6', false, 1),
  ('各会合・営業・挨拶', '#8B5CF6', true,  2),
  ('挨拶文の奉稿',       '#10B981', false, 3)
on conflict do nothing;

-- マイルストーン
insert into public.milestones (month_id, text, is_main) values
  (5,  'HP立ち上げ' || chr(10) || 'SNS公開',         false),
  (6,  '事務局開局',                                   false),
  (8,  '学校林散策',                                   false),
  (9,  '東京六華' || chr(10) || '六華ゼミ/1',          false),
  (10, '札南学校祭' || chr(10) || '六華ゼミ/2',        false),
  (11, '六華ゼミ/3',                                   false),
  (12, '六華ゼミ/4',                                   false),
  (13, '懇親会(10/17)' || chr(10) || '広報誌発行' || chr(10) || '六華ゼミ/5', true)
on conflict do nothing;

-- タスク（執行部）
with s as (select id from public.sections where name = '執行部' limit 1)
insert into public.tasks (section_id, name, sort_order)
select s.id, t.name, t.ord from s,
(values
  ('組織編成',        1),
  ('部長決定',        2),
  ('テーマ策定・決定', 3),
  ('テーマ案募集',    4),
  ('テーマ説明会実施', 5),
  ('テーマ決定',      6),
  ('ロゴ策定',        7),
  ('実行委員会の開催', 8)
) as t(name, ord)
on conflict do nothing;

-- タスク（各会合・営業・挨拶）
with s as (select id from public.sections where name = '各会合・営業・挨拶' limit 1)
insert into public.tasks (section_id, name, sort_order)
select s.id, t.name, t.ord from s,
(values
  ('R7.11 大雪六華総会',           1),
  ('R8.1.17 東京六華新年会',       2),
  ('R8.1.28 六華新年会',           3),
  ('R8.2.22 学校林財団 冬の散策会', 4),
  ('R8.4 有明小学校挨拶',          5),
  ('R8.4 学校林入口部挨拶',        6),
  ('R8.4 学校林財団挨拶',          7),
  ('R8.4 南高挨拶',                8),
  ('R8.4 親会挨拶',                9),
  ('佐藤印刷挨拶',                 10),
  ('R8.5 パークホテル挨拶',        11),
  ('R8.6 東京六華同窓会',          12),
  ('R8.7 学校祭',                  13),
  ('六華夏の交流会 営業',          14),
  ('R8.8 大雪六華総会',            15),
  ('🎉 R8.10.17 六華同窓会',      16),
  ('秋の散策会',                   17),
  ('懇親会当日準備・対応',         18),
  ('親会関連会議出席',             19),
  ('企画活動委員会定例会',         20)
) as t(name, ord)
on conflict do nothing;

-- タスク（挨拶文の奉稿）
with s as (select id from public.sections where name = '挨拶文の奉稿' limit 1)
insert into public.tasks (section_id, name, sort_order)
select s.id, t.name, t.ord from s,
(values
  ('実行委員長挨拶',                   1),
  ('東京六華同窓会 プログラム掲載挨拶', 2),
  ('東京六華同窓会 会誌(WEB)告知挨拶', 3)
) as t(name, ord)
on conflict do nothing;

-- セル初期データ（済）
insert into public.task_cells (task_id, month_id, content)
select t.id, c.month_id, c.content
from public.tasks t
join (values
  ('部長決定',        4, '済'),
  ('テーマ策定・決定', 1, '済'),
  ('テーマ案募集',    1, '済'),
  ('テーマ説明会実施', 1, '済'),
  ('テーマ決定',      1, '済'),
  ('ロゴ策定',        1, '済'),
  ('R7.11 大雪六華総会',     2, '済'),
  ('R8.1.17 東京六華新年会', 4, '済'),
  ('R8.1.28 六華新年会',     4, '済')
) as c(task_name, month_id, content) on t.name = c.task_name
on conflict (task_id, month_id) do update set content = excluded.content;

-- セル初期データ（日付テキスト）
insert into public.task_cells (task_id, month_id, content)
select t.id, c.month_id, c.content
from public.tasks t
join (values
  ('実行委員会の開催', 3, 'R7.12.19'),
  ('実行委員会の開催', 4, 'R8.1.21'),
  ('実行委員会の開催', 5, 'R8.2.18')
) as c(task_name, month_id, content) on t.name = c.task_name
on conflict (task_id, month_id) do update set content = excluded.content;

-- セル初期データ（予定）
insert into public.task_cells (task_id, month_id, content)
select t.id, c.month_id, '予定'
from public.tasks t
join (values
  ('R8.2.22 学校林財団 冬の散策会', 5),
  ('R8.4 有明小学校挨拶',           7),
  ('R8.4 学校林入口部挨拶',         7),
  ('R8.4 学校林財団挨拶',           7),
  ('R8.4 南高挨拶',                 7),
  ('R8.4 親会挨拶',                 7),
  ('佐藤印刷挨拶',                  8),
  ('R8.5 パークホテル挨拶',         8),
  ('R8.6 東京六華同窓会',           9),
  ('R8.7 学校祭',                   10),
  ('六華夏の交流会 営業',           11),
  ('R8.8 大雪六華総会',             11),
  ('🎉 R8.10.17 六華同窓会',       13),
  ('秋の散策会',                    13),
  ('懇親会当日準備・対応',          13),
  ('親会関連会議出席',              13),
  ('企画活動委員会定例会',          13),
  ('実行委員長挨拶',                11),
  ('東京六華同窓会 プログラム掲載挨拶', 5),
  ('東京六華同窓会 会誌(WEB)告知挨拶', 6)
) as c(task_name, month_id) on t.name = c.task_name
on conflict (task_id, month_id) do update set content = '予定';

-- due_date の設定
update public.tasks set due_date = '2026-02-22' where name = 'R8.2.22 学校林財団 冬の散策会';
update public.tasks set due_date = '2026-10-17' where name = '🎉 R8.10.17 六華同窓会';
