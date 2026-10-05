import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {applyServerCommand} from '../_shared/serverCommand.ts';
import {packRoomState,unpackRoomState} from '../_shared/stateStorage.ts';
import {json,jsonHeaders,sha256} from '../_shared/security.ts';
import {db,verifySession} from '../_shared/roomServer.ts';
import {assertEnvelope} from '../_shared/sessionState.ts';
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:jsonHeaders});if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  const body=await req.json();assertEnvelope(body);const {gameId,playerId,token,command,commandId,expectedVersion}=body;
  if(!gameId||!playerId||!token||!command?.type)return json({error:'Invalid request'},400);
  try{await verifySession(gameId,playerId,token);}catch{return json({error:'Недействительная или истёкшая игровая сессия'},401);}
  const hash=await sha256(JSON.stringify(command));
  const {data:receipt}=await db.from('game_command_receipts').select('payload_hash,version').eq('room_id',gameId).eq('player_id',playerId).eq('command_id',commandId).maybeSingle();
  if(receipt)return receipt.payload_hash===hash?json({ok:true,duplicate:true,version:receipt.version}):json({error:'commandId already used for different intent'},409);
  const {data:room,error}=await db.from('game_rooms').select('state,state_compressed,version').eq('id',gameId).single();if(error)throw error;
  if(room.version!==expectedVersion)return json({error:'Состояние обновилось. Повторите действие после синхронизации',version:room.version},409);
  if(command.type==='ADVANCE_TICK')return json({error:'Игровое время рассчитывается сервером'},400);
  const state=await unpackRoomState(room),actor=state.players.find(p=>p.id===playerId);if(!actor)return json({error:'Игрок не найден'},401);
  // Reconnect returns exclusive control before applying the authenticated intent.
  actor.aiControlled=false;actor.connected=true;actor.lastSeen=Date.now();
  const next=applyServerCommand(state,command,playerId);
  const {data:result,error:commitError}=await db.rpc('commit_game_command',{p_room:gameId,p_player:playerId,p_command:commandId,p_hash:hash,p_expected:expectedVersion,p_state:await packRoomState(next)});if(commitError)throw commitError;
  return json({...result,ok:result.status===200},result.status);
 }catch(error){return json({error:error instanceof Error?error.message:'Server error'},400);}
});
