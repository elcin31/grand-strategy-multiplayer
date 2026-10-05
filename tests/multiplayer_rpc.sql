-- Run only on the dedicated Grand Strategy backend. All fixtures roll back.
begin;
do $$
declare room uuid:=gen_random_uuid(); player uuid:=gen_random_uuid(); result jsonb; v bigint:=0; kind text;
begin
 insert into game_rooms(id,code,state) values(room,upper(substr(md5(room::text),1,6)),'{}');
 insert into game_players(id,room_id,display_name,token_hash,is_host) values(player,room,'RPC QA','not-a-client-credential',true);
 foreach kind in array array['RECRUIT','MOVE_ARMY','ATTACK','OFFER_TREATY','PROPOSE_PEACE','BUILD','START_RESEARCH','CHANGE_GOVERNMENT'] loop
  result:=commit_game_command(room,player,'qa-command-'||kind,kind,v,'gz1:H4sIAAAAAAACA6uuBQBDv6ajAgAAAA==');
  if (result->>'status')::int<>200 then raise exception 'Commit failed: %',kind;end if;
  result:=commit_game_command(room,player,'qa-command-'||kind,kind,v,'must-not-write');
  if not (result->>'duplicate')::boolean then raise exception 'Replay applied twice: %',kind;end if;
  result:=commit_game_command(room,player,'qa-stale-'||kind,kind,v,'must-not-write');
  if (result->>'status')::int<>409 then raise exception 'Stale writer accepted: %',kind;end if;
  result:=commit_game_command(room,player,'qa-command-'||kind,'different-payload',v,'must-not-write');
  if (result->>'status')::int<>409 then raise exception 'Intent collision accepted';end if;
  v:=v+1;
 end loop;
 if (select version from game_rooms where id=room)<>v then raise exception 'Wrong version';end if;
 if (select count(*) from game_command_receipts where room_id=room)<>v then raise exception 'Wrong receipt count';end if;
 update game_players set rate_started=now(),rate_count=40 where id=player;
 result:=commit_game_command(room,player,'qa-rate-limit','hash',v,'must-not-write');
 if (result->>'status')::int<>429 then raise exception 'Rate limit missing';end if;
 update game_players set expires_at=now()-interval '1 second' where id=player;
 result:=commit_game_command(room,player,'qa-expired-token','hash',v,'must-not-write');
 if (result->>'status')::int<>401 then raise exception 'Expired membership accepted';end if;
 if has_function_privilege('anon','public.commit_game_command(uuid,uuid,text,text,bigint,text)','execute') or has_function_privilege('authenticated','public.commit_game_command(uuid,uuid,text,text,bigint,text)','execute') then raise exception 'Client can call authority RPC';end if;
end $$;
select 'PASS: atomic receipts, stale writers, payload collisions, rate limit, expiry, client privilege denial' as result;
rollback;
