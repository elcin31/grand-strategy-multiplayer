import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorldState } from '../supabase/functions/_shared/worldState';
import { applyServerCommand } from '../supabase/functions/_shared/serverCommand';
import { normalizeGameState } from '../supabase/functions/_shared/stateMigrations';
import { initializeTechnology, monthlyResearch, researchQuote, TECHNOLOGY_BRANCHES } from '../supabase/functions/_shared/technologySystem';
import { recalcEconomy } from '../supabase/functions/_shared/economySystem';
import { provinceProduction } from '../supabase/functions/_shared/resourceSystem';

function campaign(){const s=createWorldState('research','TECH01','host','QA',77);s.phase='paused';s.speed=0;s.players[0]!.countryId='germany';return s;}
test('research is paid, authenticated, immutable, time-based and survives save roundtrip',()=>{
  const s=campaign(), copy=structuredClone(s), command={type:'START_RESEARCH',playerId:'host',branch:'Economy'} as const;
  let n=applyServerCommand(s,command,'host');assert.deepEqual(s,copy);assert.equal(n.countries.germany!.treasury,s.countries.germany!.treasury-researchQuote(s.countries.germany!,'Economy').cost);
  assert.throws(()=>applyServerCommand(n,command,'host'));
  assert.throws(()=>applyServerCommand(s,{...command,cost:0} as never,'host'));
  assert.throws(()=>applyServerCommand(s,{...command,playerId:'other'},'host'));
  assert.throws(()=>applyServerCommand(s,{...command,branch:'__proto__'} as never,'host'));
  assert.deepEqual(applyServerCommand(n,{type:'ADVANCE_TICK'},'host'),n);
  n=JSON.parse(JSON.stringify(n));normalizeGameState(n);
  n=applyServerCommand(n,{type:'SET_SPEED',playerId:'host',speed:1},'host');
  for(let i=0;i<5;i++) n=applyServerCommand(n,{type:'ADVANCE_TICK'},'host');
  assert.equal(n.countries.germany!.technologies!.Economy,0);
  for(let i=0;i<2;i++) n=applyServerCommand(n,{type:'ADVANCE_TICK'},'host');
  assert.equal(n.countries.germany!.technologies!.Economy,1);assert.equal(n.countries.germany!.research,undefined);
});
test('five completed research branches persist and economy/industry have observable effects',()=>{
  const s=campaign(), c=s.countries.germany!, p=s.provinces.find(p=>p.ownerId===c.id)!;
  const before=c.economy!.taxIncome, production=provinceProduction(p,c).units;
  for(const branch of TECHNOLOGY_BRANCHES)c.technologies![branch]=1;
  recalcEconomy(s);assert.ok(c.economy!.taxIncome>before);assert.ok(provinceProduction(p,c).units>production);
  const old=campaign();old.stateVersion=2;for(const c of Object.values(old.countries))delete c.technologies;
  normalizeGameState(old);assert.equal(old.countries.germany!.technologies!.Economy,0);
  old.countries.germany!.technologies!.Economy=NaN;assert.throws(()=>initializeTechnology(old));
});
test('universities accelerate research, bankruptcy suspends progress and max level rejects purchase',()=>{
  let s=applyServerCommand(campaign(),{type:'START_RESEARCH',playerId:'host',branch:'Military'},'host');
  const c=s.countries.germany!;s.provinces.find(p=>p.ownerId===c.id)!.buildings={University:5};monthlyResearch(s);assert.ok(c.research!.progress>1);
  const progress=c.research!.progress;c.bankruptcyUntilTick=s.tick+2;monthlyResearch(s);assert.equal(c.research!.progress,progress);
  delete c.research;c.bankruptcyUntilTick=0;c.technologies!.Military=5;
  assert.throws(()=>applyServerCommand(s,{type:'START_RESEARCH',playerId:'host',branch:'Military'},'host'));
});
