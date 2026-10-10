import type {Army,GameState,Province} from './gameTypes.ts';
import {canEnterTerritory} from './diplomacy2System.ts';
import {warBetween} from './diplomacySystem.ts';
import {espionageModifiers} from './espionageSystem.ts';
import {militaryReadiness} from './economy2System.ts';
import {weightedTroops} from './armyComposition.ts';
import {WATER_ACCESS} from './waterAccess.ts';
interface SupplyNode {score:number;sourceId:string;previousId?:string;sea:boolean}
interface SupplyIndex {permissions:Map<string,Map<string,boolean>>;provinces:Map<string,Province>;owned:Map<string,Province[]>;capitals:Map<string,string>;loads:Map<string,number>;armies:Map<string,Army[]>;networks:Map<string,Map<string,SupplyNode>>}
const indices=new WeakMap<GameState,SupplyIndex>();
export function invalidateSupply(s:GameState):void {indices.delete(s);}
export function updateSupplyLoad(s:GameState,a:Army,previous:number):void {const i=indices.get(s);if(i){const key=a.ownerId+':'+a.provinceId;i.loads.set(key,Math.max(0,(i.loads.get(key)??0)+weightedTroops(a)-previous));i.networks.clear();}}
/** Army-only mutations retain immutable geography/capital/access indexes. */
export function refreshSupplyLoads(s:GameState):void {const i=indexFor(s);i.loads.clear();i.armies.clear();i.networks.clear();for(const a of s.armies){const key=a.ownerId+':'+a.provinceId;i.loads.set(key,(i.loads.get(key)??0)+weightedTroops(a));const rows=i.armies.get(a.provinceId)??[];rows.push(a);i.armies.set(a.provinceId,rows);}}
function indexFor(s:GameState):SupplyIndex {
  let i=indices.get(s);if(i)return i;
  i={permissions:new Map(),provinces:new Map(s.provinces.map(p=>[p.id,p])),owned:new Map(),capitals:new Map((s.cities??[]).filter(c=>c.isCapital).map(c=>[c.countryId,c.provinceId])),loads:new Map(),armies:new Map(),networks:new Map()};
  for(const p of s.provinces){const own=i.owned.get(p.ownerId)??[];own.push(p);i.owned.set(p.ownerId,own);}
  for(const a of s.armies){const k=a.ownerId+':'+a.provinceId;i.loads.set(k,(i.loads.get(k)??0)+weightedTroops(a));const rows=i.armies.get(a.provinceId)??[];rows.push(a);i.armies.set(a.provinceId,rows);}
  indices.set(s,i);return i;
}
function allowed(s:GameState,owner:string,controller:string,i:SupplyIndex):boolean {if(owner===controller)return true;let row=i.permissions.get(owner);if(!row){row=new Map();i.permissions.set(owner,row);}let value=row.get(controller);if(value===undefined){value=!warBetween(s,owner,controller)&&canEnterTerritory(s,owner,controller);row.set(controller,value);}return value;}
function passable(s:GameState,owner:string,p:Province,i:SupplyIndex):boolean {return !p.rebellion&&allowed(s,owner,p.controllerId??p.ownerId,i);}
function portBlocked(s:GameState,owner:string,p:Province,i:SupplyIndex):boolean {
  return p.neighbors.some(id=>{const q=i.provinces.get(id);return q&&warBetween(s,owner,q.controllerId??q.ownerId)&&(i.armies.get(id)??[]).some(a=>a.ownerId===(q.controllerId??q.ownerId)&&a.troops>=10000);});
}
function networkFor(s:GameState,owner:string,i:SupplyIndex):Map<string,SupplyNode> {
  const existing=i.networks.get(owner);if(existing){i.networks.delete(owner);i.networks.set(owner,existing);return existing;}
  const nodes=new Map<string,SupplyNode>(),buckets:Array<string[]>=Array.from({length:101},()=>[]),home=i.provinces.get(i.capitals.get(owner)??'');
  const seed=(id:string,score:number,sourceId:string,sea=false,previousId?:string)=>{if(score<1||score<=(nodes.get(id)?.score??0))return;nodes.set(id,{score,sourceId,sea,...previousId?{previousId}:{}});buckets[score]!.push(id);};
  if(home&&(home.controllerId??home.ownerId)===owner&&!home.rebellion)seed(home.id,100,home.id);
  else for(const p of i.owned.get(owner)??[])if((p.controllerId??p.ownerId)===owner&&!p.rebellion&&(p.buildings?.Infrastructure??0)>=2&&(p.buildings?.Barracks??0)>=1)seed(p.id,55,p.id);
  const propagate=()=>{for(let score=100;score>0;score--){const pending=buckets[score]!;buckets[score]=[];for(let at=0;at<pending.length;at++){const id=pending[at]!,current=nodes.get(id)!;if(current.score!==score)continue;const p=i.provinces.get(id)!;for(const next of p.neighbors){const q=i.provinces.get(next);if(!q||!passable(s,owner,q,i))continue;
      const base=q.terrain==='mountain'||q.terrain==='desert'?3:q.terrain==='forest'?2:1;
      const cost=Math.max(1,Math.round(base-Math.min(2,(q.buildings?.Infrastructure??0)*.4)))+(q.ownerId!==owner?((q.controllerId??q.ownerId)===owner?3:2):0);
      seed(next,score-cost,current.sourceId,current.sea,id);
    }}};};propagate();
  // A real connected port is required at both ends. Hostile coastal garrisons
  // can interdict its approaches; this abstracts coastal logistics, not fleets.
  const ports=(i.owned.get(owner)??[]).filter(p=>(p.controllerId??p.ownerId)===owner&&!p.rebellion&&(p.buildings?.Port??0)>0&&WATER_ACCESS.has(p.id)&&!portBlocked(s,owner,p,i));
  const origin=ports.filter(p=>nodes.has(p.id)).sort((a,b)=>nodes.get(b.id)!.score-nodes.get(a.id)!.score)[0];
  if(origin){const quality=Math.min(75,nodes.get(origin.id)!.score-10);for(const p of ports)if(!nodes.has(p.id))seed(p.id,quality,origin.id,true,origin.id);propagate();}
  i.networks.set(owner,nodes);if(i.networks.size>32)i.networks.delete(i.networks.keys().next().value!);return nodes;
}
export interface SupplyQuote {score:number;capacity:number;load:number;sourceId?:string;sea:boolean;reason:string|null}
export function supplyAt(s:GameState,owner:string,provinceId:string):SupplyQuote {
  if(!s.dataset)return {score:100,capacity:Number.MAX_SAFE_INTEGER,load:0,sea:false,reason:null};
  const i=indexFor(s),p=i.provinces.get(provinceId);if(!p)return {score:0,capacity:0,load:0,sea:false,reason:'Провинция не найдена'};
  const c=s.countries[owner]!,capital=i.capitals.get(owner)===p.id;
  // Most standing armies start at their national source. The source's score
  // is known without traversing its entire country. Distal/occupied armies
  // still use the complete controlled-route graph and port interdiction.
  const node=capital&&(p.controllerId??p.ownerId)===owner&&!p.rebellion?{score:100,sourceId:p.id,sea:false}:networkFor(s,owner,i).get(p.id);
  const capacity=Math.floor(8000+(p.development??40)*200+(p.buildings?.Infrastructure??0)*10000+(p.buildings?.Barracks??0)*6000+(p.buildings?.Port??0)*12000+(capital?150000:0));
  const load=i.loads.get(owner+':'+p.id)??0,overload=load>capacity?capacity/load:1;
  const score=Math.max(0,Math.min(100,Math.round((node?.score??0)*overload*militaryReadiness(c)*(s.tick<(c.bankruptcyUntilTick??0)?.65:1)-espionageModifiers(s,owner).supplyPenalty)));
  return {score,capacity,load,sourceId:node?.sourceId,sea:node?.sea??false,reason:!node?'Нет пути от контролируемой столицы или резервного узла':overload<1?'Превышена пропускная способность':score<50?'Недостаточное снабжение':null};
}
/** Reconstruct only on demand (UI request/tests), never a rendered map frame. */
export function supplyRoute(s:GameState,owner:string,provinceId:string):string[] {
  const i=indexFor(s),nodes=networkFor(s,owner,i),route:string[]=[],seen=new Set<string>();let id:string|undefined=provinceId;
  while(id&&nodes.has(id)&&!seen.has(id)){seen.add(id);route.unshift(id);id=nodes.get(id)!.previousId;}
  return route;
}
