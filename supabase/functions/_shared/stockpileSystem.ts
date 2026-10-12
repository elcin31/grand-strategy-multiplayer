import {technologyBonuses} from './technologyTree.ts';
import type {Country,GameState,Province} from './gameTypes.ts';
import {RESOURCES,RESOURCE_TYPES,FOOD_RESOURCES,type ResourceType} from './resourceCatalogue.ts';
import {provinceProduction} from './resourceSystem.ts';
import {provinceBuildingModifiers} from './buildingSystem.ts';
import {money} from './economySystem.ts';
import {espionageModifiers} from './espionageSystem.ts';
import {economicPolicy} from './economy2System.ts';
import {focusBonuses} from './focusCatalogue.ts';
import {warBetween,pairKey} from './diplomacySystem.ts';
import {notify} from './notificationSystem.ts';
export type ResourceLedger=Partial<Record<ResourceType,number>>;
export interface Stockpile {amounts:ResourceLedger;produced:ResourceLedger;consumed:ResourceLedger;deficits:ResourceLedger;capacity:number;tradeRevenue:number;importExpense:number;autoTrade:boolean;autoRepair:boolean;priority:'Balanced'|'Civilian'|'Military';lastTick:number;industrialIncome?:number}
export interface ResourceContract {id:string;exporterId:string;importerId:string;offeredBy:string;resource:ResourceType;quantity:number;price:number;months:number;accepted:boolean;lastTick:number;fulfilled:number;efficiency:number}
function hash(text:string){let n=2166136261;for(const c of text)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;}
export function stockpileCapacity(s:GameState,id:string):number{return 500+s.provinces.reduce((n,p)=>p.ownerId===id?n+150+(p.buildings?.Infrastructure??0)*100+(p.buildings?.Warehouse??0)*1000+(p.buildings?.MilitaryDepot??0)*600: n,0);}
export function stock(c:Country,t:ResourceType):number{return c.stockpile?.amounts[t]??0;}
export function resourcePrice(s:GameState,t:ResourceType):number{return s.resourcePrices?.[t]??RESOURCES[t].price;}
export function addStock(c:Country,t:ResourceType,amount:number,produced=false):number{const v=c.stockpile;if(!v)return 0;const accepted=money(Math.max(0,Math.min(amount,v.capacity-stock(c,t))));v.amounts[t]=money(stock(c,t)+accepted);if(produced)v.produced[t]=money((v.produced[t]??0)+accepted);return accepted;}
export function consumeStock(c:Country,t:ResourceType,amount:number,allowDeficit=false):number{const v=c.stockpile;if(!v)return 0;const used=money(Math.min(stock(c,t),amount));if(!allowDeficit&&used+1e-6<amount)throw Error('Недостаточно ресурса: '+RESOURCES[t].name);v.amounts[t]=money(Math.max(0,stock(c,t)-used));v.consumed[t]=money((v.consumed[t]??0)+used);if(allowDeficit&&amount>used)v.deficits[t]=money((v.deficits[t]??0)+amount-used);return used;}
export function materialReason(c:Country,materials:ResourceLedger):string|null{for(const t of RESOURCE_TYPES)if(stock(c,t)+1e-6<(materials[t]??0))return `Нужны материалы: ${RESOURCES[t].name} ${materials[t]}`;return null;}
export function payMaterials(c:Country,materials:ResourceLedger):void{const reason=materialReason(c,materials);if(reason)throw Error(reason);for(const t of RESOURCE_TYPES)if(materials[t])consumeStock(c,t,materials[t]!);}
export function initializeStockpiles(s:GameState,migrate:boolean):void{
 if(migrate){s.tradeContracts??=[];s.resourcePrices??={};s.resourceLeaders??={};for(const c of Object.values(s.countries))if(!c.stockpile){const capacity=stockpileCapacity(s,c.id),army=c.army/1000;c.stockpile={capacity,amounts:{food:money(Math.min(capacity,c.population/1e6*2+50)),timber:100,iron:80,coal:80,steel:60,cement:80,fuel:army*2+30,weapons:army*2+30,ammunition:army*2+30},produced:{},consumed:{},deficits:{},tradeRevenue:0,importExpense:0,autoTrade:true,autoRepair:false,priority:'Balanced',lastTick:s.tick};}}
 for(const p of s.provinces)if(p.secondaryDeposit===undefined){const types:ResourceType[]=['grain','rice','fish','livestock','sugar','bauxite','limestone','rubber','silicon','lithium','chromium','tungsten'];const h=hash(`dominion21:${s.campaignSeed}:${p.id}`);p.secondaryDeposit={type:types[h%types.length]!,richness:30+(h>>>8)%61};}
 for(const c of Object.values(s.countries)){const v=c.stockpile;if(!v||![v.capacity,v.tradeRevenue,v.importExpense].every(n=>Number.isFinite(n)&&n>=0)||v.capacity>1e8||!Number.isSafeInteger(v.lastTick)||v.lastTick<0||v.lastTick>s.tick||typeof v.autoTrade!=='boolean'||typeof v.autoRepair!=='boolean'||!['Balanced','Civilian','Military'].includes(v.priority))throw Error('Invalid stockpile');for(const r of [v.amounts,v.produced,v.consumed,v.deficits])if(!r||Array.isArray(r)||Object.entries(r).some(([t,n])=>!Object.hasOwn(RESOURCES,t)||!Number.isFinite(n)||n<0||n>1e9))throw Error('Invalid resource ledger');}
 if(!Array.isArray(s.tradeContracts)||s.tradeContracts.length>600)throw Error('Invalid resource contracts');for(const c of s.tradeContracts)if(!s.countries[c.exporterId]||!s.countries[c.importerId]||c.exporterId===c.importerId||!Object.hasOwn(RESOURCES,c.resource)||![c.quantity,c.price,c.months,c.fulfilled,c.efficiency].every(n=>Number.isFinite(n)&&n>=0)||c.quantity>10000||c.months>120||c.efficiency>1||typeof c.accepted!=='boolean'||!Number.isSafeInteger(c.lastTick)||c.lastTick>s.tick)throw Error('Invalid resource contract');
}
export function extractResources(s:GameState):void{
 const started=new Set<string>();for(const c of Object.values(s.countries)){const v=c.stockpile!;if(v.lastTick===s.tick)continue;started.add(c.id);v.capacity=Math.max(stockpileCapacity(s,c.id),...Object.values(v.amounts).map(n=>n??0));v.produced={};v.consumed={};v.deficits={};v.tradeRevenue=0;v.importExpense=0;v.industrialIncome=0;v.lastTick=s.tick;}
 for(const p of s.provinces){if(!started.has(p.ownerId)||p.rebellion||(p.controllerId??p.ownerId)!==p.ownerId||!p.resourceDeposit)continue;const c=s.countries[p.ownerId]!,factor=(1+provinceBuildingModifiers(p).resourcePercent/100)*economicPolicy(c).production*espionageModifiers(s,c.id).productionMultiplier*(1+focusBonuses(c).production+technologyBonuses(c).production)*(1-(p.buildingDamage??0));
  for(const r of p.resourceMix??[{...p.resourceDeposit,weight:1}])addStock(c,r.type,provinceProduction({...p,income:p.income*r.weight,resourceDeposit:{type:r.type,richness:r.richness},resourceMix:undefined},c).units*factor,true);
  if(p.secondaryDeposit)addStock(c,p.secondaryDeposit.type,provinceProduction({...p,income:p.income*.3,resourceDeposit:p.secondaryDeposit,resourceMix:undefined},c).units*factor,true);
  if(p.buildings?.Farm)addStock(c,'grain',p.buildings.Farm*8*factor,true);
 }
}
export function domesticConsumption(s:GameState):void{
 for(const c of Object.values(s.countries)){const v=c.stockpile!,old=c.lastResourceCrisis??false;let food=c.population/2500000;
  for(const t of FOOD_RESOURCES){const used=Math.min(food,stock(c,t));if(used>0)consumeStock(c,t,used,true);food-=used;if(food<=.001)break;}if(food>.001){v.deficits.food=money(food);c.stability=Math.max(0,c.stability-Math.min(1,food/100));}
  const army=c.army/1000,war=s.wars?.some(w=>[...w.attackers,...w.defenders].includes(c.id));consumeStock(c,'ammunition',army*(war?.6:.08),true);consumeStock(c,'weapons',army*(war?.1:.02),true);
  const fuel=s.armies.filter(a=>a.ownerId===c.id).reduce((n,a)=>n+(a.composition?.Armor??0)*.0006+(a.composition?.Mechanized??0)*.0003+(a.composition?.Motorized??0)*.00025,0);if(fuel)consumeStock(c,'fuel',fuel,true);
  const crisis=Object.values(v.deficits).some(n=>n!>.5);c.lastResourceCrisis=crisis;if(crisis&&!old)notify(s,c.id,'Shortage','Ресурсный кризис: '+Object.keys(v.deficits).map(t=>RESOURCES[t as ResourceType].name).join(', '));if(!crisis&&old)notify(s,c.id,'Shortage','Снабжение и производство восстановлены');
 }
}
export function tradeEfficiency(s:GameState,a:string,b:string):number{if(warBetween(s,a,b))return 0;const link=s.diplomacy?.[pairKey(a,b)];if(!link?.treaties.some(t=>['TradeAgreement','Alliance','PoliticalUnion'].includes(t)))return 0;const provinces=s.provinces.filter(p=>[a,b].includes(p.ownerId)&&(p.controllerId??p.ownerId)===p.ownerId),ports=provinces.filter(p=>(p.buildings?.Port??0)>0),blocked=ports.some(p=>p.neighbors.some(id=>{const q=s.provinces.find(q=>q.id===id);return q&&warBetween(s,p.ownerId,q.controllerId??q.ownerId)&&s.armies.some(x=>x.provinceId===id&&x.ownerId===(q.controllerId??q.ownerId)&&x.troops>=10000);}));return blocked?.3:Math.min(1,.7+ports.length*.03);}
function transfer(s:GameState,from:string,to:string,t:ResourceType,quantity:number,price:number,efficiency:number):number{const seller=s.countries[from]!,buyer=s.countries[to]!,cash=Math.max(0,buyer.treasury-buyer.stockpile!.importExpense),room=buyer.stockpile!.capacity-stock(buyer,t);const delivered=money(Math.min(quantity*efficiency,stock(seller,t),cash/Math.max(.01,price),room));if(delivered<=0)return 0;consumeStock(seller,t,delivered);addStock(buyer,t,delivered);const cost=money(delivered*price);seller.stockpile!.tradeRevenue=money(seller.stockpile!.tradeRevenue+cost);buyer.stockpile!.importExpense=money(buyer.stockpile!.importExpense+cost);return delivered;}
export function processResourceTrade(s:GameState):void{
 for(const c of s.tradeContracts??[]){if(!c.accepted||c.lastTick===s.tick)continue;c.lastTick=s.tick;c.efficiency=tradeEfficiency(s,c.exporterId,c.importerId);c.fulfilled=transfer(s,c.exporterId,c.importerId,c.resource,c.quantity,c.price,c.efficiency);c.months--;}
 s.tradeContracts=s.tradeContracts?.filter(c=>c.months>0);
 // Bounded automatic purchases, only from consenting partners with surplus.
 const partners=new Map<string,string[]>();for(const l of Object.values(s.diplomacy??{}))if(l.treaties.some(t=>['TradeAgreement','Alliance','PoliticalUnion'].includes(t)))for(const [a,b] of [[l.a,l.b],[l.b,l.a]]){const rows=partners.get(a!)??[];rows.push(b!);partners.set(a!,rows);}
 for(const c of Object.values(s.countries)){if(!c.stockpile!.autoTrade)continue;for(const t of ['food','ammunition','fuel','steel','cement'] as ResourceType[]){const desired=t==='food'?Math.max(30,c.population/1e6):t==='ammunition'?Math.max(20,c.army/1000):30;if(stock(c,t)>=desired)continue;
  for(const partner of (partners.get(c.id)??[]).slice(0,6)){const seller=s.countries[partner]!;if(!seller.stockpile!.autoTrade)continue;const reserve=t==='food'?seller.population/1e6:30,surplus=stock(seller,t)-reserve;if(surplus>0)transfer(s,partner,c.id,t,Math.min(desired-stock(c,t),surplus),resourcePrice(s,t),tradeEfficiency(s,partner,c.id));if(stock(c,t)>=desired)break;}
 }}
}
export function updateResourceMarkets(s:GameState):void{
 s.resourcePrices??={};s.resourceLeaders??={};const countries=Object.values(s.countries);
 for(const t of RESOURCE_TYPES){let produced=0,demand=0;for(const c of countries){produced+=c.stockpile!.produced[t]??0;demand+=(c.stockpile!.consumed[t]??0)+(c.stockpile!.deficits[t]??0);}const target=RESOURCES[t].price*Math.max(.5,Math.min(2.5,1+(demand-produced)/Math.max(50,produced)*.3));s.resourcePrices[t]=money(resourcePrice(s,t)*.8+target*.2);s.resourceLeaders[t]=countries.filter(c=>(c.stockpile!.produced[t]??0)>0).sort((a,b)=>(b.stockpile!.produced[t]??0)-(a.stockpile!.produced[t]??0)).slice(0,3).map(c=>c.id);}
}
export function offerResourceTrade(s:GameState,owner:string,target:string,t:ResourceType,quantity:number,mode:'Import'|'Export'):void{
 if(!s.countries[target]||owner===target||tradeEfficiency(s,owner,target)<=0)throw Error('Нужен торговый договор с мирным партнёром');if((s.tradeContracts??[]).filter(c=>c.offeredBy===owner).length>=12)throw Error('Лимит торговых предложений');const exporter=mode==='Export'?owner:target,importer=mode==='Import'?owner:target;const seq=s.nextEntityId!;s.nextEntityId=seq+1;s.tradeContracts!.push({id:'trade-'+seq,exporterId:exporter,importerId:importer,offeredBy:owner,resource:t,quantity,price:resourcePrice(s,t),months:24,accepted:!s.players.some(p=>p.countryId===target&&!p.aiControlled)&&stock(s.countries[exporter]!,t)>=quantity*.5,lastTick:s.tick,fulfilled:0,efficiency:0});notify(s,target,'Diplomacy','Предложен ресурсный контракт: '+RESOURCES[t].name);}
export function resourceCombatFactor(c:Country):number{const deficits=c.stockpile?.deficits;if(!deficits)return 1;return 1-(deficits.ammunition?.25:0)-(deficits.weapons?.1:0);}
export function secondaryOutput(p:Province):ResourceType|undefined{return p.secondaryDeposit?.type;}
