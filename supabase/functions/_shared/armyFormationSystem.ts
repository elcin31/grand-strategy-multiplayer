import type {Country,GameState} from './gameTypes.ts';
import {UNITS,UNIT_TYPES,type UnitType} from './unitCatalogue.ts';
import {addArmyRegiment,compositionTotal,initializeArmyComposition,type Composition} from './armyComposition.ts';
import {equipmentMaterials} from './productionSystem.ts';
import {addStock,materialReason,payMaterials,type ResourceLedger} from './stockpileSystem.ts';
import {hasTechnology,unlockTechnology} from './technologyTree.ts';
import {techLevel} from './technologySystem.ts';
import {armyInBattle,militaryEntity} from './military3System.ts';
import {invalidateSupply} from './supplySystem.ts';
import {money,refreshArmyBudget} from './economySystem.ts';
import {notify} from './notificationSystem.ts';
export const MAX_FORMATION_TROOPS=1_000_000,MAX_RECRUIT_BATCH=100_000;
export interface ArmyTemplate {id:string;name:string;weights:Composition}
export interface ArmyFormation {id:string;armyId:string;ownerId:string;provinceId:string;name:string;composition:Composition;formed:Composition;commanderId:string|null;cost:number;materials:ResourceLedger;startedDay:number;lastDay:number;status:'Training'|'Blocked'}
export function unitAvailable(s:GameState,c:Country,t:UnitType):boolean{const unlock=unlockTechnology('units',t);return s.year>=UNITS[t].era&&techLevel(c,'Military')>=UNITS[t].unlock&&(!unlock||hasTechnology(c,unlock));}
export function armyTemplates(s:GameState,c:Country):ArmyTemplate[]{
 const infantry:UnitType=s.year>=1550&&unitAvailable(s,c,'Musketeers')&&s.year<1900?'Musketeers':'Infantry';
 const templates:[string,string,Composition][]=[['infantry','Пехотная армия',{[infantry]:85,Logistics:10,Engineers:5}],['mobile','Мобильная армия',{Motorized:50,Mechanized:25,Cavalry:15,Logistics:10}],['defensive','Оборонительная армия',{[infantry]:65,Spearmen:10,AirDefense:15,Engineers:10}],['siege','Осадная армия',{[infantry]:55,SiegeTrain:20,Artillery:15,Engineers:10}],['balanced','Сбалансированная армия',{[infantry]:60,Cavalry:10,Artillery:20,Logistics:10}]];
 return [...templates.map(([id,name,parts])=>{const weights:Composition={};for(const t of UNIT_TYPES)if(parts[t]&&unitAvailable(s,c,t))weights[t]=parts[t];if(!Object.keys(weights).length)weights.Infantry=100;return {id,name,weights};}),...(c.armyTemplates??[])];
}
export function templateComposition(t:ArmyTemplate,troops:number):Composition{const parts:Composition={},total=compositionTotal(t.weights);let left=troops;const entries=UNIT_TYPES.filter(u=>t.weights[u]);entries.forEach((u,n)=>{const count=n===entries.length-1?left:Math.floor(troops*t.weights[u]!/total);if(count>0)parts[u]=count;left-=count;});return parts;}
export function assertFormationComposition(input:unknown):asserts input is Composition{
 if(!input||typeof input!=='object'||Array.isArray(input)||!Object.keys(input).length||Object.keys(input).some(t=>!Object.hasOwn(UNITS,t))||Object.values(input).some(n=>!Number.isSafeInteger(n)||Number(n)<1))throw Error('Недопустимый состав армии');
 const total=compositionTotal(input as Composition);if(!Number.isSafeInteger(total)||total<1000||total>MAX_FORMATION_TROOPS)throw Error('Допустимый размер армии: 1 000–1 000 000 солдат');
}
export function formationCapacity(s:GameState,owner:string,province:string):number{const p=s.provinces.find(p=>p.id===province);return Math.min(MAX_RECRUIT_BATCH,10000+(p?.buildings?.Barracks??0)*5000+(p?.buildings?.MilitaryBase??0)*5000+(s.countries[owner]?.militaryDoctrine==='Logistics'?2000:0));}
export function formationQuote(s:GameState,owner:string,provinceId:string,parts:Composition,commanderId:string|null=null):{troops:number;cost:number;materials:ResourceLedger;days:number;reason:string|null}{
 let error:string|null=null;try{assertFormationComposition(parts);}catch(e){error=e instanceof Error?e.message:'Некорректный состав';}
 const c=s.countries[owner],p=s.provinces.find(p=>p.id===provinceId),troops=compositionTotal(parts),materials:ResourceLedger={};let cost=0;
 for(const t of UNIT_TYPES)if(parts[t]){cost+=Math.ceil(parts[t]!/1000)*UNITS[t].cost;for(const [r,n] of Object.entries(equipmentMaterials(s,t,parts[t]!)))materials[r as keyof ResourceLedger]=money((materials[r as keyof ResourceLedger]??0)+n!);}
 if(!error){if(!c||!p||p.ownerId!==owner||(p.controllerId??p.ownerId)!==owner||p.rebellion)error='Нужна своя контролируемая провинция';
 else if((s.armyFormations??[]).filter(q=>q.ownerId===owner).length>=8)error='Одновременно формируются не более восьми армий';
 else if(s.tick<(c.bankruptcyUntilTick??0))error='Набор недоступен после банкротства';
 else if(UNIT_TYPES.some(t=>parts[t]&&!unitAvailable(s,c,t)))error='Состав требует недоступной технологии или эпохи';
 else if(c.treasury<cost)error='Недостаточно средств';else if(c.manpower<troops)error='Недостаточно военного резерва';
 else if(c.militaryCeiling&&s.tick<c.militaryCeiling.untilTick&&c.army+(s.armyFormations??[]).filter(q=>q.ownerId===owner).reduce((n,q)=>n+compositionTotal(q.composition)-compositionTotal(q.formed),0)+troops>c.militaryCeiling.troops)error='Мирный договор ограничивает численность армии';
 else if(commanderId&&(!s.commanders?.[commanderId]||s.commanders[commanderId]!.countryId!==owner||s.armies.some(a=>a.commanderId===commanderId)||s.armyFormations?.some(q=>q.commanderId===commanderId)))error='Командир недоступен';
 else if(c.stockpile)error=materialReason(c,materials);}
 return {troops,cost:money(cost),materials,days:Math.ceil(troops/formationCapacity(s,owner,provinceId)),reason:error};
}
export function createArmyFormation(s:GameState,owner:string,name:string,province:string,parts:Composition,commanderId:string|null):void{
 const q=formationQuote(s,owner,province,parts,commanderId);if(q.reason)throw Error(q.reason);const c=s.countries[owner]!;
 // Reserve all real costs once, atomically with the immutable command reducer.
 c.treasury=money(c.treasury-q.cost);c.manpower-=q.troops;if(c.stockpile)payMaterials(c,q.materials);
 s.armyFormations??=[];s.armyFormations.push({id:militaryEntity(s,'formation'),armyId:militaryEntity(s,'army'),ownerId:owner,provinceId:province,name:name.trim(),composition:{...parts},formed:{},commanderId,cost:q.cost,materials:q.materials,startedDay:s.simulationDay??0,lastDay:s.simulationDay??0,status:'Training'});
}
export function cancelArmyFormation(s:GameState,owner:string,id:string):void{
 const q=s.armyFormations?.find(q=>q.id===id&&q.ownerId===owner);if(!q)throw Error('Формирование не найдено');const c=s.countries[owner]!,remaining=compositionTotal(q.composition)-compositionTotal(q.formed),refund:ResourceLedger={};let cash=0;
 for(const t of UNIT_TYPES){const target=q.composition[t]??0,left=target-(q.formed[t]??0);if(!left)continue;cash+=Math.ceil(target/1000)*UNITS[t].cost*left/target;for(const [r,n] of Object.entries(equipmentMaterials(s,t,left)))refund[r as keyof ResourceLedger]=money((refund[r as keyof ResourceLedger]??0)+n!);}
 c.manpower+=remaining;c.treasury=money(c.treasury+cash);if(c.stockpile)for(const [r,n] of Object.entries(refund))addStock(c,r as keyof ResourceLedger,Math.min(q.materials[r as keyof ResourceLedger]??0,n!));
 const a=s.armies.find(a=>a.id===q.armyId);if(a){delete a.formationId;a.template={...a.composition};if(q.commanderId)a.commanderId=q.commanderId;}
 s.armyFormations=s.armyFormations!.filter(x=>x.id!==q.id);invalidateSupply(s);
}
export function processArmyFormations(s:GameState):void{
 const day=s.simulationDay??0;let changed=false;
 for(const q of s.armyFormations??[]){if(q.lastDay>=day)continue;q.lastDay=day;const p=s.provinces.find(p=>p.id===q.provinceId);if(!p||p.ownerId!==q.ownerId||(p.controllerId??p.ownerId)!==q.ownerId||p.rebellion){q.status='Blocked';continue;}q.status='Training';const c=s.countries[q.ownerId]!;
  const peers=s.armyFormations!.filter(x=>x.ownerId===q.ownerId&&x.provinceId===q.provinceId).length;let limit=Math.max(1000,Math.floor(formationCapacity(s,q.ownerId,q.provinceId)/Math.max(1,peers))),a=s.armies.find(a=>a.id===q.armyId);
  for(const t of UNIT_TYPES){const count=Math.min(limit,MAX_RECRUIT_BATCH,(q.composition[t]??0)-(q.formed[t]??0));if(count<=0)continue;
   if(!a){a={id:q.armyId,name:q.name,ownerId:q.ownerId,provinceId:q.provinceId,troops:count,unitType:t,morale:UNITS[t].morale,organization:UNITS[t].organization*.8,formationId:q.id,template:{...q.composition}};initializeArmyComposition(a);s.armies.push(a);}else addArmyRegiment(a,t,count,false);
   q.formed[t]=(q.formed[t]??0)+count;limit-=count;c.army+=count;c.militaryUpkeepBase=money((c.militaryUpkeepBase??0)+count/1000*1.25*UNITS[t].upkeep);refreshArmyBudget(c);changed=true;
  }
  if(compositionTotal(q.formed)===compositionTotal(q.composition)&&a){delete a.formationId;if(q.commanderId)a.commanderId=q.commanderId;notify(s,q.ownerId,'War','Сформирована армия: '+q.name,q.provinceId);}
 }
 s.armyFormations=s.armyFormations?.filter(q=>compositionTotal(q.formed)<compositionTotal(q.composition));if(changed)invalidateSupply(s);
}
export function transferRegiment(s:GameState,owner:string,from:string,to:string,type:UnitType,count:number):void{
 const a=s.armies.find(a=>a.id===from&&a.ownerId===owner),b=s.armies.find(a=>a.id===to&&a.ownerId===owner);
 if(!a||!b||a===b||a.provinceId!==b.provinceId||[a,b].some(a=>a.order||a.formationId||armyInBattle(s,a.id)||s.sieges?.some(x=>x.armyIds.includes(a.id)))||(a.composition?.[type]??0)<count||a.troops<=count)throw Error('Передача полка недоступна');
 const morale=(a.morale??80),org=(a.organization??80),old=b.troops,oldMorale=b.morale??80,oldOrg=b.organization??80;a.composition![type]!-=count;a.template![type]!-=count;a.troops-=count;if(!a.composition![type])delete a.composition![type];if(!a.template![type])delete a.template![type];addArmyRegiment(b,type,count);b.morale=(oldMorale*old+morale*count)/b.troops;b.organization=(oldOrg*old+org*count)/b.troops;invalidateSupply(s);
}
export function initializeArmyFormations(s:GameState):void{
 s.armyFormations??=[];if(!Array.isArray(s.armyFormations)||s.armyFormations.length>2400||new Set(s.armyFormations.map(q=>q.id)).size!==s.armyFormations.length||new Set(s.armyFormations.map(q=>q.armyId)).size!==s.armyFormations.length)throw Error('Invalid army formation queue');
 const reserved=new Set<string>();for(const q of s.armyFormations){assertFormationComposition(q.composition);if(!s.countries[q.ownerId]||!s.provinces.some(p=>p.id===q.provinceId)||!q.name||q.name.length>48||!Number.isFinite(q.cost)||q.cost<0||!Number.isSafeInteger(q.startedDay)||q.startedDay<0||q.startedDay>(s.simulationDay??0)||!Number.isSafeInteger(q.lastDay)||q.lastDay<q.startedDay||q.lastDay>(s.simulationDay??0)||!['Training','Blocked'].includes(q.status)||Object.entries(q.formed).some(([t,n])=>!Object.hasOwn(UNITS,t)||!Number.isSafeInteger(n)||n!<=0||n!>(q.composition[t as UnitType]??0))||compositionTotal(q.formed)>=compositionTotal(q.composition))throw Error('Invalid formation');const a=s.armies.find(a=>a.id===q.armyId);if(a&&(a.ownerId!==q.ownerId||a.formationId!==q.id||UNIT_TYPES.some(t=>(a.composition?.[t]??0)>(q.formed[t]??0))))throw Error('Invalid formation strength');if(q.commanderId){if(reserved.has(q.commanderId)||!s.commanders?.[q.commanderId]||s.commanders[q.commanderId]!.countryId!==q.ownerId||s.armies.some(a=>a.commanderId===q.commanderId))throw Error('Invalid reserved commander');reserved.add(q.commanderId);}}
 for(const a of s.armies)if(a.formationId&&!s.armyFormations.some(q=>q.id===a.formationId&&q.armyId===a.id))throw Error('Invalid army training status');
 for(const c of Object.values(s.countries)){c.armyTemplates??=[];if(c.armyTemplates.length>12||new Set(c.armyTemplates.map(t=>t.id)).size!==c.armyTemplates.length)throw Error('Invalid templates');for(const t of c.armyTemplates)if(!/^[a-zA-Z0-9_-]{1,64}$/.test(t.id)||!t.name||t.name.length>48||!Object.keys(t.weights).length||Object.entries(t.weights).some(([u,n])=>!Object.hasOwn(UNITS,u)||!Number.isSafeInteger(n)||n!<1||n!>1000))throw Error('Invalid template');}
}
