create table if not exists user_arena_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  arena text not null check (arena in ('main', 'rookie')),
  day_key date not null,
  page_index int not null default 0,
  within_page_offset int not null default 0,
  voted_match_ids jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, arena, day_key)
);

create index if not exists idx_user_arena_progress_user_day
  on user_arena_progress (user_id, day_key, arena);

