create table if not exists public.game_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  state jsonb not null,
  version bigint not null default 0 check (version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.game_players (
  id uuid primary key,
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 32),
  token_hash text not null,
  is_host boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists game_players_room_idx on public.game_players(room_id);
create index if not exists game_players_auth_idx on public.game_players(room_id, id, token_hash);

alter table public.game_rooms enable row level security;
alter table public.game_players enable row level security;

revoke all on table public.game_rooms from anon, authenticated;
revoke all on table public.game_players from anon, authenticated;

comment on table public.game_rooms is 'Authoritative multiplayer room state. Access only through Edge Functions.';
comment on table public.game_players is 'Room membership and hashed bearer tokens. Never expose token_hash to clients.';
