import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {applyServerCommand} from '../supabase/functions/_shared/serverCommand';
import {startConstruction,completeConstructions,constructionProgress} from '../supabase/functions/_shared/buildingSystem';
import {queueConstruction,processConstructionQueue,cancelConstruction} from '../supabase/functions/_shared/constructionQueueSystem';
import {startEspionage,monthlyEspionage,espionageModifiers,espionageQuote} from '../supabase/functions/_shared/espionageSystem';
import {namedResearchQuote,grantTechnology} from '../supabase/functions/_shared/technologyTree';
import {startResearch,startTechnology} from '../supabase/functions/_shared/technologySystem';
import {money,recalcEconomy} from '../supabase/functions/_shared/economySystem';
import {encodeCampaign,decodeCampaign,validateCampaign} from '../src/persistence/campaignCodec';
import type {GameState} from '../supabase/functions/_shared/gameTypes';

function world(){const s=createWorldState('integration-qa','INT001','host','QA',101);s.phase='paused';s.speed=0;s.players[0]!.countryId='germany';s.players.push({id:'guest',displayName:'France',countryId:'france',isHost:false,ready:true,connected:true,aiControlled:false,lastSeen:0});return s;}
function site(s:GameState){const id=s.countries.germany!.capitalCityId;return s.provinces.find(p=>p.id===s.cities!.find(c=>c.id===id)!.provinceId)!;}
/** Find an actual paid mission's reproducible success, without injecting an
 * effect or skipping the production resolver. The test state stays at tick0. */
function sabotage(s:GameState,owners=['france']):void {
  for(const owner of owners)startEspionage(s,owner,'germany','Sabotage');
  for(let seed=1;seed<=100;seed++){const probe=structuredClone(s);probe.campaignSeed=seed;probe.tick=4;monthlyEspionage(probe);if(probe.spyReports!.length===owners.length&&probe.spyReports!.every(r=>r.outcome==='Success')){s.campaignSeed=seed;return;}}
  throw Error('No successful paid mission fixture');
}
function month(s:GameState,tick:number):void{s.tick=tick;monthlyEspionage(s);completeConstructions(s);processConstructionQueue(s);recalcEconomy(s);}

test('authoritative monthly phase applies newly completed sabotage to actual construction immediately',()=>{
  let s=world();s=applyServerCommand(s,{type:'BUILD',playerId:'host',provinceId:site(s).id,buildingType:'Farm'},'host');sabotage(s);
  s=applyServerCommand(s,{type:'SET_SPEED',playerId:'host',speed:1},'host');
  for(let tick=1;tick<=4;tick++)s=applyServerCommand(s,{type:'ADVANCE_TICK'},'host');
  const job=s.constructions!.find(c=>c.provinceId===site(s).id)!;
  assert.equal(s.spyReports!.find(r=>r.kind==='Sabotage')!.outcome,'Success');assert.equal(job.completeTick,6);assert.ok(Math.abs(job.workDone!-3.8)<1e-9);assert.equal(job.workTick,4);assert.equal(constructionProgress(s,job).percent,63);
  assert.deepEqual(decodeCampaign(encodeCampaign(s,1)).state,s);
});

test('six sabotage months delay a paid project beyond its quoted date, expire and credit work only once',()=>{
  let s=world();const p=site(s),job=startConstruction(s,'germany',p,'Factory'),id=job.id,cash=s.countries.germany!.treasury;sabotage(s);
  for(let tick=1;tick<=14;tick++){
    month(s,tick);const once=structuredClone(s);completeConstructions(s);processConstructionQueue(s);assert.deepEqual(s,once);
    if(tick<14){assert.equal(site(s).buildings?.Factory,undefined);assert.equal(s.constructions![0]!.id,id);s=decodeCampaign(encodeCampaign(s,tick)).state;}
    if(tick===9)assert.equal(espionageModifiers(s,'germany').productionMultiplier,.8);
    if(tick===10)assert.equal(espionageModifiers(s,'germany').productionMultiplier,1);
    if(tick===12){assert.ok(Math.abs(s.constructions![0]!.workDone!-10.8)<1e-9);assert.equal(s.constructions![0]!.completeTick,12);assert.ok(constructionProgress(s,s.constructions![0]!).months>0);}
  }
  assert.equal(site(s).buildings!.Factory,1);assert.equal(s.constructions!.length,0);assert.equal(s.countries.germany!.treasury,cash);
});

test('a paid waiting project starts after actual completion without a second charge or a premature upgrade',()=>{
  const s=world(),p=site(s);queueConstruction(s,'germany',p,'Farm');queueConstruction(s,'germany',p,'Farm');const cash=s.countries.germany!.treasury;sabotage(s);
  for(let tick=1;tick<=6;tick++)month(s,tick);
  assert.equal(p.buildings?.Farm,undefined);assert.equal(s.constructionQueue!.length,1);assert.equal(s.constructions!.length,1);
  month(s,7);assert.equal(p.buildings!.Farm,1);assert.equal(s.constructionQueue!.length,0);assert.equal(s.constructions![0]!.targetLevel,2);assert.equal(s.constructions![0]!.startedTick,7);assert.equal(s.countries.germany!.treasury,cash);
  assert.deepEqual(decodeCampaign(encodeCampaign(s,1)).state,s);
});

test('cancellation refunds only unused delayed work and dependent upgrades, with no repeated refund',()=>{
  const s=world(),p=site(s);queueConstruction(s,'germany',p,'Factory');queueConstruction(s,'germany',p,'Factory');queueConstruction(s,'germany',p,'Farm');sabotage(s);
  for(let tick=1;tick<=12;tick++)month(s,tick);
  const job=s.constructions![0]!,dependent=s.constructionQueue!.find(q=>q.buildingType==='Factory')!,cash=s.countries.germany!.treasury,refund=money(job.cost*.5*(1-job.workDone!/12)+dependent.cost*.5);
  cancelConstruction(s,'germany',job.id);assert.equal(s.countries.germany!.treasury,money(cash+refund));assert.equal(s.constructions![0]!.buildingType,'Farm');assert.equal(s.constructions![0]!.startedTick,12);assert.equal(s.constructionQueue!.length,0);assert.throws(()=>cancelConstruction(s,'germany',job.id));
  assert.deepEqual(decodeCampaign(encodeCampaign(s,1)).state,s);
});

test('stacked paid sabotage is bounded and composes with actual infrastructure and science capabilities',()=>{
  const s=world(),c=s.countries.germany!;c.technologies!.Industry=1;grantTechnology(s,c,'eco-ledger');grantTechnology(s,c,'science-method');startConstruction(s,c.id,site(s),'Factory');sabotage(s,['france','usa']);
  for(let tick=1;tick<=4;tick++)month(s,tick);
  assert.equal(espionageModifiers(s,c.id).productionMultiplier,.65);assert.ok(Math.abs(s.constructions![0]!.workDone!-(3*1.03+1.03*.65))<1e-9);assert.equal(s.constructions![0]!.workTick,4);assert.deepEqual(decodeCampaign(encodeCampaign(s,1)).state,s);
});

test('research refuses future date overflow before payment, for both named and legacy starts',()=>{
  for(const legacy of [false,true]){const s=world();s.tick=Number.MAX_SAFE_INTEGER-2;const c=s.countries.germany!,before=structuredClone(s);assert.match(namedResearchQuote(s,c,'eco-ledger').reason!,/date overflow/);assert.throws(()=>legacy?startResearch(s,c,'Economy'):startTechnology(s,c,'eco-ledger'),/date overflow/);assert.deepEqual(s,before);assert.throws(()=>applyServerCommand(s,{type:'START_TECHNOLOGY',playerId:'host',nodeId:'eco-ledger'},'host'),/date overflow/);assert.deepEqual(s,before);}
  const s=world();startResearch(s,s.countries.germany!,'Economy');s.tick=Number.MAX_SAFE_INTEGER-2;s.countries.germany!.research!.startedTick=s.tick;assert.throws(()=>validateCampaign(s),/research project/);
});

test('intelligence and counterintelligence reserve their post-completion effect dates before charging',()=>{
  for(const kind of ['IntelligenceGathering','Counterintelligence'] as const){
    const s=world(),target=kind==='Counterintelligence'?'germany':'france';s.tick=Number.MAX_SAFE_INTEGER-12;const before=structuredClone(s);
    assert.match(espionageQuote(s,'germany',target,kind).reason!,/date overflow/);assert.throws(()=>startEspionage(s,'germany',target,kind),/date overflow/);assert.deepEqual(s,before);
  }
  const s=world();startEspionage(s,'germany','germany','Counterintelligence');s.tick=Number.MAX_SAFE_INTEGER-12;Object.assign(s.spyMissions![0]!,{startedTick:s.tick,completeTick:s.tick+2});s.countries.germany!.spyCooldowns!['germany:Counterintelligence']=Number.MAX_SAFE_INTEGER;assert.throws(()=>validateCampaign(s),/espionage mission/);
});

test('strict saves reject future construction starts and forged effective work, retaining valid delayed jobs',()=>{
  for(const mutation of [(s:GameState)=>{const j=s.constructions![0]!;j.startedTick=1;j.completeTick=13;},(s:GameState)=>{const j=s.constructions![0]!;s.tick=1;j.workTick=1;j.workDone=2;},(s:GameState)=>{const j=s.constructions![0]!;j.workTick=0;j.workDone=.1;}]){const s=world();startConstruction(s,'germany',site(s),'Factory');mutation(s);const before=structuredClone(s);assert.throws(()=>validateCampaign(s));assert.deepEqual(s,before);}
  const s=world();startConstruction(s,'germany',site(s),'Factory');sabotage(s);for(let tick=1;tick<=13;tick++)month(s,tick);assert.ok(s.tick>s.constructions![0]!.completeTick);assert.deepEqual(decodeCampaign(encodeCampaign(s,1)).state,s);
});
