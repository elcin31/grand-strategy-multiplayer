import type {Country,GameState,Army,Province} from './gameTypes.ts';
import {aiControls,attackRatio} from './aiSystem.ts';
import {setArmyOrder} from './armyOrders.ts';
import {assaultSiege,siegeForecast,splitArmy} from './military3System.ts';
import {retreatArmy,retreatDestination} from './militaryLogistics.ts';
import {warBetween} from './diplomacySystem.ts';
import {weightedTroops} from './armyComposition.ts';
import {supplyAt} from './supplySystem.ts';
import {canEnterTerritory} from './diplomacy2System.ts';
export const STRATEGIC_PERSONALITIES=['Trade','Military','Defensive','Balancer','Reformer','Regional'] as const;
export interface AIWarOperation {warId:string;targetCountryId:string;assignedArmyIds:string[];stagingProvinceIds:string[];priority:number;status:'Preparing'|'Executing'|'Holding'|'Complete';reviewDay:number}
export interface AIStrategy {operation?:AIWarOperation;personality:typeof STRATEGIC_PERSONALITIES[number];goal:'Economy'|'Science'|'Integration'|'Modernization'|'Defense'|'Influence'|'Recovery'|'Expansion'|'Leadership';sinceTick:number;reviewTick:number;reason:string;targetCountryId?:string}
export function ensureStrategy(s:GameState,c:Country):AIStrategy{
 if(!c.aiStrategy){let h=0;for(const ch of c.id)h=(Math.imul(h,31)+ch.charCodeAt(0))>>>0;const personality=STRATEGIC_PERSONALITIES[h%STRATEGIC_PERSONALITIES.length]!;c.aiStrategy={personality,goal:personality==='Reformer'?'Science':personality==='Trade'?'Economy':personality==='Military'?'Modernization':personality==='Balancer'?'Integration':personality==='Regional'?'Influence':'Defense',sinceTick:s.tick,reviewTick:s.tick+6,reason:'Долгосрочная стратегия государства'};}return c.aiStrategy;
}
export function reviewStrategy(s:GameState,c:Country):AIStrategy{
 const plan=ensureStrategy(s,c),war=s.wars?.some(w=>[...w.attackers,...w.defenders].includes(c.id));
 const urgent=war&&(plan.goal!=='Defense'&&plan.goal!=='Modernization')||(c.warExhaustion??0)>50&&plan.goal!=='Recovery';
 if(s.tick<plan.reviewTick&&!urgent)return plan;
 const old=plan.goal;
 if((c.warExhaustion??0)>50||c.stability<45){plan.goal='Recovery';plan.reason='Потери и внутреннее недовольство требуют восстановления';}
 else if(s.tick-(c.lastWarEndedTick??-100)<6){plan.goal='Recovery';plan.reason='Восстановление после войны и подготовка резервов';}
 else if(war){plan.goal=plan.personality==='Military'?'Modernization':'Defense';plan.reason='Защита столицы, снабжения и ключевых провинций';}
 else if((c.economy?.monthlyBalance??0)<0||c.treasury<(c.economy?.monthlyIncome??0)*3){plan.goal='Economy';plan.reason='Восстановить бюджет и стратегический резерв';}
 else {plan.goal=plan.personality==='Trade'?'Economy':plan.personality==='Reformer'?'Science':plan.personality==='Balancer'?'Leadership':plan.personality==='Military'?'Modernization':plan.personality==='Regional'?'Expansion':'Defense';plan.reason='План развития на шесть месяцев';}
 if(!war&&plan.operation)plan.operation.status='Complete';
 if(old!==plan.goal)plan.sinceTick=s.tick;plan.reviewTick=s.tick+6;return plan;
}
export type MilitaryObjective='Capture'|'Defend'|'Border'|'Capital'|'Support'|'Reserve';
export interface MilitaryPlan {
 objective:MilitaryObjective;targetProvinceId:string;autoCommand:boolean;source:'AI'|'Player';
 stagingProvinceId?:string;priority:number;status:'Planning'|'Staging'|'Advancing'|'Holding'|'Recovering'|'Blocked'|'Complete';
 startedDay:number;reviewDay:number;reason:string;reinforcementRequested?:boolean;
}
export const AI_LEVELS={
 Easy:{armies:3,candidates:8,risk:1.3,reserve:.3},Normal:{armies:6,candidates:16,risk:1.12,reserve:.2},
 Hard:{armies:8,candidates:24,risk:1.04,reserve:.15},VeryHard:{armies:10,candidates:32,risk:1.0,reserve:.12},
};
interface MilitaryIndex {provinces:Map<string,Province>;byOwner:Map<string,Army[]>;byProvince:Map<string,Army[]>;capitals:Map<string,string>;busy:Set<string>;incoming:Map<string,number>;permissions:Map<string,boolean>}
function militaryIndex(s:GameState):MilitaryIndex{
 const i:MilitaryIndex={provinces:new Map(s.provinces.map(p=>[p.id,p])),byOwner:new Map(),byProvince:new Map(),capitals:new Map((s.cities??[]).filter(c=>c.isCapital).map(c=>[c.countryId,c.provinceId])),incoming:new Map(),busy:new Set((s.activeBattles??[]).flatMap(b=>[...b.attackerArmyIds,...b.defenderArmyIds])),permissions:new Map()};
 for(const x of s.sieges??[])for(const id of x.armyIds)i.busy.add(id);
 for(const a of s.armies){if(a.order?.route[0]){const key=a.ownerId+':'+a.order.route[0];i.incoming.set(key,(i.incoming.get(key)??0)+weightedTroops(a));}const own=i.byOwner.get(a.ownerId)??[];own.push(a);i.byOwner.set(a.ownerId,own);const at=i.byProvince.get(a.provinceId)??[];at.push(a);i.byProvince.set(a.provinceId,at);}return i;
}
function friendly(s:GameState,i:MilitaryIndex,owner:string,p:Province):boolean{
 const controller=p.controllerId??p.ownerId,key=owner+'>'+controller;let allowed=i.permissions.get(key);
 if(allowed===undefined){allowed=!warBetween(s,owner,controller)&&canEnterTerritory(s,owner,controller);i.permissions.set(key,allowed);}return allowed&&!p.rebellion;
}
function path(previous:Map<string,string|null>,origin:string,target:string):string[]{const route:string[]=[];let id:string|null=target;while(id&&id!==origin){route.unshift(id);id=previous.get(id)??null;}return route;}
function importance(i:MilitaryIndex,p:Province):number{return Math.min(35,p.income/8)+(i.capitals.get(p.ownerId)===p.id?65:0)+(p.buildings?.RailHub??0)*10+(p.buildings?.MilitaryDepot??0)*8+(p.buildings?.Fort??0)*4;}
/** One friendly BFS per idle army, sharing indexes and a strict total node budget.
 * Hostile provinces are endpoints only: never march blindly through a defended enemy. */
function chooseOperation(s:GameState,i:MilitaryIndex,a:Army,budget:{nodes:number},preferred?:MilitaryPlan):{target:Province;staging:string;route:string[];objective:MilitaryObjective;score:number}|undefined{
 const level=AI_LEVELS[s.aiDifficulty??'Normal'],origin=i.provinces.get(a.provinceId)!;
 const previous=new Map<string,string|null>([[origin.id,null]]),distance=new Map([[origin.id,0]]),queue=[origin.id],candidates:ReturnType<typeof chooseOperation>[]=[];
 const capital=i.capitals.get(a.ownerId),limit=preferred?.source==='Player'?32:level.candidates;
 for(let n=0;n<queue.length&&budget.nodes>0;n++){
  const at=queue[n]!,p=i.provinces.get(at)!,depth=distance.get(at)!;budget.nodes--;
  const threatened=(s.activeBattles??[]).find(b=>b.provinceId===p.id&&warBetween(s,a.ownerId,b.attackerId));
  const enemyApproach=p.neighbors.reduce((sum,id)=>sum+(i.byProvince.get(id)??[]).filter(e=>warBetween(s,a.ownerId,e.ownerId)).reduce((n,e)=>n+e.troops,0),0);
  const friendlyTroops=(i.byProvince.get(p.id)??[]).filter(e=>!warBetween(s,a.ownerId,e.ownerId)&&e.id!==a.id).reduce((n,e)=>n+e.troops,0);
  if(friendly(s,i,a.ownerId,p)&&(threatened||enemyApproach>friendlyTroops*1.2)&&(!preferred||preferred.source==='AI'||['Defend','Border','Capital','Support'].includes(preferred.objective))){
   const priority=threatened?160:55,score=priority+(p.id===capital?65:0)+importance(i,p)-depth*7-Math.min(80,friendlyTroops/2000);
   if(score>40)candidates.push({target:p,staging:p.id,route:path(previous,origin.id,p.id),objective:'Defend',score});
  }
  if(preferred?.source==='Player'&&preferred.objective!=='Capture'&&p.id===preferred.targetProvinceId&&friendly(s,i,a.ownerId,p))return {target:p,staging:p.id,route:path(previous,origin.id,p.id),objective:preferred.objective,score:200};
  for(const id of p.neighbors){const q=i.provinces.get(id);if(!q)continue;
   if(warBetween(s,a.ownerId,q.controllerId??q.ownerId)){
    if(preferred?.source==='Player'&&preferred.objective!=='Capture'&&preferred.objective!=='Support')continue;
    if(preferred?.source==='Player'&&preferred.objective==='Capture'&&q.id!==preferred.targetProvinceId)continue;
    const ratio=attackRatio(s,a,q,i.byProvince),support=(s.activeBattles??[]).find(b=>b.provinceId===q.id&&!warBetween(s,a.ownerId,b.attackerId));
    const joining=support?support.attackerArmyIds.map(id=>s.armies.find(a=>a.id===id)).filter((a):a is Army=>!!a):[];
    const assembling=depth===0?(i.byProvince.get(p.id)??[]).filter(other=>other.id!==a.id&&!other.order&&!i.busy.has(other.id)&&other.troops>0&&(aiControls(s,other.ownerId)||other.militaryPlan?.autoCommand)&&!warBetween(s,a.ownerId,other.ownerId)&&warBetween(s,other.ownerId,q.controllerId??q.ownerId)&&(other.supply??100)>=30&&(other.organization??80)>=40&&(other.morale??80)>=40):[];
    const supportedRatio=ratio+[...joining,...assembling].reduce((n,other)=>n+attackRatio(s,other,q,i.byProvince),0);
    const value=importance(i,q),threshold=Math.max(.92,level.risk-(value>=60?.12:0));
    // At the front require actual committed support. At a distant staging point
    // assemble and reconsider before crossing the border.
    if(supportedRatio<threshold&&depth===0)continue;
    const score=65+value+Math.min(40,supportedRatio*10)-depth*6-(supportedRatio<level.risk?30:0)+(preferred?.targetProvinceId===q.id?30:0);
    candidates.push({target:q,staging:p.id,route:path(previous,origin.id,p.id),objective:'Capture',score});
   }else if(!previous.has(id)&&friendly(s,i,a.ownerId,q)){
    previous.set(id,at);distance.set(id,depth+1);queue.push(id);
   }
  }
  if(candidates.length>=limit&&depth>=2)break;
 }
 return candidates.filter((c):c is NonNullable<typeof c>=>!!c).sort((a,b)=>b.score-a.score||a.target.id.localeCompare(b.target.id))[0];
}
function detachSupplyCorps(s:GameState,a:Army,capacity:number):void{
 // A large national field army can detach real existing regiments. Two splits
 // per decision are enough for initial 120K stacks; no free manpower/equipment.
 if(!aiControls(s,a.ownerId)||a.formationId||a.order||s.sieges?.some(x=>x.armyIds.includes(a.id)))return;
 for(let n=0;n<2&&a.troops>24000&&weightedTroops(a)>Math.max(18000,capacity*1.3)&&s.armies.filter(x=>x.ownerId===a.ownerId).length<16;n++)try{splitArmy(s,a.ownerId,a.id,50);}catch{break;}
}
function orderOperation(s:GameState,i:MilitaryIndex,a:Army,_target:Province,route:string[],plan:MilitaryPlan):void{
 if(!route.length){plan.status='Holding';return;}
 const first=i.provinces.get(route[0]!)!,key=a.ownerId+':'+first.id;
 if(friendly(s,i,a.ownerId,first)){
  const q=supplyAt(s,a.ownerId,first.id);detachSupplyCorps(s,a,q.capacity);
  const existing=supplyAt(s,a.ownerId,first.id),load=existing.load+(i.incoming.get(key)??0)+weightedTroops(a),base=Math.min(100,existing.score*Math.max(1,existing.load/Math.max(1,existing.capacity))),projected=base*Math.min(1,existing.capacity/Math.max(1,load));
  if(projected<35){plan.status='Staging';plan.reason='Корпус ждёт свободную пропускную способность маршрута';plan.reviewDay=(s.simulationDay??0)+1;return;}
 }
 const last=i.provinces.get(route.at(-1)!)!,attacking=warBetween(s,a.ownerId,last.controllerId??last.ownerId);
 const redeploy=!attacking&&(i.provinces.get(a.provinceId)?.buildings?.Infrastructure??0)>=1&&route.every(id=>(i.provinces.get(id)?.buildings?.Infrastructure??0)>=1)&&(a.supply??100)>=50;
 // Use the already computed legal route. setArmyOrder keeps ownership, battle,
 // retreat and siege checks; only the route search is avoided here.
 try{setArmyOrder(s,a.ownerId,a.id,route[0]!,redeploy);if(a.order){a.order.route=[...route];a.order.targetProvinceId=last.id;a.order.type=attacking?'ATTACK':'MOVE';i.incoming.set(key,(i.incoming.get(key)??0)+weightedTroops(a));}plan.status=attacking?'Advancing':'Staging';plan.stagingProvinceId=attacking?a.provinceId:last.id;plan.reason=attacking?'Допустимая атака с учётом обороны и снабжения':'Переброска к фронту по доступной территории';}
 catch(error){plan.status='Blocked';plan.reason=error instanceof Error?error.message:'Маршрут изменился';plan.reviewDay=(s.simulationDay??0)+2;}
}
function executeArmy(s:GameState,i:MilitaryIndex,a:Army,budget:{nodes:number},playerPlan=false):void{
 const day=s.simulationDay??0,origin=i.provinces.get(a.provinceId);if(!origin||a.formationId)return;
 let plan=a.militaryPlan;
 // A human takeover preserves the march but ends autonomous national control.
 if(!aiControls(s,a.ownerId)&&plan?.source==='AI'){delete a.militaryPlan;return;}
 if(playerPlan&&!plan?.autoCommand)return;
 if(a.order&&!i.busy.has(a.id)){
  const capital=i.capitals.get(a.ownerId),emergency=plan?.source==='AI'&&plan.objective==='Capture'&&capital&&s.activeBattles?.some(b=>b.provinceId===capital&&warBetween(s,a.ownerId,b.attackerId));
  if(!emergency)return;delete a.order;plan!.objective='Capital';plan!.targetProvinceId=capital!;plan!.reason='Столица атакована: срочная переброска';
 }
 if((a.supply??100)<35&&friendly(s,i,a.ownerId,origin)&&!i.busy.has(a.id))detachSupplyCorps(s,a,supplyAt(s,a.ownerId,origin.id).capacity);
 const low=(a.supply??100)<15&&!friendly(s,i,a.ownerId,origin)||(a.organization??80)<30||(a.morale??80)<30;
 if(low){
  if(plan){plan.status='Recovering';plan.reason='Восстановление организации и снабжения';plan.reinforcementRequested=true;}
  // Never bounce a recovering army between two friendly provinces each week.
  if(i.busy.has(a.id)||!friendly(s,i,a.ownerId,origin)||s.activeBattles?.some(b=>b.provinceId===origin.id&&b.attackerId!==a.ownerId)){
   const exit=retreatDestination(s,a);if(exit&&s.tick>=(a.retreatUntilTick??0)){try{retreatArmy(s,a.ownerId,a.id,exit.id);}catch{}}return;
  }
  if((a.supply??100)<30&&!plan?.reviewDay){const exit=origin.neighbors.map(id=>i.provinces.get(id)).filter((p):p is Province=>!!p&&friendly(s,i,a.ownerId,p)).sort((x,y)=>supplyAt(s,a.ownerId,y.id).score-supplyAt(s,a.ownerId,x.id).score)[0];if(exit&&supplyAt(s,a.ownerId,exit.id).score>40){setArmyOrder(s,a.ownerId,a.id,exit.id);}}return;
 }
 if(i.busy.has(a.id)||s.tick<(a.retreatUntilTick??0))return;
 if(plan?.source==='AI'&&!warBetween(s,a.ownerId,i.provinces.get(plan.targetProvinceId)?.ownerId??a.ownerId)&&plan.objective==='Capture'){plan.status='Complete';}
 if(plan?.source==='Player'&&plan.objective==='Capture'&&(i.provinces.get(plan.targetProvinceId)?.controllerId??i.provinces.get(plan.targetProvinceId)?.ownerId)===a.ownerId){plan.status='Complete';plan.reason='Цель военного плана достигнута';plan.autoCommand=false;return;}
 if(plan?.status==='Blocked'&&day<plan.reviewDay)return;
 const war=s.wars?.find(w=>[...w.attackers,...w.defenders].includes(a.ownerId)),secondary=war&&war.attackers[0]!==a.ownerId&&war.defenders[0]!==a.ownerId,ownArmies=i.byOwner.get(a.ownerId)??[];
 if(secondary&&ownArmies.length>1){const deployed=ownArmies.filter(other=>other.id!==a.id&&(i.provinces.get(other.provinceId)?.ownerId!==a.ownerId||other.order&&i.provinces.get(other.order.targetProvinceId)?.ownerId!==a.ownerId)).length;const threatened=(s.activeBattles??[]).some(b=>i.provinces.get(b.provinceId)?.ownerId===a.ownerId);if(!threatened&&deployed>=Math.max(1,Math.floor(ownArmies.length*.6))){if(plan){plan.status='Holding';plan.reason='Национальный резерв прикрывает собственную территорию';}return;}}
 const reserveCount=ownArmies.length>=3?Math.max(1,Math.floor(ownArmies.length*AI_LEVELS[s.aiDifficulty??'Normal'].reserve)):0;
 if(!a.aiRole){const needed=Math.max(0,reserveCount-ownArmies.filter(a=>a.aiRole==='Reserve').length),candidates=ownArmies.filter(a=>!a.aiRole&&!a.order&&a.militaryPlan?.objective!=='Capture').sort((x,y)=>x.troops-y.troops||x.id.localeCompare(y.id)).slice(0,needed);a.aiRole=candidates.some(x=>x.id===a.id)?'Reserve':'Field';}
 const reserve=a.aiRole==='Reserve'&&!(plan?.objective==='Capture'&&day-plan.startedDay<14);
 const needsReserve=ownArmies.some(other=>other.id!==a.id&&(other.militaryPlan?.reinforcementRequested||other.militaryPlan?.status==='Recovering'))||s.activeBattles?.some(b=>warBetween(s,a.ownerId,b.attackerId)&&i.provinces.get(b.provinceId)?.ownerId===a.ownerId);
 if(reserve&&!needsReserve&&!playerPlan){const capital=i.capitals.get(a.ownerId)??a.provinceId;plan={objective:'Reserve',targetProvinceId:capital,source:'AI',autoCommand:true,priority:30,status:'Holding',startedDay:plan?.startedDay??day,reviewDay:day+7,reason:'Резерв прикрывает столицу и заменяет ослабленные корпуса'};a.militaryPlan=plan;const hold=chooseOperation(s,i,a,budget,{...plan,source:'Player'});if(hold)orderOperation(s,i,a,hold.target,hold.route,plan);return;}
 const choice=chooseOperation(s,i,a,budget,plan);
 if(!choice){if(plan){plan.status='Blocked';plan.reason='Нет безопасной цели или доступного пути; запрошено усиление';plan.reinforcementRequested=true;plan.reviewDay=day+2;}return;}
 // Keep the player objective; AI may review a completed/invalid goal or react
 // to an immediate defence, but committed marches are never rewritten.
 if(!plan||plan.source==='AI'){
  const changed=!plan||plan.targetProvinceId!==choice.target.id;
  plan={objective:choice.objective,targetProvinceId:choice.target.id,source:'AI',autoCommand:true,priority:Math.round(choice.score),status:'Planning',startedDay:changed?day:plan!.startedDay,reviewDay:day+7,reason:'Оперативная цель'};a.militaryPlan=plan;
 }
 if(!choice.route.length&&choice.objective==='Defend')plan.reinforcementRequested=origin.neighbors.some(id=>(i.byProvince.get(id)??[]).some(enemy=>warBetween(s,a.ownerId,enemy.ownerId)&&enemy.troops>a.troops));
 let route=choice.route;
 if(choice.objective==='Capture'&&choice.staging===a.provinceId){
  if((a.organization??80)<40||(a.morale??80)<40)return;
  a.formation='Assault';route=[choice.target.id];
  if(attackRatio(s,a,choice.target,i.byProvince)<AI_LEVELS[s.aiDifficulty??'Normal'].risk){
   for(const other of i.byProvince.get(a.provinceId)??[])if(other.id!==a.id&&!other.order&&!i.busy.has(other.id)&&(aiControls(s,other.ownerId)||other.militaryPlan?.autoCommand)&&warBetween(s,other.ownerId,choice.target.controllerId??choice.target.ownerId)&&(other.supply??100)>=30&&(other.organization??80)>=40&&(other.morale??80)>=40){
    other.formation='Assault';other.militaryPlan??={...plan,source:'AI'};orderOperation(s,i,other,choice.target,route,other.militaryPlan);
   }
  }
 }else a.formation=choice.objective==='Defend'?'Defensive':'Mobile';
 orderOperation(s,i,a,choice.target,route,plan);
}
/** Bounded daily war work: <=24 countries, <=96 armies, <=12000 BFS nodes.
 * Nations and stacks rotate; a large empire cannot starve other fronts. */
export function periodicMilitaryAI(s:GameState):void{
 if(!s.dataset)return;
 // Peaceful countries without player operations have no tactical work. Keep
 // human takeovers effective before skipping geography/supply index creation.
 const humans=new Set(s.players.filter(p=>p.countryId&&!p.aiControlled).map(p=>p.countryId));
 let pending=false;
 for(const a of s.armies){
  if(humans.has(a.ownerId)&&a.militaryPlan?.source==='AI')delete a.militaryPlan;
  if(a.escortArmyId||a.militaryPlan?.source==='Player'&&a.militaryPlan.autoCommand)pending=true;
 }
 if(!s.wars?.length&&!s.sieges?.length&&!pending&&!(s.armyGroups??[]).some(g=>humans.has(g.ownerId))){s.aiMilitaryCursor=0;return;}
 const i=militaryIndex(s),budget={nodes:12000},day=s.simulationDay??0;
 // Opt-in player plans and legacy groups have the same legal operational logic.
 let work=0;
 for(const a of s.armies)if(a.militaryPlan?.source==='Player'&&a.militaryPlan.autoCommand&&work++<24)executeArmy(s,i,a,budget,true);
 for(const g of s.armyGroups??[])if(!aiControls(s,g.ownerId))for(const id of g.armyIds){const a=(i.byOwner.get(g.ownerId)??[]).find(a=>a.id===id);if(!a||a.militaryPlan||a.order||i.busy.has(a.id)||work++>=40)continue;const target=i.provinces.get(g.targetProvinceId);if(!target)continue;if(g.objective==='Offensive'&&attackRatio(s,a,target,i.byProvince)<1.12)continue;try{setArmyOrder(s,g.ownerId,a.id,target.id);}catch{}}
 for(const a of s.armies)if(a.escortArmyId&&!a.order&&!i.busy.has(a.id)&&work++<48){const leader=s.armies.find(b=>b.id===a.escortArmyId);if(!leader||!canEnterTerritory(s,a.ownerId,leader.ownerId)||warBetween(s,a.ownerId,leader.ownerId)){delete a.escortArmyId;continue;}if(a.provinceId!==leader.provinceId)try{setArmyOrder(s,a.ownerId,a.id,leader.provinceId);}catch{}}
 const ids=[...new Set((s.wars??[]).flatMap(w=>[...w.attackers,...w.defenders]))].filter(id=>aiControls(s,id)&&(i.byOwner.get(id)?.length??0)>0).sort();
 const cursor=s.aiMilitaryCursor??0,count=Math.min(24,ids.length),level=AI_LEVELS[s.aiDifficulty??'Normal'];let armiesDone=0,countriesDone=0;
 for(let n=0;n<count&&armiesDone<96&&budget.nodes>0;n++){
  countriesDone++;const id=ids[(cursor+n)%ids.length]!,c=s.countries[id]!;reviewStrategy(s,c);const armies=i.byOwner.get(id)!,start=c.aiArmyCursor??0,limit=Math.min(level.armies,armies.length,96-armiesDone);
  for(let x=0;x<limit;x++){const a=armies[(start+x)%armies.length]!;executeArmy(s,i,a,budget);armiesDone++;}
  c.aiArmyCursor=(start+limit)%armies.length;
  const war=s.wars?.find(w=>[...w.attackers,...w.defenders].includes(id));if(war&&c.aiStrategy){const assigned=armies.filter(a=>a.militaryPlan?.source==='AI'&&a.militaryPlan.objective!=='Reserve');c.aiStrategy.operation={warId:war.id,targetCountryId:(war.attackers.includes(id)?war.defenders:war.attackers)[0]!,assignedArmyIds:assigned.slice(0,120).map(a=>a.id),stagingProvinceIds:[...new Set(assigned.map(a=>a.militaryPlan!.stagingProvinceId).filter((id):id is string=>!!id))].slice(0,12),priority:Math.max(0,...assigned.map(a=>a.militaryPlan!.priority)),status:assigned.some(a=>a.order)?'Executing':'Holding',reviewDay:day+7};}

 }
 s.aiMilitaryCursor=ids.length?(cursor+countriesDone)%ids.length:0;
 // AI can finish a favourable siege rather than wait pointlessly for months.
 for(const siege of (s.sieges??[]).slice(0,12))if(aiControls(s,siege.attackerId)&&day%3===0){const q=siegeForecast(s,siege);if(q.supply>=60&&q.troops>siege.garrison*4&&(siege.progress>=65||q.days>20))try{assaultSiege(s,siege.attackerId,siege.id);}catch{}}
}
export function aiConstructionPreference(c:Country,p:Province):string[]{const deficit=c.stockpile?.deficits;if(deficit?.food)return ['Farm','FoodProcessor','Ranch'];if(deficit?.ammunition)return ['AmmoFactory','ChemicalPlant','Steelworks'];if(deficit?.fuel)return ['Refinery','OilWell','Infrastructure'];if(deficit?.weapons)return ['ArmsFactory','Steelworks','Machinery'];const plan=c.aiStrategy;if(plan?.goal==='Defense')return ['Fort','MilitaryDepot','Infrastructure'];if(plan?.goal==='Science')return ['ResearchCenter','University','Laboratory'];if(plan?.goal==='Recovery')return ['Farm','Hospital','Infrastructure'];if(plan?.personality==='Trade')return ['CargoPort','Port','TransportTerminal'];return p.resourceDeposit?['Mine','Factory','Infrastructure']:['Farm','Factory','University'];}
