// One live Dominion scenario. No credentials or full snapshots are written.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {HttpTransport} from '../src/multiplayer/httpTransport';
import {prepareWorldScene} from '../src/map/worldScene';
const memory=()=>{const data=new Map<string,string>();return{get:async(k:string)=>data.get(k)??null,set:async(k:string,v:string)=>{data.set(k,v);},remove:async(k:string)=>{data.delete(k);}};};
async function main(){
const base='https://dfjsnjxnyjspwugjguhq.supabase.co/functions/v1',suffix=process.env.DOMINION_ENDPOINT_SUFFIX??'-v21';
const a=new HttpTransport(base,memory(),suffix),b=new HttpTransport(base,memory(),suffix);
const host=await a.createRoom('DOMINION211 QA A'),guest=await b.joinRoom(host.state.roomCode,'DOMINION211 QA B');
console.log('QA room id: '+host.state.id);
await a.sendCommand(host.state.id,{type:'SELECT_COUNTRY',playerId:host.playerId,countryId:'usa'});
await b.sendCommand(host.state.id,{type:'SELECT_COUNTRY',playerId:guest.playerId,countryId:'uk'});
await a.sendCommand(host.state.id,{type:'SET_READY',playerId:host.playerId,ready:true});
await b.sendCommand(host.state.id,{type:'SET_READY',playerId:guest.playerId,ready:true});
await a.sendCommand(host.state.id,{type:'START_GAME',playerId:host.playerId});
await a.sendCommand(host.state.id,{type:'SET_SPEED',playerId:host.playerId,speed:0});
const startedA=await a.synchronize(host.state.id),startedB=await b.synchronize(host.state.id);
assert.equal(startedA.phase,'paused');assert.equal(startedB.phase,'paused');
const sceneA=await prepareWorldScene(startedA),sceneB=await prepareWorldScene(startedB);
assert.equal(sceneA.provinceGeometry.size,startedA.provinces.length);assert.equal(sceneB.provinceGeometry.size,startedB.provinces.length);
// Each country issues a genuine order, independent of host calendar control.
for(const [client,session,country] of [[a,host,'usa'],[b,guest,'uk']] as const){
 const s=await client.synchronize(host.state.id),army=s.armies.find(x=>x.ownerId===country)!;
 const origin=s.provinces.find(x=>x.id===army.provinceId)!;
 const target=origin.neighbors.find(id=>s.provinces.some(p=>p.id===id&&p.ownerId===country))!;
 assert.ok(target);await client.sendCommand(host.state.id,{type:'ORDER_ARMY',playerId:session.playerId,armyId:army.id,provinceId:target});
}
const finalA=await a.synchronize(host.state.id),finalB=await b.synchronize(host.state.id);
assert.ok(finalA.armies.find(x=>x.ownerId==='usa'&&x.order));
assert.ok(finalB.armies.find(x=>x.ownerId==='uk'&&x.order)); // Foreign orders are intentionally hidden by fog of war.
assert.deepEqual([finalA.year,finalA.month,finalA.day],[finalB.year,finalB.month,finalB.day]);
assert.equal((await b.reconnect(host.state.id)).state.id,host.state.id);
await writeFile('DOMINION_211_MULTIPLAYER_QA.json',JSON.stringify({roomId:host.state.id,createJoin:true,countries:true,ready:true,start:true,twoAuthoritativeSnapshots:true,mapGeometryPreparedBoth:true,ordersBoth:true,sharedCalendar:true,reconnect:true,nativeMapRender:false},null,2)+'\n');
console.log('PASS: two independent HTTP clients, map geometry, both orders, shared calendar, reconnect. Android rendering is covered separately.');
}
void main().catch(e=>{console.error(e.message);process.exitCode=1;});
