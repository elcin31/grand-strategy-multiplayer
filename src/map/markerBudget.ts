import type {ArmyCluster} from './armyClusters';
import type {GraphicsPreset} from './settings';
import {TILT} from './camera';
export interface DisplayArmy extends ArmyCluster {ownerIds:string[];stack:boolean}
export function markerBudgets(zoom:number,preset:GraphicsPreset){
  const factor=preset==='Performance'?.65:preset==='High'?1.3:preset==='Ultra'?1.6:1;
  return {armies:Math.max(8,Math.round((zoom<2?24:zoom<6?36:48)*factor)),labels:Math.round((zoom<2?8:zoom<6?14:22)*factor)};
}
/** Render-only stacks preserve every ID and troop, including mixed-owner cells.
 * A neutral stacked glyph explicitly distinguishes them from one country's army.
 * Selected army always remains its own selectable counter. */
export function budgetArmyMarkers(input:readonly ArmyCluster[],zoom:number,budget:number,selectedId?:string|null,ownCountryId?:string|null):DisplayArmy[]{
  const selected=input.filter(c=>c.ids.includes(selectedId??''));
  const rest=input.filter(c=>!c.ids.includes(selectedId??''));
  if(input.length<=budget)return input.map(c=>({...c,ids:[...c.ids],ownerIds:[c.ownerId],stack:false}));
  let cell=zoom<2?96:zoom<6?72:48,groups:DisplayArmy[]=[];
  for(let attempt=0;attempt<16;attempt++,cell*=1.5){
    const cells=new Map<string,DisplayArmy>();
    for(const counter of rest){
      const key=Math.floor(counter.x*zoom/cell)+':'+Math.floor(counter.y*zoom*TILT/cell);
      const old=cells.get(key);
      if(old){const total=old.troops+counter.troops,w=total?counter.troops/total:.5;old.x+=(counter.x-old.x)*w;old.y+=(counter.y-old.y)*w;old.troops=total;old.ids.push(...counter.ids);if(!old.ownerIds.includes(counter.ownerId))old.ownerIds.push(counter.ownerId);old.stack=true;}
      else cells.set(key,{...counter,key:'stack:'+cell+':'+key,ids:[...counter.ids],ownerIds:[counter.ownerId],stack:counter.ids.length>1});
    }
    groups=[...cells.values()];if(groups.length+selected.length<=budget)break;
  }
  groups.sort((a,b)=>Number(b.ownerIds.includes(ownCountryId??''))-Number(a.ownerIds.includes(ownCountryId??''))||b.troops-a.troops);
  return [...selected.map(c=>({...c,ids:[...c.ids],ownerIds:[c.ownerId],stack:false})),...groups];
}
