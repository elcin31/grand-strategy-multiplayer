import {mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {applyServerCommand} from '../supabase/functions/_shared/serverCommand';
import {applyCommand} from '../supabase/functions/_shared/gameEngine';
import {declareWar} from '../supabase/functions/_shared/diplomacySystem';
import {splitArmy,beginBattle,beginSiege} from '../supabase/functions/_shared/military3System';
import {encodeCampaign,decodeCampaign} from '../src/persistence/campaignCodec';
import type {GameCommand} from '../src/types/game';

// Detached QA saves only. No production rooms, renderer data or runtime backdoor.
const directory=process.argv[2]??'camera23-fixture';mkdirSync(directory,{recursive:true});
const warDays=process.argv.includes('--monthly')?25:12;
let state=createWorldState('camera23-peace','CAM23A','camera-host','Camera QA',101);
for(const command of [
  {type:'SELECT_COUNTRY',playerId:'camera-host',countryId:'germany'},
  {type:'SET_READY',playerId:'camera-host',ready:true},
  {type:'START_GAME',playerId:'camera-host'},
  {type:'SET_SPEED',playerId:'camera-host',speed:0},
] satisfies GameCommand[])state=applyServerCommand(state,command,'camera-host');
assert.equal(state.stateVersion,25);assert.equal(state.phase,'paused');
const manifest:Record<string,unknown>={};
function save(name:string){
  const saved=JSON.parse(encodeCampaign(state,1,'Camera 2.3 QA · '+name));saved.metadata.lastPlayed=0;
  const canonical=JSON.stringify(saved);assert.deepEqual(decodeCampaign(canonical).state,saved.state);
  const filename=state.id+'.1.json';writeFileSync(join(directory,filename),canonical);
  manifest[name]={filename,sha256:createHash('sha256').update(canonical).digest('hex'),checksum:saved.checksum,stateVersion:state.stateVersion,seed:101,simulationDay:state.simulationDay,armies:state.armies.length,wars:state.wars?.length??0,battles:state.activeBattles?.length??0,sieges:state.sieges?.length??0};
}
save('peace');
state=structuredClone(state);state.id='camera23-war';state.phase='running';state.speed=1;
declareWar(state,'germany','poland');
for(let i=0;i<warDays;i++)state=applyCommand(state,{type:'ADVANCE_DAY'},true);
// Scenario deployment of existing soldiers; create battle/siege records with
// the engine's own operations. No fake units or altered map geometry.
const german=state.armies.find(a=>a.ownerId==='germany')!,polish=state.armies.find(a=>a.ownerId==='poland')!;
splitArmy(state,'germany',german.id,50);
const reserve=state.armies.find(a=>a.ownerId==='germany'&&a.id!==german.id)!;
const borders=state.provinces.filter(p=>p.ownerId==='poland'&&p.neighbors.some(id=>state.provinces.find(q=>q.id===id)?.ownerId==='germany'));
assert.ok(borders.length>=1);
const defended=borders[0]!,fort=state.provinces.find(p=>p.ownerId==='poland'&&defended.neighbors.includes(p.id))!;
assert.ok(fort);
defended.controllerId='poland';polish.provinceId=defended.id;delete polish.order;
german.provinceId=defended.neighbors.find(id=>state.provinces.find(p=>p.id===id)?.ownerId==='germany')!;
beginBattle(state,german,defended);
fort.controllerId='poland';fort.buildings={...fort.buildings,Fort:2};reserve.provinceId=fort.id;beginSiege(state,reserve,fort);
assert.ok(state.activeBattles?.length);assert.ok(state.sieges?.length);
state.phase='paused';state.speed=0;assert.ok(state.wars?.length);
save('war');writeFileSync(join(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify(manifest));
