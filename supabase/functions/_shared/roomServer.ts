import {createClient} from 'npm:@supabase/supabase-js@2.117.2';
import {sha256} from './security.ts';
import {packRoomState,unpackRoomState} from './stateStorage.ts';
import {applyPresence,pumpClock,stateChecksum} from './sessionState.ts';
export const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
export async function verifySession(gameId:string,playerId:string,token:string){
 const {data,error}=await db.from('game_players').update({last_seen:new Date().toISOString()}).eq('id',playerId).eq('room_id',gameId).eq('token_hash',await sha256(token)).gt('expires_at',new Date().toISOString()).select('id').maybeSingle();
 if(error||!data)throw new Error('Недействительная или истёкшая игровая сессия');
}
export async function authoritativeSnapshot(gameId:string){
 for(let attempt=0;attempt<5;attempt++){
  const {data:room,error}=await db.from('game_rooms').select('state,state_compressed,version,clock_at').eq('id',gameId).single();if(error)throw error;
  const {data:members,error:memberError}=await db.from('game_players').select('id,last_seen').eq('room_id',gameId);if(memberError)throw memberError;
  const now=Date.now(),state=await unpackRoomState(room),changed=applyPresence(state,members!,now),clock=pumpClock(state,Date.parse(room.clock_at),now);
  if(changed||clock.ticks){const {data:updated,error:writeError}=await db.from('game_rooms').update({state:null,state_compressed:await packRoomState(clock.state),clock_at:new Date(clock.clockAt).toISOString(),version:room.version+1,updated_at:new Date(now).toISOString(),last_active_at:new Date(now).toISOString()}).eq('id',gameId).eq('version',room.version).select('version').maybeSingle();if(writeError)throw writeError;if(!updated)continue;return{state:clock.state,version:updated.version,checksum:stateChecksum(clock.state)};}
  // lastSeen changes need not create a new snapshot revision on every heartbeat.
  const persisted=await unpackRoomState(room);return{state:persisted,version:room.version,checksum:stateChecksum(persisted)};
 }
 throw new Error('Одновременное обновление: повторите синхронизацию');
}
