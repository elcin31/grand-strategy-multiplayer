import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {monthlyPopulationGrowth,initializePopulation} from '../supabase/functions/_shared/populationSystem';
import {recalcEconomy} from '../supabase/functions/_shared/economySystem';

// Isolate the same full-world demographic/income feedback for10,000 months.
// No AI, wars, treasury accrual or rendering: this is not the final whole-game
// stability/performance test and cannot establish device FPS or acceptance.
const s=createWorldState('demographic-benchmark','DEM101','host','QA',101);
const total=()=>s.provinces.reduce((n,p)=>n+p.population,0),initial=total(),samples=[];
const started=performance.now();
for(let tick=1;tick<=10000;tick++){
 s.tick=tick;monthlyPopulationGrowth(s);
 if(tick%1000===0){initializePopulation(s);recalcEconomy(s);const population=total();assert.ok(Number.isSafeInteger(population));samples.push({tick,population,populationRatio:population/initial,monthlyBirths:s.provinces.reduce((n,p)=>n+p.monthlyPopulationGrowth!,0),monthlyIncome:s.provinces.reduce((n,p)=>n+p.income,0),elapsedMs:performance.now()-started});}
}
console.log(JSON.stringify({protocol:'fixed-seed101-demography-only-10000-v1',runtime:process.argv[2]??'working-tree',countries:Object.keys(s.countries).length,provinces:s.provinces.length,cities:s.cities!.length,initialPopulation:initial,samples,note:'Original abstract game demographics; no real-world forecast, full-engine or hardware-performance claim'},null,2));
