-- Keep byte-exact compressed states and original JSONB before lazy city migration.
-- Existing RLS/service-only grants on game_rooms remain unchanged; no backup in responses.
alter table public.game_rooms add column if not exists state_before_city_v12 jsonb;
alter table public.game_rooms add column if not exists state_compressed_before_city_v12 text;
alter table public.game_rooms add column if not exists city_v12_backup_at timestamptz;
update public.game_rooms set state_before_city_v12=state,
 state_compressed_before_city_v12=state_compressed, city_v12_backup_at=now()
 where city_v12_backup_at is null;
comment on column public.game_rooms.state_before_city_v12 is 'Original server JSONB before Dominion city catalogue v12; explicit recovery only.';
comment on column public.game_rooms.state_compressed_before_city_v12 is 'Byte-exact original compressed server state before city v12; never sent to clients.';
