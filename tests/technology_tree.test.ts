import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {applyServerCommand} from '../supabase/functions/_shared/serverCommand';
import {normalizeGameState,CURRENT_STATE_VERSION} from '../supabase/functions/_shared/stateMigrations';
import {TECHNOLOGY_DIRECTIONS,TECHNOLOGY_IDS,hasTechnology,grantTechnology,namedResearchQuote,initializeTechnologyTree,scienceLevel,technologyNode,type TechnologyId} from '../supabase/functions/_shared/technologyTree';
import {startResearch,monthlyResearch,TECHNOLOGY_BRANCHES} from '../supabase/functions/_shared/technologySystem';
import {money,monthlyEconomy,recalcEconomy} from '../supabase/functions/_shared/economySystem';
import {researchMonthlyCost} from '../supabase/functions/_shared/economy2System';
import {startConstruction,completeConstructions,constructionProgress} from '../supabase/functions/_shared/buildingSystem';
import {cancelConstruction} from '../supabase/functions/_shared/constructionQueueSystem';
import {supplyAt,invalidateSupply} from '../supabase/functions/_shared/supplySystem';
import {espionageQuote} from '../supabase/functions/_shared/espionageSystem';
import {runStrategicAI,strategicContext} from '../supabase/functions/_shared/aiSystem';
import {encodeCampaign,decodeCampaign,validateCampaign} from '../src/persistence/campaignCodec';
import {CampaignStore,type CampaignFiles} from '../src/persistence/campaignStore';
import {stateChecksum} from '../supabase/functions/_shared/sessionState';
function world(){const s=createWorldState('tech-tree','TREE01','host','QA',101);s.phase='paused';s.speed=0;s.players[0]!.countryId='germany';s.players.push({id:'guest',displayName:'France',countryId:'france',isHost:false,ready:true,connected:true,aiControlled:false,lastSeen:0});s.countries.germany!.treasury=20000;return s;}
function scientific(s:ReturnType<typeof world>,ids:TechnologyId[]=['science-method']){const c=s.countries.germany!;for(const b of TECHNOLOGY_BRANCHES)c.technologies![b]=5;for(const id of ids)grantTechnology(s,c,id);recalcEconomy(s);return c;}
test('five original directions have thirty known, era-ordered nodes in an acyclic prerequisite graph',()=>{
  assert.equal(Object.keys(TECHNOLOGY_DIRECTIONS).length,5);assert.equal(TECHNOLOGY_IDS.length,30);
  const complete=new Set<string>(),visiting=new Set<string>();function visit(id:string){assert.ok(technologyNode(id));assert.ok(!visiting.has(id),'cycle');if(complete.has(id))return;visiting.add(id);const n=technologyNode(id)!;assert.ok(n.cost>0&&n.months>0&&n.effect&&n.art);for(const p of n.prerequisites){assert.ok(technologyNode(p)!.year<=n.year);visit(p);}visiting.delete(id);complete.add(id);}
  for(const id of TECHNOLOGY_IDS)visit(id);assert.equal(complete.size,30);assert.equal(technologyNode('__proto__'),undefined);assert.equal(technologyNode('toString'),undefined);
});
test('named research validates era, dependencies, active project, owner, phase and forged costs without mutating the source',()=>{
  const s=world(),copy=structuredClone(s),cmd={type:'START_TECHNOLOGY',playerId:'host',nodeId:'eco-ledger'} as const,n=applyServerCommand(s,cmd,'host');assert.deepEqual(s,copy);assert.equal(n.countries.germany!.treasury,19850);assert.equal(n.countries.germany!.research!.nodeId,'eco-ledger');
  for(const changed of [{...cmd,playerId:'guest'},{...cmd,nodeId:'science-method'},{...cmd,nodeId:'eco-planning'},{...cmd,nodeId:'toString'},{...cmd,cost:0}])assert.throws(()=>applyServerCommand(s,changed as never,'host'));
  assert.throws(()=>applyServerCommand(n,cmd,'host'));s.year=1850;assert.match(namedResearchQuote(s,s.countries.germany!,'mil-staff').reason!,/1900/);s.phase='lobby';assert.ok(namedResearchQuote(s,s.countries.germany!,'eco-ledger').reason);
});
test('funded science progresses by month, debits the real budget including completion, and cannot reward twice',()=>{
  let s=world();grantTechnology(s,s.countries.germany!,'eco-ledger');s=applyServerCommand(s,{type:'START_TECHNOLOGY',playerId:'host',nodeId:'science-method'},'host');const c=s.countries.germany!;assert.equal(c.treasury,19820);assert.equal(researchMonthlyCost(c),15);
  const cash=c.treasury,balance=c.economy!.monthlyBalance;s.tick++;monthlyEconomy(s);assert.equal(c.treasury,money(cash+balance));monthlyResearch(s);assert.ok(c.research!.progress>0);assert.equal(scienceLevel(c),0);
  while(c.research){s.tick++;monthlyEconomy(s);monthlyResearch(s);}assert.deepEqual(c.scientificDiscoveries,['science-method']);assert.equal(c.economy!.researchMaintenance,0);const copy=structuredClone(s);monthlyResearch(s);assert.deepEqual(s,copy);assert.throws(()=>grantTechnology(s,c,'science-method'));assert.deepEqual(decodeCampaign(encodeCampaign(s,1)).state,s);
});
test('science prerequisites are enforced across directions and default pauses paid scientific work',()=>{
  let s=world();grantTechnology(s,s.countries.germany!,'eco-ledger');grantTechnology(s,s.countries.germany!,'science-method');assert.ok(namedResearchQuote(s,s.countries.germany!,'science-academies').reason);grantTechnology(s,s.countries.germany!,'state-registry');assert.equal(namedResearchQuote(s,s.countries.germany!,'science-academies').reason,null);
  s=applyServerCommand(s,{type:'START_TECHNOLOGY',playerId:'host',nodeId:'science-academies'},'host');const c=s.countries.germany!;c.bankruptcyUntilTick=s.tick+3;s.tick++;monthlyResearch(s);recalcEconomy(s);assert.equal(c.research!.progress,0);assert.equal(c.economy!.researchMaintenance,0);assert.equal(researchMonthlyCost(c,s.tick),0);s.tick=3;recalcEconomy(s);assert.equal(c.economy!.researchMaintenance,30);
});
test('scientific discoveries accelerate actual research and increase mission success without changing detection',()=>{
  const a=world(),b=world();for(const s of [a,b]){s.countries.germany!.technologies!.Economy=1;startResearch(s,s.countries.germany!,'Military');}grantTechnology(b,b.countries.germany!,'science-method');monthlyResearch(a);monthlyResearch(b);assert.ok(b.countries.germany!.research!.progress>a.countries.germany!.research!.progress);
  const q=espionageQuote(a,'germany','france','Sabotage'),advanced=espionageQuote(b,'germany','france','Sabotage');assert.equal(advanced.successChance,q.successChance+2);assert.equal(advanced.detectionChance,q.detectionChance);
});
test('infrastructure and science accelerate paid construction, persist fractional work and never re-credit a tick',()=>{
  const s=world(),c=scientific(s),p=s.provinces.find(p=>p.ownerId==='germany')!,job=startConstruction(s,c.id,p,'University');const cash=c.treasury;
  for(let tick=1;tick<=15;tick++){s.tick=tick;completeConstructions(s);if(tick<15){const copy=structuredClone(s);completeConstructions(s);assert.deepEqual(s,copy);assert.deepEqual(decodeCampaign(encodeCampaign(s,1)).state,s);}}
  assert.equal(p.buildings!.University,1);assert.ok(s.tick<job.completeTick);assert.equal(c.treasury,cash);completeConstructions(s);assert.equal(p.buildings!.University,1);
});
test('cancellation refunds only unused accelerated work and rejects forged progress',()=>{
  const s=world(),c=scientific(s),p=s.provinces.find(p=>p.ownerId==='germany')!,job=startConstruction(s,c.id,p,'Factory');s.tick=1;completeConstructions(s);const cash=c.treasury,refund=money(job.cost*.5*(1-job.workDone!/12));assert.ok(constructionProgress(s,job).percent>8);const copy=structuredClone(s);copy.constructions![0]!.workDone=Infinity;assert.throws(()=>validateCampaign(copy));copy.constructions![0]!.workDone=1;copy.constructions![0]!.workTick=s.tick+1;assert.throws(()=>validateCampaign(copy));cancelConstruction(s,c.id,job.id);assert.equal(c.treasury,money(cash+refund));assert.throws(()=>cancelConstruction(s,c.id,job.id));
});
test('infrastructure technology expands the actual supply capacity of a controlled node',()=>{
  const s=world(),army=s.armies.find(a=>a.ownerId==='germany')!,before=supplyAt(s,army.ownerId,army.provinceId).capacity;assert.ok(before>0);grantTechnology(s,s.countries.germany!,'infra-rail');invalidateSupply(s);assert.equal(supplyAt(s,army.ownerId,army.provinceId).capacity,Math.floor(before*1.04));
});
test('named technology exchange requires actual discovery and human consent; no skipped nodes or duplicated active research',()=>{
  let s=world();grantTechnology(s,s.countries.germany!,'eco-ledger');grantTechnology(s,s.countries.germany!,'science-method');grantTechnology(s,s.countries.france!,'eco-ledger');grantTechnology(s,s.countries.france!,'mil-staff');
  s=applyServerCommand(s,{type:'OFFER_DIPLOMACY',playerId:'host',targetId:'france',terms:{kind:'TechnologyExchange',give:'science-method',receive:'mil-staff'}},'host');assert.equal(scienceLevel(s.countries.france!),0);const id=s.diplomaticOffers![0]!.id;s=applyServerCommand(s,{type:'RESPOND_DIPLOMACY',playerId:'guest',offerId:id,accept:true},'guest');assert.ok(hasTechnology(s.countries.france!,'science-method'));assert.ok(hasTechnology(s.countries.germany!,'mil-staff'));assert.throws(()=>applyServerCommand(s,{type:'RESPOND_DIPLOMACY',playerId:'guest',offerId:id,accept:true},'guest'));
  const missing=world();scientific(missing);grantTechnology(missing,missing.countries.france!,'mil-staff');assert.throws(()=>applyServerCommand(missing,{type:'OFFER_DIPLOMACY',playerId:'host',targetId:'france',terms:{kind:'TechnologyExchange',give:'science-method',receive:'Military'}},'host'));
  const active=world();scientific(active);grantTechnology(active,active.countries.france!,'eco-ledger');startResearch(active,active.countries.france!,'Military');grantTechnology(active,active.countries.france!,'comm-post');assert.throws(()=>applyServerCommand(active,{type:'OFFER_DIPLOMACY',playerId:'host',targetId:'france',terms:{kind:'TechnologyExchange',give:'mil-staff',receive:'comm-post'}},'host'));
});
test('current schema rejects unknown, duplicated, missing-prerequisite discoveries and malformed named projects',()=>{
  for(const discoveries of [['science-method'],['__proto__'],['eco-ledger'],['science-method','science-method']]){const s=world();s.countries.germany!.scientificDiscoveries=discoveries as TechnologyId[];assert.throws(()=>initializeTechnologyTree(s,false));}
  for(const changed of [{nodeId:'science-method'}, {nodeId:''},{nodeId:'eco-production'}, {nodeId:'eco-ledger',branch:'Science'}]){let s=applyServerCommand(world(),{type:'START_TECHNOLOGY',playerId:'host',nodeId:'eco-ledger'},'host');Object.assign(s.countries.germany!.research!,changed);assert.throws(()=>validateCampaign(s));}
});
test('schema16 paid research, legacy levels and exact old bytes survive migration and backup',async()=>{
  const old=world();startResearch(old,old.countries.germany!,'Economy');old.tick=3;old.countries.germany!.research!.progress=2.75;delete old.countries.germany!.research!.nodeId;old.countries.france!.technologies!.Military=5;old.stateVersion=16;for(const c of Object.values(old.countries))delete c.scientificDiscoveries;
  const cash=old.countries.germany!.treasury,raw=JSON.stringify({format:1,metadata:{id:old.id,name:'old',generation:1},checksum:stateChecksum(old),state:old}),map=new Map([[old.id+'.1.json',raw]]);const files:CampaignFiles={list:async()=>[...map.keys()],read:async n=>map.get(n)!,write:async(n,t)=>{map.set(n,t);},move:async(a,b)=>{map.set(b,map.get(a)!);map.delete(a);},remove:async n=>{map.delete(n);}};
  const store=new CampaignStore(files),loaded=await store.load(old.id);assert.equal(loaded.stateVersion,CURRENT_STATE_VERSION);assert.equal(loaded.countries.germany!.research!.progress,2.75);assert.equal(loaded.countries.germany!.treasury,cash);assert.ok(hasTechnology(loaded.countries.france!,'mil-precision'));assert.deepEqual(loaded.countries.germany!.scientificDiscoveries,[]);await store.save(loaded);assert.equal(map.get(old.id+'.before-technology-v17.backup'),raw);
});
test('scheduled AI selects an affordable eligible scientific project after balancing inherited branches',()=>{
  const s=world();s.phase='running';s.players=Object.keys(s.countries).filter(id=>id!=='germany').map((countryId,i)=>({id:'p'+i,countryId,displayName:'QA',ready:true,isHost:i===0}));s.tick=Object.keys(s.countries).sort().indexOf('germany')%6;const c=s.countries.germany!;for(const branch of TECHNOLOGY_BRANCHES)c.technologies![branch]=1;runStrategicAI(s,{recruit:()=>{},move:()=>{}});assert.equal(c.research?.nodeId,'science-method');assert.ok(c.treasury>=strategicContext(s,c.id,[]).treasuryReserve);normalizeGameState(s);
});
