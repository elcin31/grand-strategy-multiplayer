import type {Country,GameState,Army,Province} from './gameTypes.ts';
import {aiControls,attackRatio} from './aiSystem.ts';
import {setArmyOrder} from './armyOrders.ts';
import {armyInBattle} from './military3System.ts';
import {retreatArmy,retreatDestination} from './militaryLogistics.ts';
import {warBetween} from './diplomacySystem.ts';
import {canEnterTerritory} from './diplomacy2System.ts';
export const STRATEGIC_PERSONALITIES=['Trade','Military','Defensive','Balancer','Reformer','Regional'] as const;
export interface AIStrategy {personality:typeof STRATEGIC_PERSONALITIES[number];goal:'Economy'|'Science'|'Integration'|'Modernization'|'Defense'|'Influence'|'Recovery';sinceTick:number;reviewTick:number;reason:string;targetCountryId?:string}
export function ensureStrategy(s:GameState,c:Country):AIStrategy{
 if(!c.aiStrategy){let h=0;for(const ch of c.id)h=(Math.imul(h,31)+ch.charCodeAt(0))>>>0;const personality=STRATEGIC_PERSONALITIES[h%STRATEGIC_PERSONALITIES.length]!;c.aiStrategy={personality,goal:personality==='Reformer'?'Science':personality==='Trade'?'Economy':personality==='Military'?'Modernization':personality==='Balancer'?'Integration':personality==='Regional'?'Influence':'Defense',sinceTick:s.tick,reviewTick:s.tick+6,reason:'Долгосрочная стратегия государства'};}return c.aiStrategy;
}
export function reviewStrategy(s:GameState,c:Country):AIStrategy{
 const plan=ensureStrategy(s,c),war=s.wars?.some(w=>[...w.attackers,...w.defenders].includes(c.id));
 const urgent=war&&(plan.goal!=='Defense'&&plan.goal!=='Modernization')||(c.warExhaustion??0)>50&&plan.goal!=='Recovery';
 if(s.tick<plan.reviewTick&&!urgent)return plan;
 const old=plan.goal;
 if((c.warExhaustion??0)>50||c.stability<45){plan.goal='Recovery';plan.reason='Потери и внутреннее недовольство требуют восстановления';}
 else if(war){plan.goal=plan.personality==='Military'?'Modernization':'Defense';plan.reason='Защита столицы, снабжения и ключевых провинций';}
 else if((c.economy?.monthlyBalance??0)<0||c.treasury<(c.economy?.monthlyIncome??0)*3){plan.goal='Economy';plan.reason='Восстановить бюджет и стратегический резерв';}
 else {plan.goal=plan.personality==='Trade'?'Economy':plan.personality==='Reformer'?'Science':plan.personality==='Balancer'?'Integration':plan.personality==='Military'?'Modernization':plan.personality==='Regional'?'Influence':'Defense';plan.reason='План развития на шесть месяцев';}
 if(old!==plan.goal)plan.sinceTick=s.tick;plan.reviewTick=s.tick+6;return plan;
}
/** No frame work. At most 20 scheduled nations and 3 stacks each every third day. */
export function periodicMilitaryAI(s:GameState):void{
 const day=s.simulationDay??0;if(day%3)return;
 const provinces=new Map(s.provinces.map(p=>[p.id,p])),byOwner=new Map<string,Army[]>(),byProvince=new Map<string,Army[]>();
 for(const a of s.armies){const own=byOwner.get(a.ownerId)??[];own.push(a);byOwner.set(a.ownerId,own);const at=byProvince.get(a.provinceId)??[];at.push(a);byProvince.set(a.provinceId,at);}
 const safeOrder=(a:Army,target:string)=>{try{setArmyOrder(s,a.ownerId,a.id,target);}catch{/* A changed frontier or access treaty invalidates the plan. */}};
 // Player groups are opt-in planning assistance. An existing manual route wins.
 for(const g of s.armyGroups??[])for(const id of g.armyIds.slice(0,20)){const a=s.armies.find(a=>a.id===id&&a.ownerId===g.ownerId);if(!a||a.order||armyInBattle(s,a.id)||s.sieges?.some(x=>x.armyIds.includes(a.id)))continue;const target=provinces.get(g.targetProvinceId);if(!target)continue;if(g.objective==='Offensive'&&warBetween(s,a.ownerId,target.controllerId??target.ownerId)&&attackRatio(s,a,target,byProvince)<1.15)continue;if(a.provinceId!==target.id)safeOrder(a,target.id);}
 for(const a of s.armies)if(a.escortArmyId&&!a.order&&!armyInBattle(s,a.id)){const leader=s.armies.find(b=>b.id===a.escortArmyId);if(!leader||!canEnterTerritory(s,a.ownerId,leader.ownerId)||warBetween(s,a.ownerId,leader.ownerId)){delete a.escortArmyId;continue;}if(a.provinceId!==leader.provinceId)safeOrder(a,leader.provinceId);}
 const ids=Object.keys(s.countries).sort(),slot=Math.floor(day/3)%10;
 for(let index=0;index<ids.length;index++){if(index%10!==slot)continue;const id=ids[index]!;if(!aiControls(s,id))continue;const c=s.countries[id]!,plan=reviewStrategy(s,c),capital=s.cities?.find(p=>p.id===c.capitalCityId)?.provinceId;
  const armies=(byOwner.get(id)??[]).sort((a,b)=>b.troops-a.troops).slice(0,3);
  for(const a of armies){const origin=provinces.get(a.provinceId);if(!origin)continue;
   if((a.supply??100)<30||(a.organization??80)<25||(a.morale??80)<25){const exit=retreatDestination(s,a);if(exit&&s.tick>=(a.retreatUntilTick??0)){try{retreatArmy(s,id,a.id,exit.id);}catch{}}continue;}
   if(a.order||armyInBattle(s,a.id)||s.sieges?.some(x=>x.armyIds.includes(a.id)))continue;
   const neighbours=origin.neighbors.map(id=>provinces.get(id)!).filter(Boolean),enemies=neighbours.filter(p=>warBetween(s,id,p.controllerId??p.ownerId));
   if(enemies.length&&a.organization!>=55&&a.morale!>=55){const target=enemies.map(p=>({p,ratio:attackRatio(s,a,p,byProvince)})).filter(x=>x.ratio>=(plan.personality==='Defensive'?1.6:1.25)).sort((a,b)=>b.ratio-a.ratio||b.p.income-a.p.income)[0];if(target&&(origin.id!==capital||armies.some(b=>b.id!==a.id&&b.provinceId===capital))){a.formation='Assault';safeOrder(a,target.p.id);continue;}}
   const support=neighbours.filter(p=>(p.controllerId??p.ownerId)===id&&!p.rebellion).map(p=>({p,score:(p.id===capital?40:0)+(s.activeBattles?.some(b=>b.provinceId===p.id&&b.defenderId===id)?100:0)+p.neighbors.filter(n=>warBetween(s,id,provinces.get(n)?.controllerId??provinces.get(n)?.ownerId??id)).length*25-(byProvince.get(p.id)??[]).filter(a=>a.ownerId===id).reduce((n,a)=>n+a.troops/1000,0)})).sort((a,b)=>b.score-a.score)[0];
   if(support&&support.score>35&&origin.id!==capital){a.formation='Defensive';safeOrder(a,support.p.id);}
  }
 }
}
export function aiConstructionPreference(c:Country,p:Province):string[]{const plan=c.aiStrategy;if(plan?.goal==='Defense')return ['Fort','MilitaryDepot','Infrastructure'];if(plan?.goal==='Science')return ['ResearchCenter','University','Laboratory'];if(plan?.goal==='Recovery')return ['Farm','Hospital','Infrastructure'];if(plan?.personality==='Trade')return ['CargoPort','Port','TransportTerminal'];return p.resourceDeposit?['Mine','Factory','Infrastructure']:['Farm','Factory','University'];}
