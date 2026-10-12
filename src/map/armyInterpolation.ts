import type {GameState} from '../types/game';
import type {DisplayArmy} from './markerBudget';
import type {MapFeature,Point} from './geometry';
import {armyTravelDays} from '../../supabase/functions/_shared/military3System';
const indexes=new WeakMap<object,Map<string,{id:string}>>();
function index<T extends {id:string}>(rows:T[]):Map<string,T>{let map=indexes.get(rows);if(!map||map.size!==rows.length){map=new Map(rows.map(p=>[p.id,p]));indexes.set(rows,map);}return map as Map<string,T>;}
/** Only confirmed calendar progress; visual coordinates never mutate orders. */
export function armyDisplayPoint(state:GameState,counter:DisplayArmy,geometry:ReadonlyMap<string,MapFeature>):Point{
 let x=0,y=0,total=0;const armies=index(state.armies),provinces=index(state.provinces);
 for(const id of counter.ids){const a=armies.get(id);if(!a)continue;const from=geometry.get(a.provinceId)?.anchor,to=geometry.get(a.order?.route[0]??'')?.anchor,p=provinces.get(a.order?.route[0]??'');if(!from)continue;
  const progress=to&&p?Math.max(0,Math.min(1,(a.order?.travelProgress??0)/armyTravelDays(state,a,p))):0;
  x+=(from.x+((to?.x??from.x)-from.x)*progress)*a.troops;y+=(from.y+((to?.y??from.y)-from.y)*progress)*a.troops;total+=a.troops;
 }
 return total?{x:x/total,y:y/total}:{x:counter.x,y:counter.y};
}
