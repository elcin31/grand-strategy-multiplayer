import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import type { GameState } from '../_shared/gameTypes.ts';
import { joinCampaign } from '../_shared/roomJoin.ts';
import { createWorldState } from '../_shared/worldState.ts';
import { cleanName, cleanRoomCode, json, jsonHeaders, randomToken, sha256 } from '../_shared/security.ts';
const url=Deno.env.get('SUPABASE_URL')!;const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const roomCode=()=>Array.from(crypto.getRandomValues(new Uint8Array(6)),(n)=>alphabet[n%alphabet.length]).join('');
async function verify(gameId:string,playerId:string,token:string){const tokenHash=await sha256(token);const{data,error}=await db.from('game_players').select('id,room_id').eq('id',playerId).eq('room_id',gameId).eq('token_hash',tokenHash).maybeSingle();if(error||!data)throw new Error('Недействительная игровая сессия');}
async function create(displayName:string){for(let attempt=0;attempt<5;attempt+=1){const code=roomCode();const gameId=crypto.randomUUID();const playerId=crypto.randomUUID();const token=randomToken();const state=createWorldState(gameId,code,playerId,displayName);const{error:roomError}=await db.from('game_rooms').insert({id:gameId,code,state});if(roomError?.code==='23505')continue;if(roomError)throw roomError;const{error:playerError}=await db.from('game_players').insert({id:playerId,room_id:gameId,display_name:displayName,token_hash:await sha256(token),is_host:true});if(playerError){await db.from('game_rooms').delete().eq('id',gameId);throw playerError;}return{state,version:0,playerId,token};}throw new Error('Не удалось создать уникальный код комнаты');}
async function join(code:string,displayName:string){
 const{data:room,error}=await db.from('game_rooms').select('id,state,version').eq('code',code).maybeSingle();
 if(error||!room)throw new Error('Комната не найдена');
 const playerId=crypto.randomUUID();const token=randomToken();
 joinCampaign(room.state as GameState,playerId,displayName);
 const{error:playerError}=await db.from('game_players').insert({id:playerId,room_id:room.id,display_name:displayName,token_hash:await sha256(token),is_host:false});
 if(playerError)throw playerError;
 let joined=false;
 try{
  for(let attempt=0;attempt<4;attempt+=1){
   const{data:fresh,error:readError}=await db.from('game_rooms').select('state,version').eq('id',room.id).single();
   if(readError||!fresh)throw readError??new Error('Комната не найдена');
   const state=joinCampaign(fresh.state as GameState,playerId,displayName);
   const{data:updated,error:updateError}=await db.from('game_rooms').update({state,version:fresh.version+1,updated_at:new Date().toISOString()}).eq('id',room.id).eq('version',fresh.version).select('state,version').maybeSingle();
   if(updated){joined=true;return{state:updated.state as GameState,version:updated.version,playerId,token};}
   if(updateError)throw updateError;
  }
  throw new Error('Конфликт входа в комнату, повторите попытку');
 }finally{if(!joined)await db.from('game_players').delete().eq('id',playerId).eq('room_id',room.id);}
}

Deno.serve(async(req)=>{if(req.method==='OPTIONS')return new Response('ok',{headers:jsonHeaders});if(req.method!=='POST')return json({error:'Method not allowed'},405);try{const body=await req.json();const action=String(body.action??'');if(action==='create')return json(await create(cleanName(body.displayName)));if(action==='join'){const code=cleanRoomCode(body.roomCode);if(code.length!==6)return json({error:'Код комнаты должен содержать 6 символов'},400);return json(await join(code,cleanName(body.displayName)));}if(action==='state'){const gameId=String(body.gameId??'');const playerId=String(body.playerId??'');const token=String(body.token??'');await verify(gameId,playerId,token);const{data,error}=await db.from('game_rooms').select('state,version').eq('id',gameId).single();if(error)throw error;if(Number.isSafeInteger(body.version)&&body.version===data.version)return json({unchanged:true,version:data.version,playerId});return json({state:data.state,version:data.version,playerId});}return json({error:'Unknown action'},400);}catch(error){console.error(error);return json({error:error instanceof Error?error.message:'Server error'},400);}});
