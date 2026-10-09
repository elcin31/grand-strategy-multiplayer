import {test} from 'node:test';import assert from 'node:assert/strict';
import oldCities from './fixtures/cities-v4.json';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {migrateCityCatalogue} from '../supabase/functions/_shared/cityMigration';
import {validateCampaign,decodeCampaign} from '../src/persistence/campaignCodec';
import {CampaignStore,type CampaignFiles} from '../src/persistence/campaignStore';
import {stateChecksum} from '../supabase/functions/_shared/sessionState';
import {removedCityMapping} from '../supabase/functions/_shared/cityReductionMap';
import {initializePopulation,monthlyPopulationGrowth} from '../supabase/functions/_shared/populationSystem';
const oldWorld=()=>{const s=createWorldState('city-migration','CITIES','host','QA',101);s.stateVersion=11;s.cities=structuredClone(oldCities);for(const p of s.provinces)p.cityIds=s.cities.filter(c=>c.provinceId===p.id).map(c=>c.id);initializePopulation(s);return s;};
const urban=(s:ReturnType<typeof oldWorld>)=>s.cities!.reduce((n,c)=>n+c.population,0);
test('real v4 campaign migrates every removed reference preserving protected centers/capitals/urban and province population',()=>{
 const old=oldWorld(),original=structuredClone(old),migrated=validateCampaign(old),ids=new Set(migrated.cities!.map(c=>c.id));
 assert.equal(old.cities!.length,7214);assert.equal(migrated.cities!.length,5411);assert.equal(migrated.stateVersion,12);assert.deepEqual(old,original);assert.equal(urban(old),urban(migrated));assert.equal(migrated.cities!.filter(c=>c.isCapital).length,195);assert.equal(migrated.cities!.filter(c=>c.isRegionalCapital).length,2225);
 for(const p of migrated.provinces){assert.ok(p.cityIds!.every(id=>ids.has(id)));assert.equal(p.population,old.provinces.find(q=>q.id===p.id)!.population);assert.equal(migrated.cities!.filter(c=>c.provinceId===p.id).reduce((n,c)=>n+c.population,0),old.cities!.filter(c=>c.provinceId===p.id).reduce((n,c)=>n+c.population,0));}
 assert.deepEqual(migrated.countries,old.countries);assert.deepEqual(migrated.armies,old.armies);const again=validateCampaign(migrated);assert.deepEqual(again,migrated);
});
test('migration retains captured ownership, city development and fractional growth reserve',()=>{
 const s=oldWorld(),[removed,replacement]=Object.entries(removedCityMapping)[0]!,from=s.cities!.find(c=>c.id===removed)!,to=s.cities!.find(c=>c.id===replacement)!,p=s.provinces.find(p=>p.id===from.provinceId)!;
 p.ownerId='usa';for(const c of s.cities!.filter(c=>c.provinceId===p.id))c.countryId='usa';from.populationGrowthCarry=.8;to.populationGrowthCarry=.7;
 const population=urban(s),weighted=s.cities!.filter(c=>c.provinceId===p.id).reduce((n,c)=>n+c.population*c.development,0);
 migrateCityCatalogue(s);assert.equal(urban(s),population);assert.equal(to.countryId,'usa');assert.equal(to.populationGrowthCarryReserve,1);assert.ok(Math.abs(to.populationGrowthCarry!-.5)<1e-9);assert.ok(Math.abs(s.cities!.filter(c=>c.provinceId===p.id).reduce((n,c)=>n+c.population*c.development,0)-weighted)<1e-5);
 monthlyPopulationGrowth(s);assert.ok(urban(s)>=population);assert.equal(to.populationGrowthCarryReserve,undefined);
});
test('invalid destination rejects migration before mutation',()=>{const s=oldWorld(),[id,target]=Object.entries(removedCityMapping)[0]!;s.cities=s.cities!.filter(c=>c.id!==target);const before=structuredClone(s);assert.throws(()=>migrateCityCatalogue(s),/перенести/);assert.deepEqual(s,before);assert.ok(s.cities.some(c=>c.id===id));});
test('first save after restore preserves byte-exact pre-migration backup and old checksum decodes',async()=>{
 const s=oldWorld(),m={id:s.id,name:'v4',country:null,year:2026,month:1,tick:0,lastPlayed:1,gameVersion:'0.6.0',stateVersion:11,generation:1};const text=JSON.stringify({format:1,metadata:m,checksum:stateChecksum(s),state:s});assert.equal(decodeCampaign(text).state.cities!.length,5411);
 const map=new Map([[s.id+'.1.json',text]]),files:CampaignFiles={list:async()=>[...map.keys()],read:async n=>map.get(n)!,write:async(n,t)=>{map.set(n,t);},move:async(a,b)=>{map.set(b,map.get(a)!);map.delete(a);},remove:async n=>{map.delete(n);}};
 const store=new CampaignStore(files),restored=await store.load(s.id);await store.save(restored);assert.equal(map.get(s.id+'.before-city-v12.backup'),text);await store.save(restored);assert.equal(map.get(s.id+'.before-city-v12.backup'),text);assert.equal((await store.load(s.id)).cities!.length,5411);
});
