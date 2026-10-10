import type {Army,GameState,Province} from './gameTypes.ts';
import {UNITS,UNIT_TYPES,type UnitType} from './unitCatalogue.ts';
import {armyParts,compositionTotal,addArmyRegiment,takeArmyLosses,weightedTroops} from './armyComposition.ts';
import {refreshSupplyLoads,supplyAt,updateSupplyLoad} from './supplySystem.ts';
import {money} from './economySystem.ts';
import {warBetween} from './diplomacySystem.ts';
import {canEnterTerritory} from './diplomacy2System.ts';
import {recordMovement} from './movementHistory.ts';
export interface ReinforcementQuote {troops:number;cost:number;parts:Partial<Record<UnitType,number>>;reason:string|null}
export function reinforcementQuote(s:GameState,a:Army):ReinforcementQuote {
  const c=s.countries[a.ownerId]!;
  const empty=(reason:string):ReinforcementQuote=>({troops:0,cost:0,parts:{},reason});
  if(!s.dataset||!['running','paused'].includes(s.phase))return empty('Нужна начатая кампания');
  const template=a.template??armyParts(a),target=compositionTotal(template),missing=target-a.troops;
  if(missing<=0)return empty('Штат укомплектован');
  const p=s.provinces.find(p=>p.id===a.provinceId),supply=supplyAt(s,a.ownerId,a.provinceId).score;
  if(!p||p.ownerId!==a.ownerId||(p.controllerId??p.ownerId)!==a.ownerId||p.rebellion)return empty('Нужна контролируемая своя территория');
  if(s.tick<(c.bankruptcyUntilTick??0))return empty('После банкротства пополнение заблокировано');
  if(a.lastReinforcementTick===s.tick)return empty('Пополнение уже было в этом месяце');
  if(s.tick<(a.retreatUntilTick??0))return empty('Армия восстанавливается после отступления');
  if(supply<50)return empty('Нужно снабжение не менее 50%');
  const funding=c.militaryFunding==='Low'?.04:c.militaryFunding==='High'?.12:.08;
  let limit=Math.min(missing,c.manpower,Math.floor((target*funding+(p.buildings?.Barracks??0)*500)*supply/100)),cash=c.treasury;
  const parts:Partial<Record<UnitType,number>>={};let troops=0,cost=0;
  for(const t of UNIT_TYPES){const needed=(template[t]??0)-(armyParts(a)[t]??0),price=UNITS[t].cost*.65/1000,count=Math.min(Math.max(0,needed),limit,Math.floor((cash+1e-9)/price));if(count<1)continue;
    const paid=money(count*price);if(paid>cash)continue;parts[t]=count;troops+=count;cost=money(cost+paid);cash=money(cash-paid);limit-=count;
  }
  return troops?{troops,cost,parts,reason:null}:empty('Недостаточно средств или резерва');
}
export function reinforceArmy(s:GameState,owner:string,id:string):void {
  const a=s.armies.find(a=>a.id===id&&a.ownerId===owner);if(!a)throw Error('Армия не найдена');const q=reinforcementQuote(s,a);if(q.reason)throw Error(q.reason);
  const c=s.countries[owner]!;c.treasury=money(c.treasury-q.cost);c.manpower-=q.troops;
  const previous=weightedTroops(a);
  for(const t of UNIT_TYPES)if(q.parts[t])addArmyRegiment(a,t,q.parts[t]!,false);
  a.lastReinforcementTick=s.tick;a.lastReinforcementCost=q.cost;a.organization=Math.max(0,(a.organization??80)-5);updateSupplyLoad(s,a,previous);
}
export function monthlyMilitaryLogistics(s:GameState):void {
  if(!s.dataset)return;
  refreshSupplyLoads(s);
  // Compute the simultaneous month's load before applying any losses.
  const qualities=s.armies.map(a=>({a,score:supplyAt(s,a.ownerId,a.provinceId).score}));
  const provinces=new Map(s.provinces.map(p=>[p.id,p]));
  for(const {a,score} of qualities){const p=provinces.get(a.provinceId)!;a.supply=score;a.lastSupplyTick=s.tick;
    const harsh=(p.terrain==='desert'||p.terrain==='mountain')&&score<70?.002:0;
    const rate=Math.max(0,40-score)/4000+harsh;if(rate>0)takeArmyLosses(a,Math.min(a.troops,Math.max(1,Math.floor(a.troops*rate))));
    if(score<40){a.morale=Math.max(0,(a.morale??80)-(40-score)*.1);a.organization=Math.max(0,(a.organization??80)-(40-score)*.15);}
  }
  s.armies=s.armies.filter(a=>a.troops>0);refreshSupplyLoads(s);
  for(const a of s.armies)if(a.reinforcementEnabled&&!reinforcementQuote(s,a).reason)reinforceArmy(s,a.ownerId,a.id);
}
export function retreatDestination(s:GameState,a:Army,excluded?:string):Province|undefined {
  const p=s.provinces.find(p=>p.id===a.provinceId),owner=a.ownerId;if(!p)return;
  const neighbours=new Set(p.neighbors);
  return s.provinces.filter(q=>neighbours.has(q.id)&&q.id!==excluded&&!q.rebellion&&!warBetween(s,a.ownerId,q.controllerId??q.ownerId)&&canEnterTerritory(s,a.ownerId,q.controllerId??q.ownerId)&&!s.armies.some(e=>e.provinceId===q.id&&warBetween(s,a.ownerId,e.ownerId))).sort((a,b)=>Number((b.controllerId??b.ownerId)===owner)-Number((a.controllerId??a.ownerId)===owner)||b.income-a.income||a.id.localeCompare(b.id))[0];
}
export function retreatArmy(s:GameState,owner:string,id:string,targetId:string,forced=false):void {
  const a=s.armies.find(a=>a.id===id&&a.ownerId===owner),p=s.provinces.find(p=>p.id===targetId),origin=a&&s.provinces.find(p=>p.id===a.provinceId);
  if(!a||!p||!origin||!origin.neighbors.includes(targetId)||p.rebellion||warBetween(s,owner,p.controllerId??p.ownerId)||!canEnterTerritory(s,owner,p.controllerId??p.ownerId)||s.armies.some(e=>e.provinceId===targetId&&warBetween(s,owner,e.ownerId)))throw Error('Нет безопасного соседнего пути отступления');
  if(!forced&&s.tick<(a.retreatUntilTick??0))throw Error('Отступление уже выполнено');if(!Number.isSafeInteger(s.tick+2))throw Error('Retreat date overflow');
  recordMovement(s,{armyId:id,ownerId:owner,from:origin.id,to:p.id,tick:s.tick});a.provinceId=p.id;delete a.order;a.retreatUntilTick=s.tick+2;
  a.morale=Math.max(0,(a.morale??80)-5);a.organization=Math.max(0,(a.organization??80)-10);refreshSupplyLoads(s);
}
export function awardBattleExperience(s:GameState,armies:Army[],winner:string):void {
  const seen=new Set<string>(),seenArmies=new Set<string>();for(const a of armies){if(seenArmies.has(a.id))continue;seenArmies.add(a.id);a.experience=Math.min(100,(a.experience??0)+(a.ownerId===winner?3:1));if(a.commanderId&&!seen.has(a.commanderId)){seen.add(a.commanderId);const g=s.commanders?.[a.commanderId];if(g){g.experience=(g.experience??0)+2;if(g.experience>=20){g.skill=Math.min(100,g.skill+1);g.experience-=20;}}}}
}
