import {visibleEdges,edgeLine} from './edgeIndex';
import type {GameState} from '../types/game';
import type {Edge} from './scene';
import type {MapFeature} from './geometry';
import {warBetween} from '../../supabase/functions/_shared/diplomacySystem';
export function warBorderPath(s:GameState,visible:Set<string>,edges:readonly Edge[]):string {
 const controllers=new Map(s.provinces.map(p=>[p.id,p.controllerId??p.ownerId]));let path='';
 for(const edge of visibleEdges(edges,visible)){if(edge.provinces.length!==2||!edge.provinces.some(id=>visible.has(id)))continue;const a=controllers.get(edge.provinces[0]!),b=controllers.get(edge.provinces[1]!);if(a&&b&&a!==b&&warBetween(s,a,b))path+=edgeLine(edge);}return path;
}
export function occupationFeatures(s:GameState,features:readonly MapFeature[]){const provinces=new Map(s.provinces.map(p=>[p.id,p]));return features.filter(f=>{const p=provinces.get(f.provinceId??'');return p&&(p.controllerId??p.ownerId)!==p.ownerId;});}
export function constructionProgress(s:GameState,id:string):number|null{const c=s.constructions?.find(q=>q.provinceId===id);return c?Math.max(0,Math.min(1,(s.tick-c.startedTick)/Math.max(1,c.completeTick-c.startedTick))):null;}
export function armyCounters(s:GameState,visible:Set<string>){const groups=new Map<string,{provinceId:string;ownerId:string;troops:number;ids:string[]}>();for(const a of s.armies){if(!visible.has(a.provinceId))continue;const key=a.provinceId+'|'+a.ownerId,item=groups.get(key)??{provinceId:a.provinceId,ownerId:a.ownerId,troops:0,ids:[]};item.troops+=a.troops;item.ids.push(a.id);groups.set(key,item);}return[...groups.values()];}
