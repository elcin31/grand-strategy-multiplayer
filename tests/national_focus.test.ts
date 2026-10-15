import {FOCUS_EXPANSION} from '../supabase/functions/_shared/focusExpansion';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorldState} from './helpers/isolatedWorld';
import {applyServerCommand} from '../supabase/functions/_shared/serverCommand';
import {normalizeGameState,CURRENT_STATE_VERSION} from '../supabase/functions/_shared/stateMigrations';
import {FOCUS_IDS,FOCUS_NODES,focusNode,focusBelongsTo,focusBonuses,hasFocus,type FocusId} from '../supabase/functions/_shared/focusCatalogue';
import {focusAvailability,startFocus,cancelFocus,monthlyFocus,initializeFocuses} from '../supabase/functions/_shared/focusSystem';
import {money,recalcEconomy} from '../supabase/functions/_shared/economySystem';
import {militaryFundingCost} from '../supabase/functions/_shared/economy2System';
import {startResearch,monthlyResearch} from '../supabase/functions/_shared/technologySystem';
import {grantTechnology} from '../supabase/functions/_shared/technologyTree';
import {supplyAt,invalidateSupply} from '../supabase/functions/_shared/supplySystem';
import {combatMultiplier} from '../supabase/functions/_shared/militarySystem';
import {startConstruction,completeConstructions} from '../supabase/functions/_shared/buildingSystem';
import {diplomacyAcceptance} from '../supabase/functions/_shared/diplomacy2System';
import {diplomaticLink,declareWar} from '../supabase/functions/_shared/diplomacySystem';
import {runStrategicAI,strategicContext} from '../supabase/functions/_shared/aiSystem';
import {stateChecksum} from '../supabase/functions/_shared/sessionState';
import {encodeCampaign,decodeCampaign,validateCampaign} from '../src/persistence/campaignCodec';
import {CampaignStore,type CampaignFiles} from '../src/persistence/campaignStore';
function world(){const s=createWorldState('focus-qa','FOC001','host','QA',101);s.players[0]!.countryId='germany';s.phase='paused';s.speed=0;for(const c of Object.values(s.countries)){c.treasury=20000;c.politicalPower=500;}return s;}
function finish(s:ReturnType<typeof world>,id:FocusId,owner='germany'){startFocus(s,owner,id);s.tick+=FOCUS_NODES[id]!.duration;monthlyFocus(s);recalcEconomy(s);normalizeGameState(s);return s.countries[owner]!;}
test('125 original courses retain generic, regional and major-power branches',()=>{
 const s=world();assert.equal(FOCUS_IDS.length,125);assert.equal(FOCUS_IDS.filter(id=>FOCUS_NODES[id]!.category==='Generic').length,65);assert.equal(FOCUS_IDS.filter(id=>FOCUS_NODES[id]!.category==='Regional').length,5);assert.equal(FOCUS_IDS.filter(id=>FOCUS_NODES[id]!.category==='Unique').length,55);
 const done=new Set<string>(),active=new Set<string>();function visit(id:string){const n=focusNode(id)!;assert.ok(n);assert.ok(!active.has(id));if(done.has(id))return;active.add(id);for(const parent of [...n.prerequisites,...n.eitherPrerequisites??[]])visit(parent);active.delete(id);done.add(id);assert.ok(n.duration>0&&n.cost>0&&n.pp>0);}
 for(const id of FOCUS_IDS)visit(id);assert.equal(done.size,125);for(const id of ['usa','russia','chn','germany','uk'])assert.equal(FOCUS_IDS.filter(f=>FOCUS_NODES[f]!.category==='Unique'&&focusBelongsTo(s.countries[id]!,FOCUS_NODES[f]!)).length,8);assert.equal(focusNode('toString'),undefined);
});
test('starting a real course pays once and validates actor, prerequisites, territory, phase and forged rewards',()=>{
 const s=world(),copy=structuredClone(s),cmd={type:'START_NATIONAL_FOCUS',playerId:'host',focusId:'eco-audit'} as const,n=applyServerCommand(s,cmd,'host');assert.deepEqual(s,copy);assert.equal(n.countries.germany!.treasury,20000-220);assert.equal(n.countries.germany!.politicalPower,500-16);assert.equal(n.countries.germany!.nationalFocus!.progress,0);assert.equal(n.focusEvents![0]!.kind,'Started');
 for(const invalid of [{...cmd,playerId:'other'},{...cmd,focusId:'eco-corridors'},{...cmd,focusId:'usa-commissions'},{...cmd,focusId:'toString'},{...cmd,reward:1000}])assert.throws(()=>applyServerCommand(s,invalid as never,'host'));assert.throws(()=>applyServerCommand(n,cmd,'host'));s.phase='lobby';assert.ok(focusAvailability(s,'germany','eco-audit'));
});
test('monthly progress survives save/restart, rewards actual money/taxes once and repeated restored completion does not pay again',()=>{
 let s=applyServerCommand(world(),{type:'START_NATIONAL_FOCUS',playerId:'host',focusId:'eco-audit'},'host');const tax=s.countries.germany!.economy!.taxIncome,cash=s.countries.germany!.treasury;
 for(let i=1;i<6;i++){s.tick=i;monthlyFocus(s);const once=structuredClone(s);monthlyFocus(s);assert.deepEqual(s,once);assert.equal(s.countries.germany!.nationalFocus!.progress,i);s=decodeCampaign(encodeCampaign(s,i)).state;}
 s.tick=6;monthlyFocus(s);recalcEconomy(s);assert.equal(s.countries.germany!.treasury,cash+120);assert.equal(s.countries.germany!.nationalFocus,undefined);assert.equal(s.countries.germany!.economy!.taxIncome,money(tax*1.02));assert.equal(s.countries.germany!.completedFocuses!.length,1);assert.equal(s.focusEvents!.filter(e=>e.countryId==='germany'&&e.kind==='Completed').length,1);
 const restarted=decodeCampaign(encodeCampaign(s,7)).state,copy=structuredClone(restarted);monthlyFocus(restarted);assert.deepEqual(restarted,copy);assert.throws(()=>applyServerCommand(restarted,{type:'START_NATIONAL_FOCUS',playerId:'host',focusId:'eco-audit'},'host'));
});
test('exclusive alternatives unlock their common successor and cannot both complete',()=>{
 const s=world();for(const id of ['eco-audit','eco-corridors','eco-production'] as FocusId[])finish(s,id);assert.match(focusAvailability(s,'germany','eco-exchange')!,/взаимоисключающая/);assert.equal(focusAvailability(s,'germany','eco-resilience'),null);finish(s,'eco-resilience');assert.ok(hasFocus(s.countries.germany!,'eco-resilience'));assert.equal(focusBonuses(s.countries.germany!).production,.05);assert.equal(focusBonuses(s.countries.germany!).trade,0);
 const forged=structuredClone(s);forged.tick+=10;forged.countries.germany!.completedFocuses!.push({focusId:'eco-exchange',tick:forged.tick});assert.throws(()=>initializeFocuses(forged,false));
});
test('default pauses real focus months without later catch-up; cancellation keeps paid cost and resets work',()=>{
 const s=world(),c=s.countries.germany!;startFocus(s,c.id,'eco-audit');const paid=c.treasury;c.bankruptcyUntilTick=8;for(let tick=1;tick<8;tick++){s.tick=tick;monthlyFocus(s);}assert.equal(c.nationalFocus!.progress,0);s.tick=8;monthlyFocus(s);assert.equal(c.nationalFocus!.progress,1);cancelFocus(s,c.id);assert.equal(c.treasury,paid);assert.equal(c.completedFocuses!.length,0);assert.throws(()=>cancelFocus(s,c.id));startFocus(s,c.id,'eco-audit');assert.equal(c.nationalFocus!.progress,0);assert.equal(c.treasury,paid-220);
});
test('all five regional programs and three unique courses for each major require actual eligibility and scientific prerequisites',()=>{
 const s=world();for(const owner of ['usa','russia','chn','germany','uk']){finish(s,'eco-audit',owner);const c=s.countries[owner]!,regional=FOCUS_IDS.find(id=>FOCUS_NODES[id]!.category==='Regional'&&focusBelongsTo(c,FOCUS_NODES[id]!))!;finish(s,regional,owner);const unique=FOCUS_IDS.filter(id=>FOCUS_NODES[id]!.country===owner&&!Object.hasOwn(FOCUS_EXPANSION,id));finish(s,unique[0]!,owner);finish(s,unique[1]!,owner);assert.match(focusAvailability(s,owner,unique[2]!)!,/научные/);grantTechnology(s,c,'eco-ledger');grantTechnology(s,c,'science-method');finish(s,unique[2]!,owner);assert.equal(c.completedFocuses!.length,5);assert.ok(focusBonuses(c).research>=.08);}
 for(const region of ['Africa','Asia','Americas','Europe','Oceania'])assert.ok(Object.values(s.countries).some(c=>c.region===region&&FOCUS_IDS.some(id=>FOCUS_NODES[id]!.region===region&&focusBelongsTo(c,FOCUS_NODES[id]!))));
});
test('course capabilities change actual supply, construction, research, combat and army upkeep',()=>{
 const s=world(),c=s.countries.germany!,army=s.armies.find(a=>a.ownerId===c.id)!,p=s.provinces.find(p=>p.id===army.provinceId)!,capacity=supplyAt(s,c.id,p.id).capacity,power=combatMultiplier(s,army,p,false),upkeep=militaryFundingCost(c);
 finish(s,'eco-audit');finish(s,'eco-corridors');assert.equal(supplyAt(s,c.id,p.id).capacity,Math.floor(capacity*1.05));const job=startConstruction(s,c.id,p,'Factory');s.tick++;completeConstructions(s);assert.equal(job.workDone,1.05);
 finish(s,'mil-staff');assert.ok(combatMultiplier(s,army,p,false)>power);assert.equal(army.experience,2);finish(s,'mil-supply');const reserve=c.manpower;finish(s,'mil-reserve');assert.equal(c.manpower,reserve+20000);assert.equal(focusBonuses(c).manpower,.08);finish(s,'mil-readiness');assert.equal(militaryFundingCost(c),upkeep*.97);
 finish(s,'pol-records');finish(s,'pol-service');startResearch(s,c,'Economy');monthlyResearch(s);const withCourse=c.research!.progress,plain=world();startResearch(plain,plain.countries.germany!,'Economy');monthlyResearch(plain);assert.ok(withCourse>plain.countries.germany!.research!.progress);invalidateSupply(s);
});
test('diplomatic courses affect real neighbor relations and proposal acceptance; enemies do not receive friendship',()=>{
 const s=world();diplomaticLink(s,'germany','france');diplomaticLink(s,'germany','poland');declareWar(s,'germany','france');const before=diplomacyAcceptance(s,'germany','poland',{kind:'Treaty',treaty:'TradeAgreement'}).score,enemy=diplomaticLink(s,'germany','france').relation;finish(s,'dip-contacts');assert.equal(diplomaticLink(s,'germany','france').relation,enemy);assert.equal(diplomaticLink(s,'germany','poland').relation,5);assert.ok(diplomacyAcceptance(s,'germany','poland',{kind:'Treaty',treaty:'TradeAgreement'}).score>=before+7);
});
test('current saves reject unknown/duplicate/impossible completions, invalid progress and orphaned or duplicate reward events',()=>{
 for(const mutate of [(s:ReturnType<typeof world>)=>{delete s.focusEvents;},(s:ReturnType<typeof world>)=>{delete s.countries.germany!.completedFocuses;},(s:ReturnType<typeof world>)=>{s.countries.germany!.completedFocuses=[{focusId:'unknown' as FocusId,tick:0}];},(s:ReturnType<typeof world>)=>{s.countries.germany!.completedFocuses=[{focusId:'eco-corridors',tick:8}];}]){const s=world();mutate(s);assert.throws(()=>validateCampaign(s));}
 for(const mutate of [(s:ReturnType<typeof world>)=>{s.countries.germany!.nationalFocus!.progress=NaN;},(s:ReturnType<typeof world>)=>{s.countries.germany!.nationalFocus!.lastTick=1;},(s:ReturnType<typeof world>)=>{Object.assign(s.countries.germany!.nationalFocus!,{reward:100});}]){const s=world();startFocus(s,'germany','eco-audit');mutate(s);assert.throws(()=>validateCampaign(s));}
 const valid=world();finish(valid,'eco-audit');for(const mutate of [(s:ReturnType<typeof world>)=>{s.countries.germany!.completedFocuses!.push(s.countries.germany!.completedFocuses![0]!);},(s:ReturnType<typeof world>)=>{s.countries.germany!.completedFocuses![0]!.tick=1;},(s:ReturnType<typeof world>)=>{s.focusEvents!.unshift({...s.focusEvents![0]!,id:'other'});},(s:ReturnType<typeof world>)=>{s.focusEvents![0]!.countryId='france';}]){const s=structuredClone(valid);mutate(s);assert.throws(()=>validateCampaign(s));}
});
test('old schema17 migrates with no invented rewards and creates a byte-exact focus backup before overwrite',async()=>{
 const old=world();old.stateVersion=17;delete old.focusEvents;for(const c of Object.values(old.countries))delete c.completedFocuses;const cash=old.countries.germany!.treasury,raw=JSON.stringify({format:1,metadata:{id:old.id,name:'old',generation:1},checksum:stateChecksum(old),state:old}),map=new Map([[old.id+'.1.json',raw]]),files:CampaignFiles={list:async()=>[...map.keys()],read:async n=>map.get(n)!,write:async(n,t)=>{map.set(n,t);},move:async(a,b)=>{map.set(b,map.get(a)!);map.delete(a);},remove:async n=>{map.delete(n);}};
 const store=new CampaignStore(files),loaded=await store.load(old.id);assert.equal(loaded.stateVersion,CURRENT_STATE_VERSION);assert.deepEqual(loaded.focusEvents,[]);assert.deepEqual(loaded.countries.germany!.completedFocuses,[]);assert.equal(loaded.countries.germany!.treasury,cash);await store.save(loaded);assert.equal(map.get(old.id+'.before-focus-v18.backup'),raw);
});
test('scheduled AI selects an affordable personality-matched course and retains its reserve',()=>{
 const s=world();s.phase='running';s.players=Object.keys(s.countries).filter(id=>id!=='germany').map((countryId,i)=>({id:'p'+i,countryId,displayName:'QA',ready:true,isHost:i===0}));s.tick=Object.keys(s.countries).sort().indexOf('germany')%6;const c=s.countries.germany!;s.leaders![c.rulerId!]!.aiPersonality='Economic';c.aiStrategy={personality:'Trade',goal:'Economy',sinceTick:s.tick,reviewTick:s.tick+6,reason:'Economic test plan'};runStrategicAI(s,{recruit:()=>{},move:()=>{}});assert.equal(c.nationalFocus?.focusId,'eco-audit');assert.ok(c.treasury>=strategicContext(s,c.id,[]).treasuryReserve);normalizeGameState(s);
});
test('focus history stays bounded and reserves a human completion while many AI courses start',()=>{
 const s=world();finish(s,'eco-audit');const human=s.focusEvents!.find(e=>e.kind==='Completed'&&e.countryId==='germany')!.id;
 for(const c of Object.values(s.countries).filter(c=>c.id!=='germany'))for(let attempt=0;attempt<2;attempt++){startFocus(s,c.id,'eco-audit');cancelFocus(s,c.id);}
 assert.equal(s.focusEvents!.length,256);assert.ok(s.focusEvents!.some(e=>e.id===human));initializeFocuses(s,false);
});
test('course dates near the safe integer limit reject before charging or creating an impossible saved project',()=>{
 const s=world();s.tick=Number.MAX_SAFE_INTEGER-1;const copy=structuredClone(s);assert.throws(()=>applyServerCommand(s,{type:'START_NATIONAL_FOCUS',playerId:'host',focusId:'eco-audit'},'host'));assert.deepEqual(s,copy);s.countries.germany!.nationalFocus={focusId:'eco-audit',startedTick:s.tick,lastTick:s.tick,progress:0};assert.throws(()=>initializeFocuses(s,false));
});
