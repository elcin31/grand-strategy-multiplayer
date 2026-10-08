import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LaunchAction} from '../src/ui/launchAction';
import {LocalTransport} from '../src/multiplayer/localTransport';
for(const name of ['singleplayer','start game'])test(name+': first tap starts exactly once, even before paint or on a slow backend',async()=>{
 const statuses:boolean[]=[];let paint!:()=>void,finish!:()=>void,calls=0,navigations=0;
 const gate=new LaunchAction(v=>statuses.push(v),()=>new Promise(r=>paint=r));
 const action=async()=>{calls++;await new Promise<void>(r=>finish=r);navigations++;};
 const first=gate.run(action);assert.deepEqual(statuses,[true]);assert.equal(await gate.run(action),false);assert.equal(calls,0);
 paint();await Promise.resolve();assert.equal(calls,1);assert.equal(await gate.run(action),false);
 finish();assert.equal(await first,true);assert.equal(navigations,1);assert.deepEqual(statuses,[true,false]);
});
test('failure clears loading and permits retry; previous session does not block a new launch',async()=>{
 const statuses:boolean[]=[];const gate=new LaunchAction(v=>statuses.push(v),async()=>{});
 await assert.rejects(gate.run(async()=>{throw Error('offline');}),/offline/);
 let count=0;await gate.run(async()=>{count++;});await gate.run(async()=>{count++;});
 assert.equal(count,2);assert.deepEqual(statuses,[true,false,true,false,true,false]);
});
test('real local campaign reaches running with one start command and one navigation emission',async()=>{
 const t=new LocalTransport(),session=await t.createRoom('Test');let current=session.state,running=0;
 const stop=t.subscribe(current.id,s=>{current=s;if(s.phase==='running')running++;});
 await t.sendCommand(current.id,{type:'SELECT_COUNTRY',playerId:session.playerId,countryId:'germany'});
 await t.sendCommand(current.id,{type:'SET_READY',playerId:session.playerId,ready:true});
 const gate=new LaunchAction(()=>{},async()=>{});
 await Promise.all([gate.run(()=>t.sendCommand(current.id,{type:'START_GAME',playerId:session.playerId})),gate.run(()=>t.sendCommand(current.id,{type:'START_GAME',playerId:session.playerId}))]);
 assert.equal(current.phase,'running');assert.equal(running,1);stop();await t.leave(current.id);
});

test("ten rapid taps create exactly one real campaign with immediate loading",async()=>{let loading=false,count=0;const t=new LocalTransport();const gate=new LaunchAction(b=>loading=b,async()=>{});const pending=Array.from({length:10},()=>gate.run(async()=>{count++;const session=await t.createRoom("Ten taps");await t.leave(session.state.id);}));assert.equal(loading,true);await Promise.all(pending);assert.equal(count,1);assert.equal(loading,false);});
