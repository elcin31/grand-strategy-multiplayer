alter table public.game_players add column if not exists last_seen timestamptz not null default now();
alter table public.game_players add column if not exists expires_at timestamptz not null default (now() + interval '180 days');
alter table public.game_players add column if not exists rate_started timestamptz not null default now();
alter table public.game_players add column if not exists rate_count integer not null default 0;
alter table public.game_rooms add column if not exists clock_at timestamptz not null default now();
alter table public.game_rooms add column if not exists last_active_at timestamptz not null default now();
create table if not exists public.game_command_receipts (
 room_id uuid not null references public.game_rooms(id) on delete cascade,
 player_id uuid not null references public.game_players(id) on delete cascade,
 command_id text not null check (length(command_id) between 8 and 100),
 payload_hash text not null, version bigint not null, created_at timestamptz not null default now(),
 primary key(room_id,player_id,command_id)
);
create index if not exists game_receipts_player_idx on public.game_command_receipts(player_id);
alter table public.game_command_receipts enable row level security;
revoke all on public.game_command_receipts from public,anon,authenticated;
-- Invoker privileges: only service_role may call; never a client-exposed definer bypass.
create or replace function public.commit_game_command(p_room uuid,p_player uuid,p_command text,p_hash text,p_expected bigint,p_state text)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare r public.game_rooms%rowtype; m public.game_players%rowtype; receipt public.game_command_receipts%rowtype;
begin
 select * into r from public.game_rooms where id=p_room for update;
 if not found then return jsonb_build_object('status',404); end if;
 select * into m from public.game_players where id=p_player and room_id=p_room for update;
 if not found or m.expires_at<=now() then return jsonb_build_object('status',401); end if;
 select * into receipt from public.game_command_receipts where room_id=p_room and player_id=p_player and command_id=p_command;
 if found then
   if receipt.payload_hash<>p_hash then return jsonb_build_object('status',409,'error','commandId already used for different intent'); end if;
   return jsonb_build_object('status',200,'duplicate',true,'version',r.version);
 end if;
 if r.version<>p_expected then return jsonb_build_object('status',409,'error','Stale campaign version','version',r.version); end if;
 if m.rate_started < now()-interval '10 seconds' then m.rate_started:=now();m.rate_count:=0;end if;
 if m.rate_count>=40 then return jsonb_build_object('status',429,'error','Too many commands; wait briefly');end if;
 update public.game_players set rate_started=m.rate_started,rate_count=m.rate_count+1,last_seen=now() where id=p_player;
 update public.game_rooms set state=null,state_compressed=p_state,version=version+1,updated_at=now(),last_active_at=now() where id=p_room;
 insert into public.game_command_receipts(room_id,player_id,command_id,payload_hash,version) values(p_room,p_player,p_command,p_hash,r.version+1);
 return jsonb_build_object('status',200,'version',r.version+1);
end $$;
revoke all on function public.commit_game_command(uuid,uuid,text,text,bigint,text) from public,anon,authenticated;
grant execute on function public.commit_game_command(uuid,uuid,text,text,bigint,text) to service_role;
