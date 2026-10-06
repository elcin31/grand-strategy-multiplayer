import {TILT} from './camera';
import type {MapFeature} from './geometry';
import type {armyCounters} from './overlays';
type Counter=ReturnType<typeof armyCounters>[number];
export interface ArmyCluster extends Counter {key:string;x:number;y:number}
/** Screen-space cells; never combine different owners or hide the selected army. */
export function clusterArmies(counters:readonly Counter[],geometry:ReadonlyMap<string,MapFeature>,zoom:number,selectedId?:string|null):ArmyCluster[]{
 const groups=new Map<string,ArmyCluster>();
 for(const counter of counters){const point=geometry.get(counter.provinceId)?.anchor;if(!point)continue;
  const selected=counter.ids.includes(selectedId??'');
  const cell=zoom<1.5?72:zoom<3?52:0;
  const key=selected||!cell?counter.provinceId+'|'+counter.ownerId:counter.ownerId+'|'+Math.floor(point.x*zoom/cell)+','+Math.floor(point.y*zoom*TILT/cell);
  const old=groups.get(key);
  if(old){const total=old.troops+counter.troops,weight=total>0?counter.troops/total:.5;old.x+=(point.x-old.x)*weight;old.y+=(point.y-old.y)*weight;old.troops=total;old.ids.push(...counter.ids);}
  else groups.set(key,{...counter,ids:[...counter.ids],key,x:point.x,y:point.y});
 }
 return [...groups.values()];
}
