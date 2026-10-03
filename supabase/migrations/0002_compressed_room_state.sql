-- Large world snapshots are gzip/base64 encoded by Edge Functions before crossing PostgREST.
-- Existing JSONB campaigns remain valid and are migrated lazily on their next authoritative write.
alter table public.game_rooms
  add column if not exists state_compressed text;

alter table public.game_rooms
  alter column state drop not null;

alter table public.game_rooms
  add constraint game_rooms_state_present
  check (state is not null or state_compressed like 'gz1:%') not valid;

alter table public.game_rooms
  validate constraint game_rooms_state_present;
