import type {Army,BuildingType,GameState,Province} from '../types/game';
import {contains,overlaps,type Bounds,type MapFeature,type Point} from './geometry';
import type {MapScene} from './worldScene';
import {armyETA} from '../../supabase/functions/_shared/military3System';
import {RESOURCES,type ResourceType} from '../../supabase/functions/_shared/resourceCatalogue';
import {BUILDINGS} from '../../supabase/functions/_shared/buildingSystem';
import {GRAPHICS,type GraphicsPreset} from './settings';
export type EconomicFilter='Resources'|'Industry'|'Trade'|'Infrastructure'|'Development'|'Production';
export const ECONOMIC_FILTERS:Record<EconomicFilter,string>={Resources:'Ресурсы',Industry:'Промышленность',Trade:'Торговля',Infrastructure:'Инфраструктура',Development:'Развитие',Production:'Производство'};
export interface Installation {id:string;provinceId:string;point:Point;kind:string;label:string;level:number;color:string;resource?:ResourceType}
export function resourceSymbol(type:ResourceType):string {
  if(['oil','fuel','plastics'].includes(type))return'oil';if(type==='gas')return'gas';if(type==='timber'||type==='rubber')return'forest';
  if(type==='gold')return'gold';if(type==='coal')return'coal';if(type==='fish')return'fish';
  if(RESOURCES[type].group==='Food')return'grain';if(['uranium','rare_materials','lithium'].includes(type))return'crystal';
  if(RESOURCES[type].group==='Military')return'arms';if(RESOURCES[type].group==='Advanced')return'chip';
  return RESOURCES[type].group==='Industrial'?'factory':'ore';
}
export function buildingSymbol(type:BuildingType,year:number):string {
  if(['Port','CargoPort','Fishery'].includes(type))return'port';if(['Fort','CoastalFort'].includes(type))return'fort';
  if(['University','ResearchCenter','Administration','Laboratory','Embassy','Hospital'].includes(type))return'academy';
  if(['Infrastructure','TransportTerminal','Warehouse','MilitaryDepot'].includes(type))return'road';
  if(type==='RailHub')return'rail';if(type==='OilWell'||type==='GasField')return'rig';
  if(type==='Farm'||type==='Ranch')return'field';if(type.includes('Mine')||type==='Quarry')return'mine';
  if(['Barracks','MilitaryBase','IntelligenceCenter'].includes(type))return'fort';
  return year<1800?'workshop':'factory';
}
const INDUSTRY=new Set<BuildingType>(['Factory','Steelworks','Refinery','ChemicalPlant','TextileMill','Machinery','ElectronicsPlant','ArmsFactory','AmmoFactory','VehicleFactory','FoodProcessor','PowerGrid']);
const INFRA=new Set<BuildingType>(['Port','CargoPort','Infrastructure','RailHub','TransportTerminal','Warehouse','MilitaryDepot','PowerGrid']);
/** Positions are stable provincial indicators and always fall on their province.
 * No invented settlement/building/resource data is used. */
function position(f:MapFeature,index:number,zoom:number):Point {
  if(index===0)return f.anchor;
  const angle=index*2.39996323,radius=(12+index*3)/zoom;
  const p={x:f.anchor.x+Math.cos(angle)*radius,y:f.anchor.y+Math.sin(angle)*radius};
  return contains(f,p)?p:f.anchor;
}
export function provinceInstallations(state:GameState,scene:MapScene,visible:ReadonlySet<string>,zoom:number,preset:GraphicsPreset,filter:EconomicFilter|'Province',selected?:string|null):Installation[]{
  const budget=GRAPHICS[preset].objectBudget;
  if(zoom<1.6||filter==='Trade'||filter==='Development')return[];
  const rows:Installation[]=[];
  const provinces=state.provinces.filter(p=>visible.has(p.id)).sort((a,b)=>Number(b.id===selected)-Number(a.id===selected)||(b.development??40)-(a.development??40)||b.income-a.income||a.id.localeCompare(b.id));
  for(const p of provinces){
    const f=scene.provinceGeometry.get(p.id);if(!f)continue;let index=0;
    if(filter==='Resources'||filter==='Province'){
      const deposits=[...(p.resourceMix??(p.resourceDeposit?[p.resourceDeposit]:[])),...(zoom>=7&&p.secondaryDeposit?[p.secondaryDeposit]:[])];
      for(const [i,r]of deposits.slice(0,zoom>=7?3:1).entries())rows.push({id:p.id+'-resource-'+i,provinceId:p.id,point:position(f,index++,zoom),kind:resourceSymbol(r.type),label:RESOURCES[r.type].name,level:r.richness,color:RESOURCES[r.type].color,resource:r.type});
    }
    if(filter!=='Resources')for(const [type,level]of Object.entries(p.buildings??{}) as [BuildingType,number][]){
      if(level<=0||(BUILDINGS[type].year??1000)>state.year)continue;
      if(filter==='Industry'&&!INDUSTRY.has(type)||filter==='Infrastructure'&&!INFRA.has(type)||filter==='Production'&&!p.factoryAssignments?.[type]&&!p.productionResults?.some(r=>r.buildingType===type)&&!p.productionQueue?.some(r=>r.buildingType===type)||filter==='Province'&&zoom<6)continue;
      rows.push({id:p.id+'-'+type,provinceId:p.id,point:position(f,index++,zoom),kind:buildingSymbol(type,state.year),label:BUILDINGS[type].name,level,color:INDUSTRY.has(type)?'#c78154':INFRA.has(type)?'#69b8c8':'#d9bd7a'});
      if(index>=(p.id===selected?8:zoom>=9?4:2))break;
    }
    if(rows.length>=budget)break;
  }
  return rows.slice(0,budget);
}
export interface TradeLink {id:string;from:Point;to:Point;resource:ResourceType;quantity:number;fulfilled:number;efficiency:number}
/** The economy stores contracts, not maritime/land transport paths. */
export function tradeLinks(state:GameState,scene:MapScene,bounds:Bounds):TradeLink[]{
  const capitals=new Map(scene.cities.map(c=>[c.id,c.point]));
  return (state.tradeContracts??[]).filter(c=>c.accepted&&c.months>0).flatMap(c=>{
    const from=capitals.get(state.countries[c.exporterId]?.capitalCityId??''),to=capitals.get(state.countries[c.importerId]?.capitalCityId??'');
    if(!from||!to||Math.abs(from.x-to.x)>720)return[];
    const b={left:Math.min(from.x,to.x),right:Math.max(from.x,to.x),top:Math.min(from.y,to.y)-40,bottom:Math.max(from.y,to.y)+40};
    return overlaps(b,bounds)?[{id:c.id,from,to,resource:c.resource,quantity:c.quantity,fulfilled:c.fulfilled,efficiency:c.efficiency}]:[];
  }).slice(0,32);
}
export interface MapOrder {id:string;ownerId:string;points:Point[];target:Point;attack:boolean;redeploy:boolean;selected:boolean;eta:number;army:Army}
export function mapOrders(state:GameState,scene:MapScene,visible:ReadonlySet<string>,selected?:string|null,own?:string|null,budget=24):MapOrder[]{
  const rows=state.armies.filter(a=>a.order&&(visible.has(a.provinceId)||a.order.route.some(id=>visible.has(id))))
    .sort((a,b)=>Number(b.id===selected)-Number(a.id===selected)||Number(b.ownerId===own)-Number(a.ownerId===own)||b.troops-a.troops).slice(0,budget);
  return rows.flatMap(a=>{
    const points=[a.provinceId,...a.order!.route].map(id=>scene.provinceGeometry.get(id)?.anchor).filter((p):p is Point=>!!p);
    if(points.length<2)return[];
    return[{id:a.id,ownerId:a.ownerId,points,target:points.at(-1)!,attack:a.order!.type==='ATTACK',redeploy:!!a.order!.redeploy,selected:a.id===selected,eta:a.id===selected?armyETA(state,a):0,army:a}];
  });
}
/** Schematic local infrastructure links between existing cities only. */
export function localInfrastructure(state:GameState,scene:MapScene,visible:ReadonlySet<string>,zoom:number){
  if(zoom<6)return[];
  const result:{from:Point;to:Point;rail:boolean}[]=[];
  const cityGroups=new Map<string,Point[]>();for(const c of scene.cities)if(visible.has(c.provinceId)){const a=cityGroups.get(c.provinceId)??[];a.push(c.point);cityGroups.set(c.provinceId,a);}
  for(const p of state.provinces){
    if(!visible.has(p.id)||!(p.buildings?.Infrastructure??0))continue;
    const f=scene.provinceGeometry.get(p.id),cities=cityGroups.get(p.id);if(!f||!cities)continue;
    for(const to of cities.slice(1,5)){const from=cities[0]!;if(Array.from({length:9},(_,i)=>({x:from.x+(to.x-from.x)*i/8,y:from.y+(to.y-from.y)*i/8})).every(q=>contains(f,q)))result.push({from,to,rail:state.year>=(BUILDINGS.RailHub.year??1800)&&(p.buildings?.RailHub??0)>0});}
  }
  return result.slice(0,40);
}
export function provinceResources(p:Province){return [...(p.resourceMix??(p.resourceDeposit?[p.resourceDeposit]:[])),...(p.secondaryDeposit?[p.secondaryDeposit]:[])];}
