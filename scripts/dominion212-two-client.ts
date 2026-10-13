// One isolated real multiplayer campaign. Never writes tokens or full snapshots.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {HttpTransport} from '../src/multiplayer/httpTransport';
import {findArmyRoute} from '../supabase/functions/_shared/armyOrders';
import type {GameState} from '../src/types/game';
const memory=()=>{const data=new Map<string,string>();return {get:async(k:string)=>data.get(k)??null,set:async(k:string,v:string)=>{data.set(k,v);},remove:async(k:string)=>{data.delete(k);}};};
const base='https://dfjsnjxnyjspwugjguhq.supabase.co/functions/v1',suffix='-v211';
async function main(){
 const storeA=memory(),storeB=memory(),a=new HttpTransport(base,storeA,suffix),b=new HttpTransport(base,storeB,suffix);
 const host=await a.createRoom('DOMINION212 QA A');await writeFile('DOMINION_212_QA_ROOM.json',JSON.stringify({roomId:host.state.id,createdFor:'2.1.2 short two-client QA'})+'\n');
 const guest=await b.joinRoom(host.state.roomCode,'DOMINION212 QA B');
 await a.sendCommand(host.state.id,{type:'SELECT_COUNTRY',playerId:host.playerId,countryId:'usa'});await b.sendCommand(host.state.id,{type:'SELECT_COUNTRY',playerId:guest.playerId,countryId:'uk'});
 await a.sendCommand(host.state.id,{type:'SET_AI_DIFFICULTY',playerId:host.playerId,difficulty:'Hard'});
 await a.sendCommand(host.state.id,{type:'SET_READY',playerId:host.playerId,ready:true});await b.sendCommand(host.state.id,{type:'SET_READY',playerId:guest.playerId,ready:true});await a.sendCommand(host.state.id,{type:'START_GAME',playerId:host.playerId});await a.sendCommand(host.state.id,{type:'SET_SPEED',playerId:host.playerId,speed:0});
 const beforeA=await a.synchronize(host.state.id),beforeB=await b.synchronize(host.state.id),ids=new Map<string,string[]>(),origins=new Map<string,string>();
 for(const [client,session,country,snapshot] of [[a,host,'usa',beforeA],[b,guest,'uk',beforeB]] as const){const province=snapshot.armies.find(x=>x.ownerId===country)!.provinceId;origins.set(country,province);for(const [n,troops] of [10000,12000].entries())await client.sendCommand(host.state.id,{type:'CREATE_NEW_ARMY',playerId:session.playerId,provinceId:province,name:`QA ${country} ${n+1}`,composition:{Infantry:troops},commanderId:null});const formed=await client.synchronize(host.state.id);ids.set(country,formed.armyFormations!.filter(q=>q.ownerId===country).map(q=>q.armyId));assert.equal(ids.get(country)!.length,2);assert.notEqual(ids.get(country)![0],ids.get(country)![1]);assert.equal(formed.countries[country]!.manpower,snapshot.countries[country]!.manpower-22000);assert.equal(formed.countries[country]!.treasury,snapshot.countries[country]!.treasury-440);}
 await assert.rejects(a.sendCommand(host.state.id,{type:'CREATE_NEW_ARMY',playerId:host.playerId,provinceId:origins.get('usa')!,name:'Forged',composition:{Infantry:1000001},commanderId:null}));
 await assert.rejects(a.sendCommand(host.state.id,{type:'SET_SPEED',playerId:guest.playerId,speed:5}));
 await a.sendCommand(host.state.id,{type:'SET_SPEED',playerId:host.playerId,speed:5});
 let snapshotA:GameState=beforeA,snapshotB:GameState=beforeB;
 for(let n=0;n<25;n++){snapshotA=await a.synchronize(host.state.id);snapshotB=await b.synchronize(host.state.id);if(!snapshotA.armyFormations?.some(q=>q.ownerId==='usa')&&!snapshotB.armyFormations?.some(q=>q.ownerId==='uk'))break;await new Promise<void>(resolve=>setTimeout(resolve,150));}
 await a.sendCommand(host.state.id,{type:'SET_SPEED',playerId:host.playerId,speed:0});snapshotA=await a.synchronize(host.state.id);snapshotB=await b.synchronize(host.state.id);
 assert.equal(snapshotA.aiDifficulty,'Hard');assert.equal(snapshotB.aiDifficulty,'Hard');
 for(const [s,country] of [[snapshotA,'usa'],[snapshotB,'uk']] as const){assert.equal(s.armyFormations?.filter(q=>q.ownerId===country).length,0);assert.ok(s.players.filter(p=>p.countryId===country).every(p=>!p.aiControlled));assert.deepEqual(ids.get(country)!.map(id=>s.armies.find(a=>a.id===id)!.troops),[10000,12000]);}
 await assert.rejects(a.sendCommand(host.state.id,{type:'ORDER_ARMY',playerId:host.playerId,armyId:ids.get('uk')![0]!,provinceId:origins.get('usa')!}));
 const destinations=new Map<string,string[]>();
 for(const [client,session,country,s] of [[a,host,'usa',snapshotA],[b,guest,'uk',snapshotB]] as const){const rows=ids.get(country)!,army=s.armies.find(a=>a.id===rows[0])!,targets=s.provinces.filter(p=>p.ownerId===country&&p.id!==army.provinceId).map(p=>{try{return {p,route:findArmyRoute(s,army,p.id)};}catch{return null;}}).filter((v):v is NonNullable<typeof v>=>!!v&&v.route.length<=3).sort((x,y)=>x.route.length-y.route.length).slice(0,2);assert.equal(targets.length,2);destinations.set(country,targets.map(t=>t.p.id));for(let n=0;n<2;n++)await client.sendCommand(host.state.id,{type:'ORDER_ARMY',playerId:session.playerId,armyId:rows[n]!,provinceId:targets[n]!.p.id});}
 await a.sendCommand(host.state.id,{type:'SET_SPEED',playerId:host.playerId,speed:5});
 for(let n=0;n<35;n++){snapshotA=await a.synchronize(host.state.id);snapshotB=await b.synchronize(host.state.id);if(ids.get('usa')!.every(id=>!snapshotA.armies.find(a=>a.id===id)!.order)&&ids.get('uk')!.every(id=>!snapshotB.armies.find(a=>a.id===id)!.order))break;await new Promise<void>(resolve=>setTimeout(resolve,150));}
 await a.sendCommand(host.state.id,{type:'SET_SPEED',playerId:host.playerId,speed:0});snapshotA=await a.synchronize(host.state.id);snapshotB=await b.synchronize(host.state.id);
 for(const [s,country] of [[snapshotA,'usa'],[snapshotB,'uk']] as const){assert.deepEqual(ids.get(country)!.map(id=>s.armies.find(a=>a.id===id)!.provinceId),destinations.get(country));assert.ok(ids.get(country)!.every(id=>!s.armies.find(a=>a.id===id)!.militaryPlan?.autoCommand));}
 assert.deepEqual([snapshotA.year,snapshotA.month,snapshotA.day],[snapshotB.year,snapshotB.month,snapshotB.day]);
 const restored=await new HttpTransport(base,storeB,suffix).reconnect(host.state.id);assert.equal(restored.playerId,guest.playerId);assert.deepEqual(ids.get('uk')!.map(id=>restored.state.armies.find(a=>a.id===id)!.name),['QA uk 1','QA uk 2']);
 await writeFile('DOMINION_212_MULTIPLAYER_QA.json',JSON.stringify({roomId:host.state.id,createJoinStart:true,twoIndependentHttpClients:true,sharedDifficulty:'Hard',fourIndependentPaidFormations:true,separateArmyIds:true,exactRecruitmentPayments:true,forgedStrengthAndActorRejected:true,foreignArmyOrderRejected:true,independentMovementBothCountries:true,playerCountriesNotAIControlled:true,sharedCalendar:true,reconnectPreservesArmyNames:true,physicalPhones:false},null,2)+'\n');
 console.log('PASS: four paid formations, independent movement, authority, shared difficulty/calendar and persisted reconnect. QA room '+host.state.id);
}
void main().catch(e=>{console.error(e.message);process.exitCode=1;});
