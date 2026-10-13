import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {applyServerCommand} from '../supabase/functions/_shared/serverCommand';
import {processArmyFormations,formationQuote} from '../supabase/functions/_shared/armyFormationSystem';
import {armyETA} from '../supabase/functions/_shared/military3System';
import {applyCommand} from '../supabase/functions/_shared/gameEngine';
import {encodeCampaign,decodeCampaign} from '../src/persistence/campaignCodec';
function fixture(){const s=createWorldState('independent','IA212A','host','QA');s.players[0]!.countryId='germany';s.phase='paused';s.speed=0;const c=s.countries.germany!;c.manpower=1_000_000;c.treasury=50000;c.stockpile!.amounts.weapons=1000;c.stockpile!.amounts.ammunition=1000;const p=s.provinces.find(p=>p.ownerId===c.id&&p.neighbors.filter(id=>s.provinces.find(q=>q.id===id)?.ownerId===c.id).length>=2)!;p.buildings={...p.buildings,Barracks:5,MilitaryBase:5};return {s,c,p};}
test('two 310000 formations have separate IDs, real costs, save/load and independent routes',()=>{
 let {s,c,p}=fixture();const before={cash:c.treasury,manpower:c.manpower,weapons:c.stockpile!.amounts.weapons!},quote=formationQuote(s,c.id,p.id,{Infantry:310000});
 for(const name of ['1-я армия','Кавказская армия'])s=applyServerCommand(s,{type:'CREATE_NEW_ARMY',playerId:'host',name,provinceId:p.id,composition:{Infantry:310000},commanderId:null},'host');
 assert.equal(s.armyFormations!.length,2);const ids=s.armyFormations!.map(q=>q.armyId);assert.notEqual(ids[0],ids[1]);assert.equal(s.countries.germany!.manpower,before.manpower-620000);assert.equal(s.countries.germany!.treasury,before.cash-quote.cost*2);assert.equal(s.countries.germany!.stockpile!.amounts.weapons,before.weapons-quote.materials.weapons!*2);
 for(let day=1;day<=12;day++){s.simulationDay=day;processArmyFormations(s);}assert.equal(s.armyFormations!.length,0);
 const a=s.armies.find(a=>a.id===ids[0])!,b=s.armies.find(a=>a.id===ids[1])!;assert.equal(a.troops,310000);assert.equal(b.troops,310000);
 const neighbours=p.neighbors.map(id=>s.provinces.find(p=>p.id===id)!).filter(p=>p.ownerId==='germany');assert.ok(neighbours.length>=2);
 s=applyServerCommand(s,{type:'ORDER_ARMY',playerId:'host',armyId:a.id,provinceId:neighbours[0]!.id},'host');s=applyServerCommand(s,{type:'ORDER_ARMY',playerId:'host',armyId:b.id,provinceId:neighbours[1]!.id},'host');
 const restored=decodeCampaign(encodeCampaign(s,1)).state;assert.equal(restored.armies.find(x=>x.id===a.id)!.name,'1-я армия');assert.notDeepEqual(restored.armies.find(x=>x.id===a.id)!.order,restored.armies.find(x=>x.id===b.id)!.order);
 s=restored;s.phase='running';s.speed=3;const days=Math.max(armyETA(s,s.armies.find(x=>x.id===a.id)!),armyETA(s,s.armies.find(x=>x.id===b.id)!));for(let n=0;n<days+12;n++){s=applyCommand(s,{type:'ADVANCE_DAY'},true);if(!s.armies.find(x=>x.id===a.id)!.order&&!s.armies.find(x=>x.id===b.id)!.order)break;}assert.equal(s.armies.find(x=>x.id===a.id)!.provinceId,neighbours[0]!.id);assert.equal(s.armies.find(x=>x.id===b.id)!.provinceId,neighbours[1]!.id);
});
test('server rejects forged strength/resources and partial cancellation refunds only unformed soldiers',()=>{
 let {s,p}=fixture();const start=s.countries.germany!.manpower;
 assert.throws(()=>applyServerCommand(s,{type:'CREATE_NEW_ARMY',playerId:'host',name:'Forgery',provinceId:p.id,composition:{Infantry:1000001},commanderId:null},'host'));
 assert.throws(()=>applyServerCommand(s,{type:'CREATE_NEW_ARMY',playerId:'host',name:'Forgery',provinceId:p.id,composition:{Infantry:10000},commanderId:null,cost:0} as never,'host'));
 s=applyServerCommand(s,{type:'CREATE_NEW_ARMY',playerId:'host',name:'Reserve',provinceId:p.id,composition:{Infantry:310000},commanderId:null},'host');s.simulationDay=1;processArmyFormations(s);const q=s.armyFormations![0]!,formed=s.armies.find(a=>a.id===q.armyId)!.troops;
 assert.throws(()=>applyServerCommand(s,{type:'ORDER_ARMY',playerId:'host',armyId:q.armyId,provinceId:p.neighbors[0]!},'host'),/формируется/);
 s=applyServerCommand(s,{type:'CANCEL_ARMY_FORMATION',playerId:'host',formationId:q.id},'host');assert.equal(s.countries.germany!.manpower,start-formed);assert.equal(s.armies.find(a=>a.id===q.armyId)!.troops,formed);assert.equal(s.armyFormations!.length,0);decodeCampaign(encodeCampaign(s,1));
});

test('a subsequent military ceiling blocks queued recruits and displaced training refunds unused reserve',()=>{
 let {s,p}=fixture();s=applyServerCommand(s,{type:'CREATE_NEW_ARMY',playerId:'host',name:'Limited',provinceId:p.id,composition:{Infantry:10000},commanderId:null},'host');const queued=s.armyFormations![0]!,afterPayment=s.countries.germany!.manpower;s.countries.germany!.militaryCeiling={untilTick:12,troops:s.countries.germany!.army};s.simulationDay=1;processArmyFormations(s);assert.equal(s.armyFormations![0]!.status,'Blocked');assert.equal(s.armies.some(a=>a.id===queued.armyId),false);
 delete s.countries.germany!.militaryCeiling;s.simulationDay=2;processArmyFormations(s);const a=s.armies.find(a=>a.id===queued.armyId)!;assert.equal(a.troops,10000);assert.equal(s.countries.germany!.manpower,afterPayment);
 // A still-training formation that must evacuate does not receive teleported recruits.
 s=applyServerCommand(s,{type:'CREATE_NEW_ARMY',playerId:'host',name:'Evacuated',provinceId:p.id,composition:{Infantry:310000},commanderId:null},'host');s.simulationDay=3;processArmyFormations(s);const q=s.armyFormations![0]!,field=s.armies.find(a=>a.id===q.armyId)!,trained=field.troops,reserve=s.countries.germany!.manpower;field.provinceId=p.neighbors.find(id=>s.provinces.find(p=>p.id===id)?.ownerId==='germany')!;s.simulationDay=4;processArmyFormations(s);assert.equal(s.armyFormations!.length,0);assert.equal(field.troops,trained);assert.equal(s.countries.germany!.manpower,reserve+310000-trained);decodeCampaign(encodeCampaign(s,1));
});
