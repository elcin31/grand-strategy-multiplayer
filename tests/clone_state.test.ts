import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cloneGameState} from '../supabase/functions/_shared/cloneGameState';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {applyCommand} from '../src/engine/gameEngine';
function noAliases(a:unknown,b:unknown){if(a===null||typeof a!=='object')return;assert.notEqual(a,b);for(const k of Object.keys(a))noAliases((a as Record<string,unknown>)[k],(b as Record<string,unknown>)[k]);}
test('campaign clone matches native clone with zero mutable aliases through simulation and failed commands',()=>{
 let s=createWorldState('copy','COPY','host','Host');s.players[0]!.countryId='germany';s.players[0]!.ready=true;s.phase='running';
 for(let i=0;i<12;i++){const c=cloneGameState(s);assert.deepEqual(c,structuredClone(s));noAliases(s,c);const original=JSON.stringify(s);const next=applyCommand(s,{type:'ADVANCE_TICK'});assert.equal(JSON.stringify(s),original);s=next;}
 const before=JSON.stringify(s);assert.throws(()=>applyCommand(s,{type:'START_GAME',playerId:'host'}));assert.equal(JSON.stringify(s),before);
});
test('clone treats __proto__ as data without modifying its prototype',()=>{
 const s=createWorldState('copy','COPY','host','Host');Object.defineProperty(s,'__proto__',{value:{danger:true},enumerable:true});const copy=cloneGameState(s);assert.deepEqual(copy,structuredClone(s));assert.equal(Object.getPrototypeOf(copy),Object.prototype);assert.equal(({} as {danger?:boolean}).danger,undefined);
});
