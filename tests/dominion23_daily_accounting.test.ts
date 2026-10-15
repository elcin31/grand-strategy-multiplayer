import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {declareWar} from '../supabase/functions/_shared/diplomacySystem';
import {dailyMilitary,occupy} from '../supabase/functions/_shared/military3System';
import {recalcEconomy} from '../supabase/functions/_shared/economySystem';
import {startConstruction} from '../supabase/functions/_shared/buildingSystem';
import {encodeCampaign,decodeCampaign} from '../src/persistence/campaignCodec';
import {invalidateSupply} from '../supabase/functions/_shared/supplySystem';

test('daily attrition updates actual upkeep before pause or save without another accounting period',()=>{
 const s=createWorldState('daily-accounting','DAY231','host','QA',91),a=s.armies.find(a=>a.ownerId==='germany')!;
 const before=a.troops,oldUpkeep=s.countries.germany!.economy!.armyMaintenance;
 // An isolated province has no legal supply source, even in a large country.
 const p=s.provinces.find(p=>p.ownerId==='france')!;a.provinceId=p.id;p.neighbors=[];invalidateSupply(s);dailyMilitary(s);
 assert.ok(a.troops<before);assert.ok(s.countries.germany!.economy!.armyMaintenance<oldUpkeep);assert.equal(s.tick,0);
 const expected=structuredClone(s);recalcEconomy(expected);assert.deepEqual(s.countries.germany!.economy,expected.countries.germany!.economy);
 assert.deepEqual(decodeCampaign(encodeCampaign(s,1)).state,s);
});

test('empty-province occupation updates score and income, cancels pending projects and keeps finished buildings',()=>{
 const s=createWorldState('daily-occupation','DAY232','host','QA',91),a=s.armies.find(a=>a.ownerId==='germany')!,p=s.provinces.find(p=>p.ownerId==='france')!;
 p.buildings={Fort:1};s.countries.france!.treasury=100000;startConstruction(s,'france',p,'Farm');p.productionQueue=[{id:'owned-order',buildingType:'Factory',recipeId:'steel',quantity:10,produced:0}];
 declareWar(s,'germany','france');recalcEconomy(s);const score=s.wars![0]!.warScore??0,income=s.countries.france!.income;
 occupy(s,a,p);assert.equal(p.ownerId,'france');assert.equal(p.controllerId,'germany');assert.equal(p.buildings.Fort,1);
 assert.ok(!s.constructions!.some(x=>x.provinceId===p.id));assert.deepEqual(p.productionQueue,[]);assert.ok((s.wars![0]!.warScore??0)>score);assert.ok(s.countries.france!.income<income);
 assert.deepEqual(decodeCampaign(encodeCampaign(s,1)).state,s);
});
