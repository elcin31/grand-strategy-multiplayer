import {hasTechnology,unlockTechnology,technologyBonuses} from './technologyTree.ts';
import type {Country,GameState,Province,BuildingType} from './gameTypes.ts';
import type {ResourceType} from './resourceCatalogue.ts';
import {RESOURCES} from './resourceCatalogue.ts';
import {stock,addStock,consumeStock,materialReason,payMaterials,type ResourceLedger} from './stockpileSystem.ts';
import {economicPolicy} from './economy2System.ts';
import {espionageModifiers} from './espionageSystem.ts';
import {focusBonuses} from './focusCatalogue.ts';
import {money} from './economySystem.ts';
import type {UnitType} from './unitCatalogue.ts';
export interface ProductionRecipe {name:string;output:ResourceType;inputs:ResourceLedger;buildings:BuildingType[];baseOutput:number;energy:number;year:number;level:number;military:boolean;technology?:string}
const r=(name:string,output:ResourceType,inputs:ResourceLedger,buildings:BuildingType[],baseOutput:number,energy=0,year=1800,level=1,military=false):ProductionRecipe=>({name,output,inputs,buildings,baseOutput,energy,year,level,military});
export const PRODUCTION_RECIPES={
 food:r('Переработка продовольствия','food',{grain:1,livestock:.2},['FoodProcessor'],30,0,1700,0),
 steel:r('Выплавка стали','steel',{iron:1,coal:.7},['Steelworks','Factory'],18,1,1850),
 aluminium:r('Электролиз алюминия','aluminium',{bauxite:1.5},['Steelworks'],16,2,1900,2),
 cement:r('Обжиг цемента','cement',{limestone:1.2,coal:.4},['Quarry','Factory'],25,0,1850),
 fuel:r('Переработка нефти','fuel',{oil:1.2},['Refinery'],24,1,1900,2),
 chemicals:r('Основная химия','chemicals',{coal:.6,oil:.6},['ChemicalPlant'],20,1,1900,2),
 plastics:r('Полимерные материалы','plastics',{chemicals:.7,oil:.5},['ChemicalPlant'],22,1,1940,3),
 textile:r('Производство тканей','textile',{livestock:.25,chemicals:.15},['TextileMill','Factory'],25,0,1700),
 electronics:r('Электронные устройства','electronics',{silicon:.8,copper:.6,plastics:.3},['ElectronicsPlant'],14,2,1950,3),
 semiconductors:r('Полупроводниковые компоненты','semiconductors',{silicon:1,chemicals:.8},['ElectronicsPlant'],10,3,1970,4),
 batteries:r('Накопители энергии','batteries',{lithium:.7,copper:.4,chemicals:.6},['ElectronicsPlant','ChemicalPlant'],12,2,1980,4),
 medicine:r('Фармацевтическая продукция','medicine',{chemicals:.8,sugar:.3},['ChemicalPlant','Laboratory'],15,1,1900,2),
 weapons:r('Стрелковое вооружение','weapons',{steel:.8,timber:.25},['ArmsFactory','Machinery'],20,1,1600,1,true),
 ammunition:r('Боеприпасы','ammunition',{steel:.4,chemicals:.6},['AmmoFactory','ArmsFactory'],30,1,1600,1,true),
 militaryVehicles:r('Оснащение военной техники','weapons',{steel:1.3,rubber:.5,fuel:.3},['VehicleFactory'],30,2,1920,3,true),
} as const;
export type RecipeId=keyof typeof PRODUCTION_RECIPES;
export interface ProductionOrder {id:string;buildingType:BuildingType;recipeId:RecipeId;quantity:number;produced:number}
export interface ProductionResult {buildingType:BuildingType;recipeId:RecipeId;output:number;efficiency:number;reason?:string}
export function recipeReason(s:GameState,c:Country,p:Province,buildingType:BuildingType,id:RecipeId):string|null{const r=PRODUCTION_RECIPES[id],unlock=unlockTechnology('recipes',id);if(unlock&&!hasTechnology(c,unlock))return 'Нужно исследование: '+unlock;if(p.ownerId!==c.id||(p.controllerId??p.ownerId)!==c.id||p.rebellion)return 'Нужна своя контролируемая провинция';if(!(p.buildings?.[buildingType]??0)||!r.buildings.includes(buildingType))return 'Нужное предприятие отсутствует';if(s.year<r.year||(c.technologies?.Industry??0)<r.level)return 'Требуется промышленная технология и соответствующая эпоха';return null;}
export function productionCapacity(s:GameState,c:Country,p:Province,t:BuildingType,id:RecipeId):number{const r=PRODUCTION_RECIPES[id],priority=c.stockpile?.priority,allocation=priority==='Balanced'?1:priority==='Military'?r.military?1.25:.75:r.military?.75:1.25;
 return r.baseOutput*(p.buildings?.[t]??0)*(1-(p.buildingDamage??0))*(1+(p.development??40)/500)*economicPolicy(c).production*espionageModifiers(s,c.id).productionMultiplier*(1+focusBonuses(c).production)*allocation*(p.specialization==='Industry'?1.1:1)*(1+technologyBonuses(c).production)*(1-(c.warExhaustion??0)/300);}
export function monthlyProduction(s:GameState):void{
 const energy=new Map<string,number>();for(const p of s.provinces)if((p.controllerId??p.ownerId)===p.ownerId&&!p.rebellion)energy.set(p.ownerId,(energy.get(p.ownerId)??0)+30+(p.buildings?.PowerGrid??0)*120+(p.buildings?.Infrastructure??0)*10);
 for(const p of s.provinces){if(p.lastProductionTick===s.tick)continue;p.lastProductionTick=s.tick;p.productionResults=[];if(p.rebellion||(p.controllerId??p.ownerId)!==p.ownerId)continue;const c=s.countries[p.ownerId]!;
  const choices=Object.entries(p.buildings??{}).filter(([,level])=>level!>0).map(([type])=>type as BuildingType).sort((a,b)=>Number(['ArmsFactory','AmmoFactory','VehicleFactory'].includes(b))-Number(['ArmsFactory','AmmoFactory','VehicleFactory'].includes(a)));
  for(const type of choices){const order=p.productionQueue?.find(q=>q.buildingType===type),id=order?.recipeId??p.factoryAssignments?.[type]??(Object.keys(PRODUCTION_RECIPES) as RecipeId[]).find(id=>PRODUCTION_RECIPES[id].buildings.includes(type));if(!id)continue;const recipe=PRODUCTION_RECIPES[id],requirement=recipeReason(s,c,p,type,id);if(requirement){p.productionResults.push({buildingType:type,recipeId:id,output:0,efficiency:0,reason:requirement});continue;}
   const capacity=productionCapacity(s,c,p,type,id);let amount=Math.min(capacity,c.stockpile!.capacity-stock(c,recipe.output),order?order.quantity-order.produced:Infinity),limiting:string|undefined;
   for(const [t,qty] of Object.entries(recipe.inputs)){const possible=stock(c,t as ResourceType)/qty!;if(possible<amount){amount=possible;limiting=RESOURCES[t as ResourceType].name;c.stockpile!.deficits[t as ResourceType]=money(Math.max(c.stockpile!.deficits[t as ResourceType]??0,capacity*qty!-stock(c,t as ResourceType)));}}
   if(recipe.energy&&(energy.get(c.id)??0)/recipe.energy<amount){amount=(energy.get(c.id)??0)/recipe.energy;limiting='Энергия';}
   amount=Math.floor(Math.max(0,amount)*1000)/1000;for(const [t,qty] of Object.entries(recipe.inputs))consumeStock(c,t as ResourceType,money(amount*qty!));energy.set(c.id,Math.max(0,(energy.get(c.id)??0)-amount*recipe.energy));const output=addStock(c,recipe.output,amount,true);
   c.stockpile!.industrialIncome=money((c.stockpile!.industrialIncome??0)+output*RESOURCES[recipe.output].price*.3);p.productionResults.push({buildingType:type,recipeId:id,output,efficiency:capacity?Math.min(1,output/capacity):0,...limiting?{reason:'Не хватает: '+limiting}:{}});
   if(order){order.produced=money(order.produced+output);if(order.produced+1e-6>=order.quantity)p.productionQueue=p.productionQueue?.filter(q=>q.id!==order.id);}
  }
  const factor=1-(p.buildingDamage??0);if(p.buildings?.Ranch)addStock(c,'livestock',p.buildings.Ranch*10*factor,true);if(p.buildings?.Fishery)addStock(c,'fish',p.buildings.Fishery*12*factor,true);
  for(const [type,resource] of [['IronMine','iron'],['CoalMine','coal'],['OilWell','oil'],['GasField','gas'],['Quarry','limestone']] as const)if(p.buildings?.[type])addStock(c,resource,p.buildings[type]!*8*factor,true);
  if(p.buildings?.RareMine&&p.secondaryDeposit)addStock(c,p.secondaryDeposit.type,p.buildings.RareMine*5*factor,true);
 }
}
export function equipmentMaterials(s:GameState,type:UnitType,troops:number):ResourceLedger{return {weapons:money(troops/1000*(type==='Armor'||type==='Mechanized'?1:.3)),ammunition:s.year>=1500?money(troops/1000*.15):0,...['Armor','Mechanized','Motorized'].includes(type)?{fuel:money(troops/1000*.2)}:{}};}
export function equipmentReason(s:GameState,c:Country,type:UnitType,troops:number):string|null{return materialReason(c,equipmentMaterials(s,type,troops));}
export function payEquipment(s:GameState,c:Country,type:UnitType,troops:number):void{payMaterials(c,equipmentMaterials(s,type,troops));}
export function initializeProduction(s:GameState):void{for(const p of s.provinces){if(p.factoryAssignments&&Object.entries(p.factoryAssignments).some(([b,r])=>!Object.hasOwn(PRODUCTION_RECIPES,r)||!PRODUCTION_RECIPES[r as RecipeId].buildings.includes(b as BuildingType)))throw Error('Invalid factory assignment');if(p.productionQueue&&(!Array.isArray(p.productionQueue)||p.productionQueue.length>8||p.productionQueue.some(q=>!Object.hasOwn(PRODUCTION_RECIPES,q.recipeId)||!PRODUCTION_RECIPES[q.recipeId].buildings.includes(q.buildingType)||!Number.isFinite(q.quantity)||q.quantity<=0||q.quantity>10000||!Number.isFinite(q.produced)||q.produced<0||q.produced>=q.quantity)))throw Error('Invalid production orders');}}
