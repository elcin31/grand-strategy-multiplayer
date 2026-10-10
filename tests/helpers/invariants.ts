import assert from 'node:assert/strict';
import type {GameState} from '../../supabase/functions/_shared/gameTypes';
import {initializeDiplomacy2} from '../../supabase/functions/_shared/diplomacy2System';
export function assertInvariants(s:GameState):void {
 const numbers=(v:unknown):void=>{if(typeof v==='number')assert.ok(Number.isFinite(v),'Non-finite state');else if(v&&typeof v==='object')for(const x of Object.values(v))numbers(x);};numbers(s);
 const unique=(rows:{id:string}[])=>assert.equal(new Set(rows.map(x=>x.id)).size,rows.length,'Duplicate entity');
 unique(s.provinces);unique(s.armies);unique(s.players);unique(s.cities??[]);
 unique(s.relationMissions??[]);unique(s.diplomaticOffers??[]);unique(s.diplomaticHistory??[]);unique(s.politicalUnions??[]);
 if(s.dataset)initializeDiplomacy2(s,false);
 const provinces=new Map(s.provinces.map(p=>[p.id,p])),population=new Map<string,number>(),armies=new Map<string,number>(),urban=new Map<string,number>();
 for(const p of s.provinces){assert.ok(Object.hasOwn(s.countries,p.ownerId));assert.ok(Object.hasOwn(s.countries,p.controllerId??p.ownerId));assert.ok(Number.isSafeInteger(p.population)&&p.population>=0);assert.ok(p.neighbors.every(n=>provinces.has(n)));population.set(p.ownerId,(population.get(p.ownerId)??0)+p.population);}
 for(const city of s.cities??[]){assert.equal(city.countryId,provinces.get(city.provinceId)?.ownerId);assert.ok(Number.isSafeInteger(city.population)&&city.population>=0);urban.set(city.provinceId,(urban.get(city.provinceId)??0)+city.population);}
 for(const [id,n] of urban)assert.ok(n<=provinces.get(id)!.population,'Urban population exceeds province');
 for(const a of s.armies){assert.ok(provinces.has(a.provinceId)&&Object.hasOwn(s.countries,a.ownerId));assert.ok(Number.isSafeInteger(a.troops)&&a.troops>0);armies.set(a.ownerId,(armies.get(a.ownerId)??0)+a.troops);}
 for(const c of Object.values(s.countries)){assert.ok(c.treasury>=0&&c.treasury<=Number.MAX_SAFE_INTEGER/1000);assert.ok(c.manpower>=0&&c.stability>=0&&c.stability<=100);assert.equal(c.population,population.get(c.id)??0);assert.equal(c.army,armies.get(c.id)??0);assert.ok(c.debt!>=0);if(c.overlordId)assert.ok(c.overlordId!==c.id&&!s.countries[c.overlordId]!.overlordId);}
 const participants=new Set<string>();for(const w of s.wars??[]){const ids=[...w.attackers,...w.defenders];assert.equal(new Set(ids).size,ids.length);for(const id of ids){assert.ok(s.countries[id]&&!participants.has(id));participants.add(id);}assert.ok(Math.abs(w.warScore??0)<=100);for(const n of Object.values(w.casualties??{}))assert.ok(Number.isSafeInteger(n)&&n>=0);}
 for(const l of Object.values(s.diplomacy??{})){assert.ok(l.a!==l.b&&s.countries[l.a]&&s.countries[l.b]);assert.ok(l.relation>=-100&&l.relation<=100);assert.equal(new Set(l.treaties).size,l.treaties.length);}
 assert.ok(s.battleLog.length<=20&&(s.warHistory?.length??0)<=20&&(s.movements?.length??0)<=20);
}
