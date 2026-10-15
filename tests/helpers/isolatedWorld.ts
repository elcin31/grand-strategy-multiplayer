import {createWorldState as createScenarioWorld} from '../../supabase/functions/_shared/worldState';
import {recalcEconomy} from '../../supabase/functions/_shared/economySystem';

/** Isolate paid progression from the modern scenario's inherited discoveries
 * and national spirits. The production start date, map and defaults are intact. */
export function createWorldState(...args:Parameters<typeof createScenarioWorld>){
 const state=createScenarioWorld(...args);
 for(const c of Object.values(state.countries)){
  c.technologies={Economy:0,Military:0,Industry:0,Administration:0,Diplomacy:0};
  c.scientificDiscoveries=[];c.nationalSpirits=[];
 }
 recalcEconomy(state);return state;
}
