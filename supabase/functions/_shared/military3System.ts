import type {Army,GameState,Province,BattleEvent} from './gameTypes.ts';
import {armyParts,takeArmyLosses,initializeArmyComposition} from './armyComposition.ts';
import {UNIT_TYPES,UNITS} from './unitCatalogue.ts';
import {combatMultiplier} from './militarySystem.ts';
import {retreatDestination,retreatArmy,awardBattleExperience} from './militaryLogistics.ts';
import {supplyAt,invalidateSupply,refreshSupplyLoads} from './supplySystem.ts';
import {warBetween} from './diplomacySystem.ts';
import {recordWarBattle} from './warSystem.ts';
import {notify} from './notificationSystem.ts';
export type Formation='Balanced'|'Assault'|'Defensive'|'Mobile';
export interface ActiveBattle {id:string;provinceId:string;attackerId:string;defenderId:string;attackerArmyIds:string[];defenderArmyIds:string[];startedDay:number;attackerInitial:number;defenderInitial:number;attackerLosses:number;defenderLosses:number;reasons:string[]}
export interface Siege {id:string;provinceId:string;attackerId:string;defenderId:string;armyIds:string[];startedDay:number;progress:number;fortress:number;garrison:number;losses:number}
export interface ArmyGroup {id:string;ownerId:string;name:string;armyIds:string[];objective:'Defend'|'Offensive'|'Reserve'|'Escort';targetProvinceId:string;supplyPriority:'Normal'|'High';frontProvinceIds?:string[];}
export function militaryEntity(s:GameState,prefix:string):string{const seq=s.nextEntityId??1;if(!Number.isSafeInteger(seq)||seq>=Number.MAX_SAFE_INTEGER)throw Error('Military sequence exhausted');s.nextEntityId=seq+1;return `${prefix}-${seq}`;}
export function armyInBattle(s:GameState,id:string):boolean{return !!s.activeBattles?.some(b=>b.attackerArmyIds.includes(id)||b.defenderArmyIds.includes(id));}
export function armyFormation(a:Army){const parts=armyParts(a),rows={Front:0,Rear:0,Flank:0,Support:0};for(const t of UNIT_TYPES)rows[UNITS[t].role]+=parts[t]??0;const covered=rows.Front+rows.Flank;
 return {...rows,attack:(a.formation==='Assault'?1.12:a.formation==='Defensive'?.9:1)*(covered?1:0.7)*(rows.Rear&&covered?1.08:1),defense:a.formation==='Defensive'?1.16:a.formation==='Assault'?.9:1,speed:a.formation==='Mobile'?1.2:a.formation==='Defensive'?.85:1};}
export function armyTravelDays(_s:GameState,a:Army,p:Province):number{const parts=armyParts(a),speed=UNIT_TYPES.reduce((n,t)=>n+(parts[t]??0)*UNITS[t].speed,0)/Math.max(1,a.troops),terrain=p.terrain==='mountain'?1.6:p.terrain==='forest'||p.terrain==='desert'?1.3:1,roads=1+(p.buildings?.Infrastructure??0)*.08;
 return Math.max(1,Math.ceil(3*terrain/(Math.max(.4,speed)*roads*armyFormation(a).speed)*(a.order?.redeploy?.65:1)*(1+Math.max(0,50-(a.supply??100))/100)));}
export function armyETA(s:GameState,a:Army):number{const provinces=new Map(s.provinces.map(p=>[p.id,p]));return Math.max(0,(a.order?.route??[]).reduce((n,id)=>n+armyTravelDays(s,a,provinces.get(id)!),0)-(a.order?.travelProgress??0));}
export function occupy(s:GameState,a:Army,p:Province):void{p.controllerId=a.ownerId;a.provinceId=p.id;invalidateSupply(s);}
export function beginSiege(s:GameState,a:Army,p:Province):void{
 const defender=p.controllerId??p.ownerId,existing=s.sieges?.find(x=>x.provinceId===p.id&&x.attackerId===a.ownerId);a.provinceId=p.id;
 if(existing){if(!existing.armyIds.includes(a.id))existing.armyIds.push(a.id);return;}
 const fortress=p.buildings?.Fort??0;if(!fortress){occupy(s,a,p);return;}
 s.sieges??=[];s.sieges.push({id:militaryEntity(s,'siege'),provinceId:p.id,attackerId:a.ownerId,defenderId:defender,armyIds:[a.id],startedDay:s.simulationDay??0,progress:0,fortress,garrison:1500+fortress*1500,losses:0});notify(s,a.ownerId,'Siege','Началась осада: '+p.name,p.id);notify(s,defender,'Siege','Осада вашей крепости: '+p.name,p.id);
}
export function beginBattle(s:GameState,a:Army,p:Province):void{
 const existing=s.activeBattles?.find(b=>b.provinceId===p.id&&b.attackerId===a.ownerId);if(existing){if(!existing.attackerArmyIds.includes(a.id)){existing.attackerArmyIds.push(a.id);existing.attackerInitial+=a.troops;}return;}
 const defender=p.controllerId??p.ownerId,defenders=s.armies.filter(d=>d.provinceId===p.id&&warBetween(s,a.ownerId,d.ownerId));
 if(!defenders.length){beginSiege(s,a,p);return;}
 s.activeBattles??=[];s.activeBattles.push({id:militaryEntity(s,'battle'),provinceId:p.id,attackerId:a.ownerId,defenderId:defender,attackerArmyIds:[a.id],defenderArmyIds:defenders.map(d=>d.id),startedDay:s.simulationDay??0,attackerInitial:a.troops,defenderInitial:defenders.reduce((n,d)=>n+d.troops,0),attackerLosses:0,defenderLosses:0,reasons:[`Местность: ${p.terrain??'plains'}`,`Укрепления: ${p.buildings?.Fort??0}`]});
}
function distributeLosses(rows:Army[],loss:number):number{let remaining=loss,total=rows.reduce((n,a)=>n+a.troops,0),sum=0;for(const a of rows){const hit=takeArmyLosses(a,Math.min(a.troops,Math.round(remaining*a.troops/Math.max(1,total))));total-=a.troops+hit;remaining-=hit;sum+=hit;}return sum;}
function finishBattle(s:GameState,b:ActiveBattle,attackers:Army[],defenders:Army[],attackerWins:boolean):void{
 const p=s.provinces.find(p=>p.id===b.provinceId)!;const winners=attackerWins?attackers:defenders,losers=attackerWins?defenders:attackers;
 for(const a of losers){delete a.order;const target=retreatDestination(s,a,p.id);if(target)retreatArmy(s,a.ownerId,a.id,target.id,true);else if(attackerWins){b.defenderLosses+=takeArmyLosses(a,a.troops);}}
 if(attackerWins)for(const a of winners.filter(a=>a.troops>0)){beginSiege(s,a,p);if(a.order?.route[0]===p.id){a.order.route.shift();if(!a.order.route.length)delete a.order;}}
 const winner=attackerWins?b.attackerId:b.defenderId,days=Math.max(1,(s.simulationDay??0)-b.startedDay+1);
 const report:BattleEvent={id:b.id,tick:s.tick,provinceId:p.id,attackerId:b.attackerId,defenderId:b.defenderId,attackerLosses:b.attackerLosses,defenderLosses:b.defenderLosses,winnerId:winner,captured:attackerWins&&!s.sieges?.some(x=>x.provinceId===p.id),message:`${s.countries[winner]!.shortName}: победа у ${p.name}`,durationDays:days,attackerInitial:b.attackerInitial,defenderInitial:b.defenderInitial,reasons:[...b.reasons,`Атакующие: снабжение ${Math.round(attackers.reduce((n,a)=>n+(a.supply??100),0)/Math.max(1,attackers.length))}%`,`Исход: ${attackerWins?'оборона потеряла организацию':'наступление остановлено потерями и организацией'}`],experience:3};
 s.battleLog.unshift(report);s.battleLog=s.battleLog.slice(0,30);recordWarBattle(s,report);awardBattleExperience(s,[...winners,...losers],winner);
 for(const c of [b.attackerId,b.defenderId])notify(s,c,'War',`${report.message} · ${days} дн.`,p.id);
}
export function siegeSupply(s:GameState,owner:string,p:Province):number{let best=0;for(const id of p.neighbors)best=Math.max(best,supplyAt(s,owner,id).score*.85);return best;}
export function dailyMilitary(s:GameState):void{
 const provinces=new Map(s.provinces.map(p=>[p.id,p]));
 for(const b of [...s.activeBattles??[]]){
  if(!warBetween(s,b.attackerId,b.defenderId)){s.activeBattles=s.activeBattles?.filter(x=>x.id!==b.id);continue;}
  const attackers=s.armies.filter(a=>b.attackerArmyIds.includes(a.id)&&a.troops>0),defenders=s.armies.filter(a=>b.defenderArmyIds.includes(a.id)&&a.troops>0&&a.provinceId===b.provinceId),p=provinces.get(b.provinceId)!;
  const power=(rows:Army[],defending:boolean)=>rows.reduce((n,a)=>n+a.troops*combatMultiplier(s,a,p,defending)*(defending?armyFormation(a).defense:armyFormation(a).attack)*(a.order?.redeploy?.55:1),0);
  const atk=power(attackers,false),def=power(defenders,true)*(1+(p.buildings?.Fort??0)*.04);
  b.attackerLosses+=distributeLosses(attackers,Math.max(0,Math.round(def*.025)));b.defenderLosses+=distributeLosses(defenders,Math.max(0,Math.round(atk*.025)));
  for(const a of [...attackers,...defenders]){a.organization=Math.max(0,(a.organization??80)-2.5-(100-(a.supply??100))*.025);a.morale=Math.max(0,(a.morale??80)-1.5);}
  const broken=(rows:Army[])=>!rows.some(a=>a.troops>0&&(a.organization??80)>20&&(a.morale??80)>20);
  if(broken(attackers)||broken(defenders)||(s.simulationDay??0)-b.startedDay>=45){const wins=!broken(attackers)&&(broken(defenders)||atk>def*1.25);finishBattle(s,b,attackers,defenders,wins);s.activeBattles=s.activeBattles?.filter(x=>x.id!==b.id);}
 }
 for(const siege of [...s.sieges??[]]){
  const p=provinces.get(siege.provinceId)!,armies=s.armies.filter(a=>siege.armyIds.includes(a.id)&&a.provinceId===p.id&&a.troops>0);
  if(!armies.length||!warBetween(s,siege.attackerId,siege.defenderId)||(p.controllerId??p.ownerId)===siege.attackerId){s.sieges=s.sieges?.filter(x=>x.id!==siege.id);continue;}
  const supply=siegeSupply(s,siege.attackerId,p),troops=armies.reduce((n,a)=>n+a.troops,0),siegeTroops=armies.reduce((n,a)=>n+(armyParts(a).SiegeTrain??0)+(armyParts(a).Artillery??0)*.6+(armyParts(a).Engineers??0)*.4,0);
  const generals=armies.reduce((n,a)=>Math.max(n,a.commanderId?s.commanders?.[a.commanderId]?.siege??0:0),0);
  siege.progress=Math.min(100,siege.progress+Math.max(.2,(troops/Math.max(1000,siege.garrison)*.65+siegeTroops/3000)*(supply/100+.15)*(1+generals/100)/(1+siege.fortress*.4)));
  for(const a of armies){a.supply=supply;siege.losses+=takeArmyLosses(a,Math.min(a.troops,Math.floor(a.troops*(.001+(100-supply)*.00002))));}
  if(siege.progress>=100){for(const a of armies)occupy(s,a,p);p.buildingDamage=Math.min(.85,(p.buildingDamage??0)+.15);notify(s,siege.attackerId,'Siege','Крепость капитулировала: '+p.name,p.id);notify(s,siege.defenderId,'Siege','Крепость потеряна: '+p.name,p.id);s.sieges=s.sieges?.filter(x=>x.id!==siege.id);}
 }
 const fighting=new Set((s.activeBattles??[]).flatMap(b=>[...b.attackerArmyIds,...b.defenderArmyIds]));
 for(const a of s.armies){const p=provinces.get(a.provinceId)!;if(!fighting.has(a.id)&&!s.sieges?.some(x=>x.armyIds.includes(a.id))){const supply=supplyAt(s,a.ownerId,p.id).score;a.supply=supply;const friendly=(p.controllerId??p.ownerId)===a.ownerId;a.organization=Math.min(100,(a.organization??80)+(friendly?.5:.15)*supply/100);a.morale=Math.min(100,(a.morale??80)+.2*supply/100);if(supply<40)takeArmyLosses(a,Math.min(a.troops,Math.floor(a.troops*(40-supply)/120000)));}}
 s.armies=s.armies.filter(a=>a.troops>0);for(const c of Object.values(s.countries))c.army=0;for(const a of s.armies)s.countries[a.ownerId]!.army+=a.troops;refreshSupplyLoads(s);
}
export function mergeArmies(s:GameState,owner:string,ids:string[]):void{
 const armies=ids.map(id=>s.armies.find(a=>a.id===id&&a.ownerId===owner));if(armies.some(a=>!a)||armies.length<2)throw Error('Выберите хотя бы две свои армии');const target=armies[0]!;
 if(armies.some(a=>a!.provinceId!==target.provinceId||armyInBattle(s,a!.id)||a!.order))throw Error('Объединяются неподвижные армии в одной провинции');const total=armies.reduce((n,a)=>n+a!.troops,0);target.experience=armies.reduce((n,a)=>n+a!.troops*(a!.experience??0),0)/total;
 const parts:NonNullable<Army['composition']>={},template:NonNullable<Army['template']>={};for(const a of armies)for(const t of UNIT_TYPES){parts[t]=(parts[t]??0)+(armyParts(a!)[t]??0);template[t]=(template[t]??0)+(a!.template?.[t]??armyParts(a!)[t]??0);}
 for(const t of UNIT_TYPES){if(!parts[t])delete parts[t];if(!template[t])delete template[t];}target.composition=parts;target.template=template;target.troops=total;target.morale=Math.min(...armies.map(a=>a!.morale??80));target.organization=Math.min(...armies.map(a=>a!.organization??80));s.armies=s.armies.filter(a=>a.id===target.id||!ids.includes(a.id));for(const group of s.armyGroups??[])group.armyIds=group.armyIds.filter(id=>!ids.includes(id)||id===target.id);invalidateSupply(s);
}
export function splitArmy(s:GameState,owner:string,id:string,percent:number):void{
 const a=s.armies.find(a=>a.id===id&&a.ownerId===owner);if(!a||a.troops<2000||a.order||armyInBattle(s,id))throw Error('Разделение недоступно движущейся или сражающейся армии');const composition:NonNullable<Army['composition']>={},template:NonNullable<Army['template']>={};let troops=0;
 for(const t of UNIT_TYPES){const n=Math.floor((armyParts(a)[t]??0)*percent/100),target=Math.floor((a.template?.[t]??0)*percent/100);if(n){composition[t]=n;troops+=n;a.composition![t]!-=n;if(!a.composition![t])delete a.composition![t];}if(target){template[t]=target;a.template![t]!-=target;if(!a.template![t])delete a.template![t];}}
 if(!troops)throw Error('Слишком мало солдат');a.troops-=troops;const next:Army={...a,id:militaryEntity(s,'army'),troops,composition,template};delete next.commanderId;delete next.escortArmyId;initializeArmyComposition(next);s.armies.push(next);invalidateSupply(s);
}
export function initializeMilitary3(s:GameState,migrate:boolean):void{
 if(migrate){s.activeBattles??=[];s.sieges??=[];s.armyGroups??=[];}
 const armies=new Set(s.armies.map(a=>a.id)),provinces=new Set(s.provinces.map(p=>p.id));
 for(const rows of [s.activeBattles,s.sieges,s.armyGroups])if(!Array.isArray(rows)||rows.length>600||new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Invalid military projects');
 for(const b of s.activeBattles!){if(!provinces.has(b.provinceId)||!s.countries[b.attackerId]||!s.countries[b.defenderId]||![b.startedDay,b.attackerInitial,b.defenderInitial,b.attackerLosses,b.defenderLosses].every(n=>Number.isSafeInteger(n)&&n>=0)||b.startedDay>(s.simulationDay??0)||!Array.isArray(b.attackerArmyIds)||!Array.isArray(b.defenderArmyIds))throw Error('Invalid battle');}
 for(const x of s.sieges!){if(!provinces.has(x.provinceId)||!s.countries[x.attackerId]||!s.countries[x.defenderId]||![x.progress,x.fortress,x.garrison,x.losses].every(n=>Number.isFinite(n)&&n>=0)||x.progress>100||!Number.isSafeInteger(x.startedDay)||x.startedDay>(s.simulationDay??0)||!Array.isArray(x.armyIds))throw Error('Invalid siege');}
 for(const g of s.armyGroups!){if(!s.countries[g.ownerId]||!provinces.has(g.targetProvinceId)||!['Defend','Offensive','Reserve','Escort'].includes(g.objective)||!['Normal','High'].includes(g.supplyPriority)||!Array.isArray(g.armyIds)||g.armyIds.length>20||g.armyIds.some(id=>armies.has(id)&&!s.armies.some(a=>a.id===id&&a.ownerId===g.ownerId)))throw Error('Invalid army group');}
 for(const a of s.armies){if(a.formation!==undefined&&!['Balanced','Assault','Defensive','Mobile'].includes(a.formation))throw Error('Invalid formation');if(a.order?.travelProgress!==undefined&&(!Number.isSafeInteger(a.order.travelProgress)||a.order.travelProgress<0||a.order.travelProgress>20))throw Error('Invalid route progress');}
}
