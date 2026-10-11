import {test} from 'node:test';
import assert from 'node:assert/strict';
import {HttpTransport} from '../src/multiplayer/httpTransport';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {stateChecksum} from '../supabase/functions/_shared/sessionState';
import {applyServerCommand} from '../supabase/functions/_shared/serverCommand';
import type {GameCommand} from '../src/types/game';

const store=()=>{const data=new Map<string,string>();return{get:async(k:string)=>data.get(k)??null,
 set:async(k:string,v:string)=>{data.set(k,v);},remove:async(k:string)=>{data.delete(k);}};};

test('absolute native controls recover both CAS refusals with one intent id and authoritative refresh',async()=>{
 const original=globalThis.fetch;
 try{for(const command of [
  {type:'SELECT_COUNTRY',playerId:'host',countryId:'germany'},
  {type:'SET_READY',playerId:'host',ready:true},
  {type:'SET_SPEED',playerId:'host',speed:0}
 ] satisfies GameCommand[]){
  let state=createWorldState('control','CTRL01','host','QA',22);state.players[0]!.countryId='germany';
  if(command.type==='SET_SPEED'){state.phase='running';state.speed=1;}
  let version=0,accepted=0;const attempts:any[]=[];
  globalThis.fetch=async(url,init)=>{const body=JSON.parse(String(init?.body));
   if(String(url).endsWith('game-command')){
    attempts.push(body);
    if(attempts.length<3){version++;return Response.json({error:attempts.length===1?
      'Состояние обновилось. Повторите действие после синхронизации':'Stale campaign version'},{status:409});}
    assert.equal(body.expectedVersion,version);state=applyServerCommand(state,body.command,'host');accepted++;version++;
    return Response.json({ok:true,version});
   }
   return Response.json({state,version,playerId:'host',token:'test-only',checksum:stateChecksum(state)});
  };
  const transport=new HttpTransport('https://network.test',store());await transport.createRoom('QA');
  await transport.sendCommand(state.id,command);
  assert.equal(accepted,1);assert.equal(attempts.length,3);
  assert.deepEqual(attempts.map(x=>x.expectedVersion),[0,1,2]);
  assert.equal(new Set(attempts.map(x=>x.commandId)).size,1);
  assert.ok(attempts.every(x=>JSON.stringify(x.command)===JSON.stringify(command)));
  assert.equal((await transport.savedSessions())[0]!.pending,undefined);
 }}finally{globalThis.fetch=original;}
});

test('paid intent, command-id collision, and sustained contention are rejected without a blind replay',async()=>{
 const original=globalThis.fetch;
 try{for(const [kind,message,limit] of [
  ['paid','Stale campaign version',1],['collision','commandId already used for different intent',1],
  ['contention','Stale campaign version',3]
 ] as const){
  const state=createWorldState('reject','REJ001','host','QA',22);state.players[0]!.countryId='germany';
  const treasury=state.countries.germany!.treasury;let version=0,attempts=0;
  globalThis.fetch=async(url)=>{
   if(String(url).endsWith('game-command')){attempts++;version++;return Response.json({error:message},{status:409});}
   return Response.json({state,version,playerId:'host',token:'test-only',checksum:stateChecksum(state)});
  };
  const transport=new HttpTransport('https://network.test',store());await transport.createRoom('QA');
  const command:GameCommand=kind==='paid'?{type:'START_NATIONAL_FOCUS',playerId:'host',focusId:'eco-audit'}:
    {type:'SET_SPEED',playerId:'host',speed:0};
  await assert.rejects(()=>transport.sendCommand(state.id,command));
  assert.equal(attempts,limit);assert.equal(state.countries.germany!.treasury,treasury);
  assert.equal((await transport.savedSessions())[0]!.pending,undefined);
 }}finally{globalThis.fetch=original;}
});

test('polling keeps the native owner connected without advancing a competing snapshot during a command',async()=>{
 const original=globalThis.fetch,state=createWorldState('heartbeat','BEAT01','host','QA',22);
 let release!:(response:Response)=>void,commandStarted!:()=>void,heartbeatSeen!:()=>void;
 const started=new Promise<void>(r=>{commandStarted=r;});
 const heartbeat=new Promise<void>(r=>{heartbeatSeen=r;});
 const actions:string[]=[];let pending=false,version=0;
 globalThis.fetch=async(url,init)=>{
  const body=JSON.parse(String(init?.body));
  if(String(url).endsWith('game-command')){pending=true;commandStarted();return new Promise<Response>(r=>{release=r;});}
  actions.push(body.action);
  if(body.action==='heartbeat'){assert.equal(pending,true);heartbeatSeen();return Response.json({ok:true});}
  if(pending)assert.fail('Native polling must not pump the authoritative clock during a pending command');
  return Response.json({state,version,playerId:'host',token:'test-only',checksum:stateChecksum(state)});
 };
 let stop:(()=>void)|undefined;
 try{
  const transport=new HttpTransport('https://network.test',store());await transport.createRoom('QA');
  const sent=transport.sendCommand(state.id,{type:'SET_SPEED',playerId:'host',speed:0});await started;
  stop=transport.subscribe(state.id,()=>{});await heartbeat;stop();stop=undefined;
  assert.deepEqual(actions,['create','heartbeat']);
  pending=false;version=1;release(Response.json({ok:true,version}));await sent;
  assert.deepEqual(actions,['create','heartbeat','state']);
  assert.equal((await transport.savedSessions())[0]!.pending,undefined);
 }finally{stop?.();globalThis.fetch=original;}
});

test('a lost response keeps its durable intent but normal polling resumes after active delivery ends',async()=>{
 const original=globalThis.fetch,state=createWorldState('loss-poll','LOSS01','host','QA',22);
 const actions:string[]=[];let commands=0,observed!:()=>void;
 const polled=new Promise<void>(r=>{observed=r;});
 globalThis.fetch=async(url,init)=>{
  const body=JSON.parse(String(init?.body));
  if(String(url).endsWith('game-command')){commands++;throw new TypeError('response lost');}
  actions.push(body.action);
  return Response.json({state,version:0,playerId:'host',token:'test-only',checksum:stateChecksum(state)});
 };
 let stop:(()=>void)|undefined;
 try{
  const transport=new HttpTransport('https://network.test',store());await transport.createRoom('QA');
  await assert.rejects(()=>transport.sendCommand(state.id,{type:'SET_SPEED',playerId:'host',speed:0}));
  const durable=(await transport.savedSessions())[0]!.pending;
  assert.ok(durable);
  stop=transport.subscribe(state.id,()=>{observed();});await polled;stop();stop=undefined;
  assert.deepEqual(actions,['create','state']);assert.equal(commands,1);
  assert.deepEqual((await transport.savedSessions())[0]!.pending,durable);
 }finally{stop?.();globalThis.fetch=original;}
});
