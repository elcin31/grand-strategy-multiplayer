import type {Army,GameState,Province} from './gameTypes.ts';
import {warBetween} from './diplomacySystem.ts';
import {canEnterTerritory} from './diplomacy2System.ts';
export interface ArmyOrder { type:'MOVE'|'ATTACK'; targetProvinceId:string; route:string[]; issuedTick:number }
/** Uniform-cost graph: BFS is optimal in monthly steps. Once per order, never per frame. */
export function findArmyRoute(state:GameState,army:Army,targetId:string):string[] {
 const provinces=new Map(state.provinces.map(p=>[p.id,p]));
 const target=provinces.get(targetId);if(!target)throw Error('Провинция не найдена');
 const passable=(p:Province)=>canEnterTerritory(state,army.ownerId,p.controllerId??p.ownerId);
 if(!passable(target))throw Error('Нет права прохода: сначала объявите войну через дипломатию');
 if(targetId===army.provinceId)return [];
 const queue=[army.provinceId],previous=new Map<string,string|null>([[army.provinceId,null]]);
 for(let i=0;i<queue.length;i++){
  const current=queue[i]!;
  for(const id of provinces.get(current)?.neighbors??[]){
   const p=provinces.get(id);if(!p||previous.has(id)||!passable(p))continue;
   previous.set(id,current);
   if(id===targetId){const route=[id];let node=current;while(node!==army.provinceId){route.push(node);node=previous.get(node)!;}return route.reverse();}
   queue.push(id);
  }
 }
 throw Error('Нет допустимого маршрута к выбранной провинции');
}
export function setArmyOrder(state:GameState,ownerId:string,armyId:string,targetId:string):void {
 const army=state.armies.find(a=>a.id===armyId);if(!army||army.ownerId!==ownerId)throw Error('Можно отдавать приказы только своей армии');
 const route=findArmyRoute(state,army,targetId),target=state.provinces.find(p=>p.id===targetId)!;
 army.order=route.length?{type:warBetween(state,ownerId,target.controllerId??target.ownerId)||!state.dataset&&(target.controllerId??target.ownerId)!==ownerId?'ATTACK':'MOVE',targetProvinceId:targetId,route,issuedTick:state.tick}:undefined;
}
export function advanceArmyOrders(state:GameState,move:(state:GameState,owner:string,army:string,target:string)=>void):void {
 const provinces=new Map(state.provinces.map(p=>[p.id,p]));
 for(const army of [...state.armies]){
  const order=army.order;if(!order||!state.armies.includes(army))continue;
  const next=provinces.get(order.route[0]??''),origin=provinces.get(army.provinceId);
  // Recheck every step against authoritative control and diplomacy. Never follow stale permissions.
  if(!next||!origin?.neighbors.includes(next.id)||!canEnterTerritory(state,army.ownerId,next.controllerId??next.ownerId,army.id,next.id)){delete army.order;continue;}
  move(state,army.ownerId,army.id,next.id);
  if(army.provinceId!==next.id){delete army.order;continue;} // failed assault stops the order
  order.route.shift();if(!order.route.length)delete army.order;
 }
}
export function validateArmyOrders(state:GameState):void {
 const provinces=new Map(state.provinces.map(p=>[p.id,p]));
 for(const army of state.armies){const o=army.order;if(!o)continue;
  if(!['MOVE','ATTACK'].includes(o.type)||!Number.isSafeInteger(o.issuedTick)||o.issuedTick<0||o.issuedTick>state.tick||!Array.isArray(o.route)||!o.route.length||o.route.length>state.provinces.length||o.route.at(-1)!==o.targetProvinceId||new Set(o.route).size!==o.route.length)throw Error('Invalid army order');
  let previous=army.provinceId;for(const id of o.route){if(!provinces.get(previous)?.neighbors.includes(id)||!provinces.has(id))throw Error('Invalid army route');previous=id;}
 }
}
