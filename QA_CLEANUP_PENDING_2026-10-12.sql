-- Dedicated Grand Strategy project dfjsnjxnyjspwugjguhq only.
-- Reviewed own QA fixtures. Prepared, NOT executed while connector write transport is invalid.
-- Transaction aborts if any timestamp/member/receipt/backup guard differs.
BEGIN;
DO $dominion_qa_cleanup$
DECLARE
  fixture record;
  removed integer;
  protected_backups bigint;
  pending_ids uuid[] := ARRAY[
    'ee67f680-249f-4c11-aff1-07214c8db1bf'::uuid,
    'c9d212ad-72d6-4c21-bcdd-5db1f77f4298'::uuid,
    '7410ebdc-e5ef-41fc-bb40-7180ca632fda'::uuid,
    '4177cdc8-3cc2-4089-a41d-ef6b9f7c256b'::uuid
  ];
BEGIN
  SELECT count(*) INTO protected_backups FROM public.game_rooms
  WHERE city_v12_backup_at IS NOT NULL
    AND (state_before_city_v12 IS NOT NULL OR state_compressed_before_city_v12 IS NOT NULL);
  IF protected_backups <> 29 THEN RAISE EXCEPTION 'Original city backup count changed'; END IF;
  FOR fixture IN SELECT * FROM (VALUES
    ('ee67f680-249f-4c11-aff1-07214c8db1bf'::uuid, '2026-10-12 03:31:10.740389+00'::timestamptz, 8, 52, 'http'),
    ('c9d212ad-72d6-4c21-bcdd-5db1f77f4298'::uuid, '2026-10-12 03:50:32.015893+00'::timestamptz, 2, 7, 'native'),
    ('7410ebdc-e5ef-41fc-bb40-7180ca632fda'::uuid, '2026-10-12 05:38:09.80015+00'::timestamptz, 8, 52, 'http'),
    ('4177cdc8-3cc2-4089-a41d-ef6b9f7c256b'::uuid, '2026-10-12 05:55:55.797403+00'::timestamptz, 2, 7, 'native')
  ) AS expected(id, created_at, players, receipts, kind)
  LOOP
    DELETE FROM public.game_rooms r
    WHERE r.id = fixture.id AND r.created_at = fixture.created_at
      AND r.city_v12_backup_at IS NULL
      AND r.state_before_city_v12 IS NULL AND r.state_compressed_before_city_v12 IS NULL
      AND (SELECT count(*) FROM public.game_players p WHERE p.room_id = r.id) = fixture.players
      AND (SELECT count(DISTINCT p.display_name) FROM public.game_players p WHERE p.room_id = r.id) = fixture.players
      AND (SELECT count(*) FROM public.game_command_receipts c WHERE c.room_id = r.id) = fixture.receipts
      AND NOT EXISTS (
        SELECT 1 FROM public.game_players p WHERE p.room_id = r.id AND NOT (
          (fixture.kind = 'http' AND (
            (p.display_name = 'WORLD ECONOMY QA' AND p.is_host = true) OR
            (p.display_name IN ('QA guest 0','QA guest 1','QA guest 2','QA guest 3','QA guest 4','QA guest 5','QA guest 6') AND p.is_host = false)
          )) OR
          (fixture.kind = 'native' AND (
            (p.display_name = 'NATIVE ONLINE QA' AND p.is_host = true) OR
            (p.display_name = 'NATIVE ONLINE QA GUEST' AND p.is_host = false)
          ))
        )
      )
      AND EXISTS (
        SELECT 1 FROM public.game_players p WHERE p.room_id = r.id AND p.is_host = true
          AND p.display_name = CASE WHEN fixture.kind = 'http' THEN 'WORLD ECONOMY QA' ELSE 'NATIVE ONLINE QA' END
      );
    GET DIAGNOSTICS removed = ROW_COUNT;
    IF removed <> 1 THEN RAISE EXCEPTION 'QA fixture guard failed: %', fixture.id; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.game_rooms WHERE id = ANY(pending_ids))
    OR EXISTS (SELECT 1 FROM public.game_players WHERE room_id = ANY(pending_ids))
    OR EXISTS (SELECT 1 FROM public.game_command_receipts WHERE room_id = ANY(pending_ids))
  THEN RAISE EXCEPTION 'QA cleanup readback failed'; END IF;
  IF protected_backups <> (
    SELECT count(*) FROM public.game_rooms WHERE city_v12_backup_at IS NOT NULL
      AND (state_before_city_v12 IS NOT NULL OR state_compressed_before_city_v12 IS NOT NULL)
  ) THEN RAISE EXCEPTION 'Original city backups were not preserved'; END IF;
END;
$dominion_qa_cleanup$;
COMMIT;
-- Independent follow-up through a fresh read-only query remains required.
