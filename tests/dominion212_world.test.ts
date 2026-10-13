import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {runStrategicAI,warDecisionScore,strategicContext} from '../supabase/functions/_shared/aiSystem';
import {declareWar,diplomaticLink} from '../supabase/functions/_shared/diplomacySystem';
import {offerDiplomacy} from '../supabase/functions/_shared/diplomacy2System';
import {monthlyGeopolitics,openCrisis,resolveCrisis,collectGeopolitics} from '../supabase/functions/_shared/geopoliticsSystem';
import {applyServerCommand} from '../supabase/functions/_shared/serverCommand';
import {refreshWars} from '../supabase/functions/_shared/warSystem';
const noop={recruit:()=>{},move:()=>{}};
function fixture(style:'Expansionist'|'Diplomatic'='Expansionist'){
 const s=createWorldState('world212','WD212A','host','QA');s.phase='running';s.players=Object.keys(s.countries).filter(id=>id!=='germany').map((countryId,n)=>({id:'p'+n,countryId,displayName:'QA',ready:true,isHost:n===0}));
 s.tick=Object.keys(s.countries).sort().indexOf('germany')%3;const c=s.countries.germany!;c.treasury=100000;c.army=500000;c.manpower=100000;c.stability=100;c.politicalPower=500;c.economy!.monthlyBalance=5000;s.countries.poland!.army=10000;s.leaders![c.rulerId!]!.aiPersonality=style;return s;
}
test('a prepared expansionist AI declares a justified war and an exhausted conflict reaches peace',()=>{
 const s=fixture();const disputed=s.provinces.find(p=>p.ownerId==='poland'&&p.neighbors.some(id=>s.provinces.find(q=>q.id===id)?.ownerId==='germany'))!;disputed.originalOwnerId='germany';
 assert.ok(warDecisionScore(s,'germany','poland',strategicContext(s,'germany',['poland']),1)>=40);runStrategicAI(s,noop);const war=s.wars!.find(w=>w.attackers[0]==='germany')!;assert.ok(war);assert.ok(war.goals?.germany);
 s.players=s.players.filter(p=>p.countryId!==war.defenders[0]);s.tick+=24;s.countries.germany!.warExhaustion=80;for(const p of s.provinces)if(war.defenders.includes(p.ownerId))p.controllerId='germany';refreshWars(s);runStrategicAI(s,noop);assert.equal(s.wars!.length,0);assert.ok(s.warHistory!.length);assert.ok(diplomaticLink(s,'germany',war.defenders[0]!).truceUntilTick>s.tick);
});
test('AI offers an alliance and evaluates both acceptable and hostile diplomatic offers',()=>{
 const s=fixture('Diplomatic');const link=diplomaticLink(s,'germany','aut');link.relation=85;link.baselineRelation=85;s.players=s.players.filter(p=>p.countryId!=='aut');runStrategicAI(s,noop);assert.ok(diplomaticLink(s,'germany','aut').treaties.includes('Alliance'));
 const bad=diplomaticLink(s,'germany','france');bad.relation=-80;bad.baselineRelation=-80;s.players=s.players.filter(p=>p.countryId!=='france');offerDiplomacy(s,'germany','france',{kind:'Treaty',treaty:'Alliance'});assert.equal(bad.treaties.includes('Alliance'),false);assert.ok(s.diplomaticHistory!.some(e=>e.kind==='OfferRejected'));
});
test('threat forms a real defensive coalition and a crisis can end without war',()=>{
 const s=createWorldState('threat212','TH212A','host','QA');s.phase='paused';s.players[0]!.countryId='germany';s.countries.germany!.internationalThreat=70;
 for(const id of ['poland','aut','france'])s.countries[id]!.regionalInterests={neighbours:['germany'],rivals:['germany'],partners:[],claimedProvinceIds:[],reviewTick:6,reason:'Defence'};
 monthlyGeopolitics(s);const coalition=s.coalitions!.find(c=>c.targetId==='germany')!;assert.ok(coalition);const war=declareWar(s,'germany','poland');assert.ok(war.defenders.includes('aut'));assert.ok(war.defenders.includes('france'));
 const calm=createWorldState('crisis212','CR212A','host','QA');calm.phase='paused';const p=calm.provinces.find(p=>p.ownerId==='poland')!;openCrisis(calm,'germany','poland',p.id,'Border','Спорная граница');assert.ok(calm.diplomaticCrises!.length);resolveCrisis(calm,'poland',calm.diplomaticCrises![0]!.id,'Negotiate');assert.equal(calm.wars!.length,0);assert.equal(calm.diplomaticCrises![0]!.status,'Resolved');assert.ok(diplomaticLink(calm,'germany','poland').truceUntilTick>calm.tick);
 const before=structuredClone(s);collectGeopolitics(before,s);assert.ok(s.countries.germany!.internationalThreat!>=60);
});
test('only the host can set the shared server difficulty',()=>{let s=createWorldState('difficulty212','DF212A','host','QA');s.players.push({id:'guest',displayName:'B',countryId:'poland',isHost:false,ready:false});assert.throws(()=>applyServerCommand(s,{type:'SET_AI_DIFFICULTY',playerId:'guest',difficulty:'VeryHard'},'guest'));s=applyServerCommand(s,{type:'SET_AI_DIFFICULTY',playerId:'host',difficulty:'Hard'},'host');assert.equal(s.aiDifficulty,'Hard');});
