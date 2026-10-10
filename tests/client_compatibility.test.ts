import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assertClientCompatibility} from '../supabase/functions/_shared/clientCompatibility';
import {assertRoomRequest} from '../supabase/functions/_shared/requestValidation';
import {assertEnvelope,stateChecksum} from '../supabase/functions/_shared/sessionState';
import {CURRENT_STATE_VERSION} from '../supabase/functions/_shared/stateMigrations';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {HttpTransport} from '../src/multiplayer/httpTransport';

const id='11111111-1111-4111-8111-111111111111',token='a'.repeat(43);
test('compatible schema is required separately from strict room and command shapes',()=>{
  const auth={gameId:id,playerId:id,token,clientStateVersion:CURRENT_STATE_VERSION};
  const bodies=[{action:'create',displayName:'QA',clientStateVersion:CURRENT_STATE_VERSION},
    {action:'join',displayName:'QA',roomCode:'JOIN01',clientStateVersion:CURRENT_STATE_VERSION},
    ...['state','reconnect','heartbeat'].map(action=>({action,...auth}))];
  for(const body of bodies){assertRoomRequest(body);assertClientCompatibility(body);assert.throws(()=>assertRoomRequest({...body,treasury:1e9}));}
  const envelope={...auth,commandId:'compatible-command',expectedVersion:0,command:{type:'SET_READY',playerId:id,ready:true}};
  assertEnvelope(envelope);assertClientCompatibility(envelope);assert.throws(()=>assertEnvelope({...envelope,state:{treasury:1e9}}));
  for(const version of [undefined,12,CURRENT_STATE_VERSION-1,CURRENT_STATE_VERSION+1])assert.throws(()=>assertClientCompatibility({clientStateVersion:version}),{status:426});
  for(const version of [null,false,'18',[],{},NaN,Infinity,0,-1,18.5])assert.throws(()=>assertClientCompatibility({clientStateVersion:version}),{status:400});
});

test('stored sessions without schema metadata reconnect through the current contract without losing identity or receipts',async()=>{
  const original=globalThis.fetch,values=new Map<string,string>();
  const store={get:async(k:string)=>values.get(k)??null,set:async(k:string,v:string)=>{values.set(k,v);},remove:async(k:string)=>{values.delete(k);}};
  const s=createWorldState(id,'UPGR01','host','QA',101);s.players[0]!.countryId='germany';s.phase='paused';s.speed=0;
  const pending={command:{type:'SET_TAX_RATE',playerId:'host',taxRate:30},commandId:'old-durable-intent',expectedVersion:0};
  values.set('dominion.sessions.v1',JSON.stringify([id]));values.set('dominion.session.'+id,JSON.stringify({gameId:id,playerId:'host',token,version:0,roomCode:s.roomCode,lastPlayed:0,pending}));
  const bodies:Record<string,unknown>[]=[];
  try{
    globalThis.fetch=async(url,init)=>{const b=JSON.parse(String(init?.body));assertClientCompatibility(b);bodies.push(b);return String(url).endsWith('game-command')?Response.json({ok:true,duplicate:true,version:1}):Response.json({state:s,version:1,playerId:'host',checksum:stateChecksum(s)});};
    const transport=new HttpTransport('https://network.test',store),result=await transport.reconnect(id);
    assert.equal(result.playerId,'host');assert.equal(result.state.id,id);assert.equal(result.state.players[0]!.countryId,'germany');
    const sent=bodies.find(b=>b.commandId==='old-durable-intent')!;assert.deepEqual(sent.command,pending.command);assert.equal(sent.expectedVersion,0);assert.equal(sent.token,token);
    assert.ok(bodies.every(b=>b.clientStateVersion===CURRENT_STATE_VERSION));assert.ok(bodies.filter(b=>b.action).every(b=>b.wireVersion===1));assert.equal((await transport.savedSessions())[0]!.pending,undefined);
  }finally{globalThis.fetch=original;}
});

test('an incompatible server response reports the upgrade reason and stops futile polling while retaining the session',async()=>{
  const original=globalThis.fetch,values=new Map<string,string>(),store={get:async(k:string)=>values.get(k)??null,set:async(k:string,v:string)=>{values.set(k,v);},remove:async(k:string)=>{values.delete(k);}};
  const s=createWorldState(id,'UPGR01','host','QA',101);let requests=0,unsubscribe=()=>{};
  try{
    globalThis.fetch=async()=>Response.json({state:s,version:0,playerId:'host',token,checksum:stateChecksum(s)});
    const transport=new HttpTransport('https://network.test',store);await transport.createRoom('QA');
    globalThis.fetch=async()=>{requests++;return Response.json({error:'Для сетевой игры обновите Dominion до актуальной версии.'},{status:426});};
    let complete!:(status:string)=>void;const feedback=new Promise<string>(r=>{complete=r;});
    unsubscribe=transport.subscribe(id,()=>{},complete);assert.match(await feedback,/обновите Dominion/);
    await new Promise(r=>setTimeout(r,1600));assert.equal(requests,1);assert.equal((await transport.savedSessions())[0]!.token,token);
  }finally{unsubscribe();globalThis.fetch=original;}
});
