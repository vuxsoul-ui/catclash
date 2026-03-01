create table if not exists public.site_spotlights (
  slot text primary key,
  cat_id uuid not null references public.cats(id) on delete cascade,
  note text,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create index if not exists idx_site_spotlights_cat_id on public.site_spotlights(cat_id);
