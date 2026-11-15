create table if not exists users (
  user_id text primary key,
  phone text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists readings (
  id bigint generated always as identity primary key,
  user_id text not null references users (user_id) on delete cascade,
  category text not null,
  value double precision not null,
  phase text not null check (phase in ('before', 'after')),
  recorded_at timestamptz not null default now()
);

create index if not exists readings_user_category_time
  on readings (user_id, category, recorded_at);
