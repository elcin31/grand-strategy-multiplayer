import {hasTechnology,unlockTechnology} from './technologyTree.ts';
import type {GameState,Province,Country,BuildingType} from './gameTypes.ts';
import {BUILDINGS} from './buildingSystem.ts';
import {materialReason,payMaterials,addStock,type ResourceLedger} from './stockpileSystem.ts';
import {money} from './economySystem.ts';
import {notify} from './notificationSystem.ts';
export function buildingMaterials(type:BuildingType,level:number,year:number):ResourceLedger{const b=BUILDINGS[type],legacy={timber:6,steel:year>=1850?4:0,cement:year>=1850?8:0},materials=b.materials??legacy;return Object.fromEntries(Object.entries(materials).filter(([,n])=>n!>0).map(([t,n])=>[t,money(n!*level)])) as ResourceLedger;}
export function civilianConstructionSlots(s:GameState,c:Country):number{return Math.min(24,Math.max(2,Math.ceil((c.provinceIds?.length??1)/12)+s.provinces.reduce((n,p)=>p.ownerId===c.id?n+(p.buildings?.Factory??0)*2:n,0)));}
export function repairQuote(s:GameState,p:Province){const damage=p.buildingDamage??0,c=s.countries[p.ownerId]!,materials:ResourceLedger={timber:money(damage*6),steel:money(damage*4),cement:money(damage*8)},cost=money(damage*(50+Object.values(p.buildings??{}).reduce((n,l)=>n+l!,0)*20));const reason=(p.controllerId??p.ownerId)!==p.ownerId||p.rebellion?'Нужна контролируемая территория':damage<=0?'Ремонт не требуется':c.treasury<cost?'Недостаточно средств':materialReason(c,materials);return {cost,materials,reason};}
export function repairProvince(s:GameState,owner:string,p:Province):void{if(p.ownerId!==owner)throw Error('Можно ремонтировать только свои здания');const q=repairQuote(s,p);if(q.reason)throw Error(q.reason);payMaterials(s.countries[owner]!,q.materials);s.countries[owner]!.treasury=money(s.countries[owner]!.treasury-q.cost);p.buildingDamage=0;}
export const NATIONAL_PROJECTS={
 TransportNetwork:{name:'Национальная транспортная сеть',cost:800,months:18,stages:3,branch:'Industry',level:2,materials:{steel:60,cement:80},effect:'Инфраструктура ключевых регионов +1'},
 GrandPort:{name:'Международный торговый порт',cost:1000,months:18,stages:3,branch:'Diplomacy',level:2,materials:{steel:60,cement:100},effect:'Порт и грузовой узел в прибрежном регионе'},
 EnergyProgram:{name:'Общегосударственная энергетическая программа',cost:1100,months:24,stages:4,branch:'Industry',level:2,materials:{steel:100,copper:60},effect:'Энергетические сети в трёх регионах'},
 ScientificComplex:{name:'Национальный научный комплекс',cost:1200,months:24,stages:4,branch:'Administration',level:2,materials:{steel:60,cement:80},effect:'Исследовательский центр и лаборатория'},
 MilitaryProgram:{name:'Военно-промышленная программа',cost:1200,months:24,stages:4,branch:'Military',level:2,materials:{steel:100,cement:60},effect:'Оружейный завод и склад'},
 RegionalModernization:{name:'Региональная модернизация',cost:600,months:12,stages:3,branch:'Economy',level:1,materials:{timber:60,cement:60},effect:'Развитие пяти регионов +5; инфраструктура +1'},
} as const;
export type NationalProjectId=keyof typeof NATIONAL_PROJECTS;
export interface NationalProject {id:NationalProjectId;provinceId:string;startedTick:number;lastTick:number;work:number;stage:number}
export function nationalProjectReason(_s:GameState,c:Country,id:NationalProjectId,p:Province):string|null{const n=NATIONAL_PROJECTS[id],unlock=unlockTechnology('projects',id);if(unlock&&!hasTechnology(c,unlock))return 'Требуется специальная технология: '+unlock;if(c.nationalProject)return 'Национальный проект уже выполняется';if(c.completedProjects?.includes(id))return 'Проект уже завершён';if(p.ownerId!==c.id||(p.controllerId??p.ownerId)!==c.id||p.rebellion)return 'Нужна своя провинция';if((c.technologies?.[n.branch]??0)<n.level)return 'Недостаточная технология проекта';if(id==='GrandPort'&&!(p.buildings?.Port??0))return 'Выберите провинцию с портом';if(c.treasury<n.cost)return 'Недостаточно средств';return materialReason(c,n.materials);}
export function startNationalProject(s:GameState,c:Country,id:NationalProjectId,p:Province):void{const reason=nationalProjectReason(s,c,id,p);if(reason)throw Error(reason);const n=NATIONAL_PROJECTS[id];payMaterials(c,n.materials);c.treasury=money(c.treasury-n.cost);c.nationalProject={id,provinceId:p.id,startedTick:s.tick,lastTick:s.tick,work:0,stage:0};}
export function monthlyNationalProjects(s:GameState):void{
 for(const c of Object.values(s.countries)){
  if(c.stockpile?.autoRepair)for(const p of s.provinces.filter(p=>p.ownerId===c.id&&(p.buildingDamage??0)>0).slice(0,3))if(!repairQuote(s,p).reason&&c.treasury>200)repairProvince(s,c.id,p);
  const p=c.nationalProject;if(!p||p.lastTick===s.tick)continue;p.lastTick=s.tick;const province=s.provinces.find(x=>x.id===p.provinceId);if(!province||province.ownerId!==c.id||(province.controllerId??province.ownerId)!==c.id)continue;const n=NATIONAL_PROJECTS[p.id];p.work++;p.stage=Math.min(n.stages,Math.floor(p.work/n.months*n.stages));if(p.work<n.months)continue;
  const sites=s.provinces.filter(p=>p.ownerId===c.id&&(p.controllerId??p.ownerId)===c.id).sort((a,b)=>b.income-a.income).slice(0,5);
  const grant=(p:Province,t:BuildingType)=>{p.buildings??={};p.buildings[t]=Math.min(BUILDINGS[t].maxLevel,(p.buildings[t]??0)+1);};
  if(p.id==='TransportNetwork')for(const q of sites)grant(q,'Infrastructure');
  if(p.id==='GrandPort'){grant(province,'Port');grant(province,'CargoPort');}
  if(p.id==='EnergyProgram')for(const q of sites.slice(0,3))grant(q,'PowerGrid');
  if(p.id==='ScientificComplex'){grant(province,'ResearchCenter');grant(province,'Laboratory');}
  if(p.id==='MilitaryProgram'){grant(province,'ArmsFactory');grant(province,'MilitaryDepot');}
  if(p.id==='RegionalModernization')for(const q of sites){q.development=Math.min(100,(q.development??40)+5);grant(q,'Infrastructure');}
  c.completedProjects??=[];c.completedProjects.push(p.id);delete c.nationalProject;notify(s,c.id,'Construction','Национальный проект завершён: '+n.name,province.id);
 }
}
export function refundMaterials(c:Country,materials:ResourceLedger,fraction:number):void{for(const [t,n] of Object.entries(materials))addStock(c,t as keyof ResourceLedger,n!*fraction);}

export function initializeNationalProjects(s:GameState):void{for(const c of Object.values(s.countries)){if(c.completedProjects&&(!Array.isArray(c.completedProjects)||new Set(c.completedProjects).size!==c.completedProjects.length||c.completedProjects.some(id=>!Object.hasOwn(NATIONAL_PROJECTS,id))))throw Error('Invalid completed national projects');const p=c.nationalProject;if(p&&(!Object.hasOwn(NATIONAL_PROJECTS,p.id)||c.completedProjects?.includes(p.id)||!s.provinces.some(q=>q.id===p.provinceId)||![p.startedTick,p.lastTick,p.work,p.stage].every(n=>Number.isSafeInteger(n)&&n>=0)||p.lastTick>s.tick||p.work>=NATIONAL_PROJECTS[p.id].months||p.work>p.lastTick-p.startedTick))throw Error('Invalid national project');}for(const p of s.provinces)if(p.buildingDamage!==undefined&&(!Number.isFinite(p.buildingDamage)||p.buildingDamage<0||p.buildingDamage>1))throw Error('Invalid building damage');}
