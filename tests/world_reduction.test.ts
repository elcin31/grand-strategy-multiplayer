import {test} from 'node:test';import assert from 'node:assert/strict';
import mapping from '../src/world/data/province-v4-mapping.json';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {validateCampaign} from '../src/persistence/campaignCodec';
import {monthlyPopulationGrowth} from '../supabase/functions/_shared/populationSystem';
import {recalcEconomy} from '../supabase/functions/_shared/economySystem';
import {startConstruction,completeConstructions} from '../supabase/functions/_shared/buildingSystem';
test('reduced world retains every source region, city, capital, population and reciprocal graph',()=>{
 const s=createWorldState('reduced','REDUCE','host','Test',101),ids=new Map(s.provinces.map(p=>[p.id,p]));
 assert.equal(Object.keys(mapping).length,4386);assert.equal(new Set(Object.values(mapping)).size,2924);assert.equal(ids.size,2924);assert.equal(s.cities!.length,7214);assert.equal(Object.keys(s.countries).length,195);assert.equal(s.provinces.reduce((n,p)=>n+p.population,0),7632252811);
 for(const p of s.provinces){assert.ok(!p.neighbors.includes(p.id));for(const id of p.neighbors)assert.ok(ids.get(id)?.neighbors.includes(p.id));assert.ok(p.resourceDeposit);}
 for(const c of s.cities!)assert.ok(ids.has(c.provinceId));for(const c of Object.values(s.countries)){assert.ok(c.provinceIds!.length);assert.ok(s.cities!.find(city=>city.id===c.capitalCityId&&city.isCapital));}
 const old=structuredClone(s);old.dataset='modern-world-v1';assert.throws(()=>validateCampaign(old),/v3/);assert.equal(old.dataset,'modern-world-v1');
 const before=s.provinces.reduce((n,p)=>n+p.income,0);monthlyPopulationGrowth(s);assert.ok(s.provinces.reduce((n,p)=>n+p.income,0)>=before*.99,'consolidation must not delete small-region income on first month');
});
test('factory completes once, produces revenue and administration offsets explicit upkeep',()=>{
 const s=createWorldState('build','BUILD1','host','Test',101),c=s.countries.germany!,p=s.provinces.find(p=>p.ownerId===c.id)!;c.treasury=100000;
 const quote=startConstruction(s,c.id,p,'Factory');assert.equal(Object.keys(p.buildings??{}).length,0);s.tick=quote.completeTick;completeConstructions(s);recalcEconomy(s);assert.equal(p.buildings?.Factory,1);assert.ok(c.economy!.productionIncome>0);assert.ok(c.economy!.buildingMaintenance>0);
 completeConstructions(s);assert.equal(p.buildings?.Factory,1);const before=c.economy!.administrationMaintenance;p.buildings!.Administration=1;recalcEconomy(s);assert.ok(c.economy!.administrationMaintenance<before);
});
