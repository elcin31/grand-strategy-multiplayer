import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {applyServerCommand} from '../supabase/functions/_shared/serverCommand';
import {ESPIONAGE_MISSIONS,espionageQuote,startEspionage,monthlyEspionage,espionageModifiers,initializeEspionage,type EspionageKind} from '../supabase/functions/_shared/espionageSystem';
import {money,recalcEconomy} from '../supabase/functions/_shared/economySystem';
import {combatMultiplier} from '../supabase/functions/_shared/militarySystem';
import {resourceReport} from '../supabase/functions/_shared/resourceSystem';
import {diplomaticLink,declareWar} from '../supabase/functions/_shared/diplomacySystem';
import {runStrategicAI} from '../supabase/functions/_shared/aiSystem';
import {normalizeGameState,CURRENT_STATE_VERSION} from '../supabase/functions/_shared/stateMigrations';
import {encodeCampaign,decodeCampaign,validateCampaign} from '../src/persistence/campaignCodec';
import {CampaignStore,type CampaignFiles} from '../src/persistence/campaignStore';
import {stateChecksum} from '../supabase/functions/_shared/sessionState';
import {assertInvariants} from './helpers/invariants';
import type {GameState} from '../supabase/functions/_shared/gameTypes';
function world(){const s=createWorldState('spy-qa','SPY001','host','QA',42);s.phase='paused';s.speed=0;s.players[0]!.countryId='germany';s.players.push({id:'guest',displayName:'France',countryId:'france',isHost:false,ready:true});return s;}
function completed(kind:EspionageKind,outcome:'Success'|'Failure'='Success',detected?:boolean):GameState {
  const base=world();for(let seed=1;seed<=300;seed++){
    const s=structuredClone(base);s.campaignSeed=seed;startEspionage(s,'germany',kind==='Counterintelligence'?'germany':'france',kind);s.tick=ESPIONAGE_MISSIONS[kind].months;monthlyEspionage(s);
    const r=s.spyReports![0]!;if(r.outcome===outcome&&(detected===undefined||r.detected===detected))return s;
  }throw Error('No deterministic outcome fixture');
}
test('four espionage commands charge real costs once, obey duration/capacity and reject actor/reward injection',()=>{
  const s=world(),copy=structuredClone(s),c={type:'START_ESPIONAGE',playerId:'host',targetId:'france',kind:'IntelligenceGathering'} as const;
  const quote=espionageQuote(s,'germany','france',c.kind);assert.equal(quote.reason,null);assert.deepEqual(s,copy);let n=applyServerCommand(s,c,'host');assert.equal(n.countries.germany!.treasury,money(s.countries.germany!.treasury-80));assert.equal(n.countries.germany!.politicalPower,s.countries.germany!.politicalPower!-8);assert.equal(n.spyMissions![0]!.completeTick,3);
  assert.throws(()=>applyServerCommand(n,c,'host'));assert.throws(()=>applyServerCommand(s,c,'guest'));assert.throws(()=>applyServerCommand(s,{...c,successChance:100} as never,'host'));assert.throws(()=>applyServerCommand(s,{...c,kind:'Unknown'} as never,'host'));assert.throws(()=>applyServerCommand(s,{...c,targetId:'germany'},'host'));
  n=applyServerCommand(n,{...c,kind:'Sabotage'},'host');assert.throws(()=>applyServerCommand(n,{...c,kind:'PoliticalIntrigue'},'host'),/групп/);assert.throws(()=>applyServerCommand(s,{...c,kind:'Counterintelligence'},'host'));
  const poor=world();poor.countries.germany!.treasury=79.999;assert.throws(()=>applyServerCommand(poor,c,'host'));const lobby=world();lobby.phase='lobby';assert.throws(()=>applyServerCommand(lobby,c,'host'));
});
test('intel completes at its exact tick, grants a temporary combat effect and persists without duplicate reward',()=>{
  let s=completed('IntelligenceGathering');const r=s.spyReports![0]!,e=s.spyEffects![0]!;assert.ok(r.intelligence);assert.equal(r.intelligence!.army,s.countries.france!.army);assert.equal(e.untilTick,15);assert.equal(s.spyMissions!.length,0);
  const a=s.armies.find(a=>a.ownerId==='germany')!,p=s.provinces.find(p=>p.ownerId==='france')!,boost=combatMultiplier(s,a,p,false);const once=structuredClone(s);monthlyEspionage(s);assert.deepEqual(s,once);s=decodeCampaign(encodeCampaign(s,1)).state;monthlyEspionage(s);assert.equal(s.spyReports!.length,1);s.tick=15;monthlyEspionage(s);assert.equal(s.spyEffects!.length,0);assert.ok(Math.abs(boost/combatMultiplier(s,a,p,false)-1.08)<1e-9);
  const pending=world();startEspionage(pending,'germany','france','IntelligenceGathering');pending.tick=2;monthlyEspionage(pending);assert.equal(pending.spyMissions!.length,1);assert.equal(pending.spyReports!.length,0);
});
test('sabotage changes actual production/resource budget and supply; capped effects expire completely',()=>{
  const s=completed('Sabotage'),p=s.provinces.find(p=>p.ownerId==='france')!;p.buildings={...p.buildings,Factory:1};recalcEconomy(s);const damaged=s.countries.france!.economy!,effect=structuredClone(s.spyEffects![0]!);s.spyEffects=[];recalcEconomy(s);const clean=s.countries.france!.economy!;
  assert.equal(damaged.productionIncome,money(clean.productionIncome*.8));assert.equal(damaged.resourceIncome,money(clean.resourceIncome*.8));assert.ok(damaged.monthlyBalance<clean.monthlyBalance);s.spyEffects=[effect];assert.equal(money(resourceReport(s,'france').reduce((n,r)=>n+r.revenue,0)),damaged.resourceIncome);
  s.spyEffects=[effect,{...effect,id:'extra-effect',missionId:'other-mission'}];assert.equal(espionageModifiers(s,'france').productionMultiplier,.65);assert.equal(espionageModifiers(s,'france').supplyPenalty,30);s.tick=effect.untilTick;monthlyEspionage(s);recalcEconomy(s);assert.equal(s.countries.france!.economy!.productionIncome,clean.productionIncome);assert.equal(espionageModifiers(s,'france').supplyPenalty,0);
});
test('bounded world-wide reports retain human intelligence when NPC operations are numerous',()=>{
  const s=completed('IntelligenceGathering'),human=s.spyReports![0]!.id;
  for(let i=0;i<192;i++)s.spyReports!.unshift({id:'fixture-report-'+i,missionId:'fixture-mission-'+i,ownerId:'poland',targetId:'france',kind:'Sabotage',tick:s.tick,outcome:'Failure',detected:false,message:'Операция провалилась.'});
  startEspionage(s,'germany','germany','Counterintelligence');s.tick+=2;monthlyEspionage(s);assert.ok(s.spyReports!.some(r=>r.id===human));assert.equal(s.spyReports!.length,192);initializeEspionage(s,false);
});
test('intrigue applies stability/province consequences once; detected success and failure penalize the actor',()=>{
  const base=world();for(const success of ['Success','Failure'] as const){const s=completed('PoliticalIntrigue',success,true),r=s.spyReports![0]!;assert.equal(r.outcome,success);assert.ok(r.detected);assert.equal(s.countries.france!.stability,base.countries.france!.stability-(success==='Success'?7:0));assert.equal(s.provinces.filter(p=>p.ownerId==='france'&&p.unrest!>base.provinces.find(b=>b.id===p.id)!.unrest!).length,success==='Success'?3:0);assert.ok(s.countries.germany!.diplomaticReputation!<base.countries.germany!.diplomaticReputation!);assert.ok(s.diplomaticHistory!.some(e=>e.kind==='EspionageDetected'));const snapshot=structuredClone(s);monthlyEspionage(s);assert.deepEqual(s,snapshot);}
  const undetected=completed('PoliticalIntrigue','Failure',false);assert.equal(undetected.countries.germany!.diplomaticReputation,base.countries.germany!.diplomaticReputation);assert.equal(undetected.countries.france!.stability,base.countries.france!.stability);
});
test('counterintelligence alters real probabilities and protects same-month completions regardless of insertion order',()=>{
  const s=world(),before=espionageQuote(s,'france','germany','Sabotage');startEspionage(s,'germany','germany','Counterintelligence');s.tick=2;monthlyEspionage(s);const after=espionageQuote(s,'france','germany','Sabotage');assert.equal(after.successChance,before.successChance-30);assert.equal(after.detectionChance,before.detectionChance+25);assert.equal(s.spyReports![0]!.outcome,'Success');assert.equal(s.spyReports![0]!.detected,false);assert.throws(()=>startEspionage(s,'germany','germany','Counterintelligence'));s.tick=14;monthlyEspionage(s);assert.equal(espionageQuote(s,'france','germany','Sabotage').successChance,before.successChance);
  const base=world();startEspionage(base,'france','germany','Sabotage');base.tick=2;startEspionage(base,'germany','germany','Counterintelligence');base.tick=4;const reversed=structuredClone(base);reversed.spyMissions!.reverse();monthlyEspionage(base);monthlyEspionage(reversed);assert.deepEqual(base,reversed);
});
test('recall, eliminated target and new alliance abort missions without refund or completed effects',()=>{
  let s=applyServerCommand(world(),{type:'START_ESPIONAGE',playerId:'host',targetId:'france',kind:'Sabotage'},'host');const cost=s.countries.germany!.treasury,id=s.spyMissions![0]!.id;assert.throws(()=>applyServerCommand(s,{type:'CANCEL_ESPIONAGE',playerId:'guest',missionId:id},'guest'));s=applyServerCommand(s,{type:'CANCEL_ESPIONAGE',playerId:'host',missionId:id},'host');assert.equal(s.countries.germany!.treasury,cost);assert.equal(s.spyReports![0]!.outcome,'Cancelled');assert.throws(()=>startEspionage(s,'germany','france','Sabotage'));
  const extinct=world();startEspionage(extinct,'germany','france','Sabotage');extinct.countries.france!.provinceIds=[];extinct.tick=1;monthlyEspionage(extinct);assert.equal(extinct.spyReports![0]!.outcome,'Aborted');assert.equal(extinct.spyEffects!.length,0);
  const ally=world();startEspionage(ally,'germany','france','Sabotage');const l=diplomaticLink(ally,'germany','france');l.treaties=['Alliance'];l.terms=[{id:'test-alliance',type:'Alliance',from:'germany',to:'france',startedTick:0,untilTick:60}];ally.tick=4;monthlyEspionage(ally);assert.equal(ally.spyReports![0]!.outcome,'Aborted');assert.equal(ally.spyEffects!.length,0);
});
test('AI starts intelligence and counterintelligence within its scheduled budget, reconsiders hostile commitments',()=>{
  const s=world();s.players=[];declareWar(s,'germany','france');s.leaders![s.countries.germany!.rulerId!]!.aiPersonality='Diplomatic';s.leaders![s.countries.france!.rulerId!]!.aiPersonality='Defensive';s.countries.germany!.treasury=1_000_000;s.countries.france!.treasury=1_000_000;
  const ally=diplomaticLink(s,'italy','spain');ally.relation=-70;ally.baselineRelation=-70;ally.treaties=['TradeAgreement'];ally.terms=[{id:'hostile-trade',type:'TradeAgreement',from:'italy',to:'spain',startedTick:0,untilTick:60}];s.countries.italy!.politicalPower=500;
  for(let tick=6;tick<=11;tick++){s.tick=tick;runStrategicAI(s,{recruit:()=>{},move:()=>{}});}
  assert.ok(s.spyMissions!.some(m=>m.ownerId==='germany'&&m.kind==='IntelligenceGathering'));assert.ok(s.spyMissions!.some(m=>m.ownerId==='france'&&m.kind==='Counterintelligence'));assert.ok(!ally.treaties.includes('TradeAgreement'));assert.ok(s.spyMissions!.length<=Object.keys(s.countries).length*4);
});
test('schema13 migrates espionage additively with byte-exact backup; malformed current outcomes fail validation',async()=>{
  const old=world();old.stateVersion=13;delete old.spyMissions;delete old.spyEffects;delete old.spyReports;for(const c of Object.values(old.countries))delete c.spyCooldowns;const original=JSON.stringify({format:1,metadata:{id:old.id,name:'old',generation:1},checksum:stateChecksum(old),state:old}),map=new Map([[old.id+'.1.json',original]]);
  const files:CampaignFiles={list:async()=>[...map.keys()],read:async n=>map.get(n)!,write:async(n,t)=>{map.set(n,t);},move:async(a,b)=>{map.set(b,map.get(a)!);map.delete(a);},remove:async n=>{map.delete(n);}};
  const store=new CampaignStore(files),loaded=await store.load(old.id);assert.equal(loaded.stateVersion,CURRENT_STATE_VERSION);assert.deepEqual(loaded.spyMissions,[]);await store.save(loaded);assert.equal(map.get(old.id+'.before-espionage-v14.backup'),original);assert.deepEqual(loaded.countries.france!.treasury,old.countries.france!.treasury);
  for(const mutation of [(s:GameState)=>{delete s.spyReports;},(s:GameState)=>{s.spyMissions![0]!.targetId='missing';},(s:GameState)=>{s.spyMissions![0]!.completeTick=Infinity;},(s:GameState)=>{s.countries.germany!.spyCooldowns={};}]){const s=world();startEspionage(s,'germany','france','Sabotage');mutation(s);assert.throws(()=>validateCampaign(s));}
  const result=completed('IntelligenceGathering');result.spyReports!.push(structuredClone(result.spyReports![0]!));assert.throws(()=>initializeEspionage(result,false));const invalid=completed('Sabotage');invalid.spyEffects!.push({...invalid.spyEffects![0]!,id:'duplicate-reward'});assert.throws(()=>initializeEspionage(invalid,false));const valid=completed('Counterintelligence');normalizeGameState(valid);assertInvariants(valid);assert.deepEqual(valid,decodeCampaign(encodeCampaign(valid,1)).state);
});
