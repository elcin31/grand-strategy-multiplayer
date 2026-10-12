import {test} from 'node:test';
import assert from 'node:assert/strict';
import {HttpTransport} from '../src/multiplayer/httpTransport';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {applyServerCommand} from '../supabase/functions/_shared/serverCommand';
import {encodeSnapshot} from '../supabase/functions/_shared/stateWire';
import {joinCampaign} from '../supabase/functions/_shared/roomJoin';
import {LaunchAction} from '../src/ui/launchAction';
const memory=()=>{const data=new Map<string,string>();return{get:async(k:string)=>data.get(k)??null,set:async(k:string,v:string)=>{data.set(k,v);},remove:async(k:string)=>{data.delete(k);}};};
test('two clients: stale START, once-only launch, lost reply, synchronized actions and reconnect',async()=>{
 const original=globalThis.fetch;let s=createWorldState('two-clients','TWO211','host','A'),version=0,starts=0,lost=true;
 const receipts=new Set<string>();
 globalThis.fetch=async(url,init)=>{
  const b=JSON.parse(String(init?.body));
  if(String(url).endsWith('game-command')){
   if(receipts.has(b.commandId))return Response.json({ok:true,duplicate:true,version});
   if(b.expectedVersion!==version)return Response.json({error:'Stale campaign version'},{status:409});
   try{const was=s.phase;s=applyServerCommand(s,b.command,b.playerId);if(was==='lobby'&&s.phase==='running')starts++;receipts.add(b.commandId);version++;
    if(b.command.type==='START_GAME'&&lost){lost=false;throw new TypeError('lost reply');}
    return Response.json({ok:true,version});
   }catch(e){if(e instanceof TypeError)throw e;return Response.json({error:String(e)},{status:400});}
  }
  if(b.action==='join'){s=joinCampaign(s,'guest','B');version++;}
  const playerId=b.action==='join'?'guest':b.playerId??'host';
  return Response.json(encodeSnapshot({state:s,version,playerId,token:'qa-only'}));
 };
 try{
  const a=new HttpTransport('https://test',memory()),b=new HttpTransport('https://test',memory());
  await a.createRoom('A');await b.joinRoom(s.roomCode,'B');
  await a.sendCommand(s.id,{type:'SELECT_COUNTRY',playerId:'host',countryId:'usa'});
  await b.sendCommand(s.id,{type:'SELECT_COUNTRY',playerId:'guest',countryId:'uk'});
  await a.sendCommand(s.id,{type:'SET_READY',playerId:'host',ready:true});
  await a.synchronize(s.id); // Guest's readiness makes host's displayed version stale.
  await b.sendCommand(s.id,{type:'SET_READY',playerId:'guest',ready:true});
  await a.sendCommand(s.id,{type:'START_GAME',playerId:'host'});
  assert.equal(starts,1);assert.equal((await b.synchronize(s.id)).phase,'running');
  await a.sendCommand(s.id,{type:'START_GAME',playerId:'host'});assert.equal(starts,1);
  await a.sendCommand(s.id,{type:'SET_SPEED',playerId:'host',speed:0});
  await b.synchronize(s.id);
  await b.sendCommand(s.id,{type:'REQUEST_PAUSE',playerId:'guest'});
  const aa=await a.synchronize(s.id),bb=await b.synchronize(s.id);assert.deepEqual(aa,bb);
  assert.equal((await b.reconnect(s.id)).state.phase,'paused');
  assert.throws(()=>applyServerCommand(s,{type:'START_GAME',playerId:'guest'},'guest'),/хост/);
  assert.throws(()=>applyServerCommand(s,{type:'START_GAME',playerId:'host'},'guest'),/Подмена/);
 }finally{globalThis.fetch=original;}
});
test('Android suspended RAF cannot leave launch waiting for dispatch forever',async()=>{
 let called=false;const latch=new LaunchAction(()=>{},()=>new Promise(()=>{}));
 await latch.run(async()=>{called=true;});assert.equal(called,true);
});
