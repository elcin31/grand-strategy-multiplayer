import {EXPANDED_BUILDINGS} from './buildingCatalogue.ts';
import {buildingMaterials,civilianConstructionSlots} from './construction3System.ts';
import {payMaterials,materialReason} from './stockpileSystem.ts';
import {focusBonuses} from './focusCatalogue.ts';
import {scienceLevel,hasTechnology,unlockTechnology,technologyBonuses} from './technologyTree.ts';
import {espionageModifiers} from './espionageSystem.ts';
import type { BuildingType, Construction, CountryId, GameState, Province } from './gameTypes.ts';
import {WATER_ACCESS} from './waterAccess.ts';
const capitalSites=new WeakMap<GameState,Set<string>>();

export interface BuildingModifiers {
  taxPercent: number;
  tradePercent: number;
  resourcePercent: number;
  manpowerPercent: number;
  researchPercent: number;
  defensePercent: number;
  populationGrowthPercent: number;
  stabilityPerYear: number;
  unrestPerYear: number;
}
export interface BuildingDefinition {
  category?:string;
  year?:number;
  branch?:import('./technologySystem.ts').TechnologyBranch;
  unlockLevel?:number;
  technology?:import('./technologyTree.ts').TechnologyId;
  materials?:import('./stockpileSystem.ts').ResourceLedger;
  depositTypes?:import('./resourceCatalogue.ts').ResourceType[];
  name: string;
  baseCost: number;
  baseBuildTime: number;
  maintenance: number;
  maxLevel: number;
  modifiers: Partial<BuildingModifiers>;
}
const zero = (): BuildingModifiers => ({ taxPercent: 0, tradePercent: 0, resourcePercent: 0, manpowerPercent: 0, researchPercent: 0, defensePercent: 0, populationGrowthPercent: 0, stabilityPerYear: 0, unrestPerYear: 0 });

/** Original game balance. Costs/bonuses are abstractions, not real-world estimates. */
export const BUILDINGS = {
  ...EXPANDED_BUILDINGS,
  Farm: { name: 'Ферма', baseCost: 120, baseBuildTime: 6, maintenance: 2, maxLevel: 5, modifiers: { populationGrowthPercent: 2, taxPercent: 1 } },
  Mine: { name: 'Шахта', baseCost: 180, baseBuildTime: 8, maintenance: 3, maxLevel: 5, modifiers: { resourcePercent: 8 } },
  Factory: { name: 'Фабрика', baseCost: 320, baseBuildTime: 12, maintenance: 7, maxLevel: 5, modifiers: { taxPercent: 3, tradePercent: 3 } },
  Barracks: { name: 'Казармы', baseCost: 220, baseBuildTime: 9, maintenance: 4, maxLevel: 5, modifiers: { manpowerPercent: 5 } },
  Fort: { name: 'Форт', baseCost: 260, baseBuildTime: 10, maintenance: 4, maxLevel: 5, modifiers: { defensePercent: 12 } },
  University: { name: 'Университет', baseCost: 400, baseBuildTime: 16, maintenance: 8, maxLevel: 5, modifiers: { researchPercent: 5 } },
  Port: { name: 'Порт', baseCost: 360, baseBuildTime: 14, maintenance: 7, maxLevel: 5, modifiers: { tradePercent: 6 } },
  Infrastructure: { name: 'Инфраструктура', baseCost: 280, baseBuildTime: 11, maintenance: 5, maxLevel: 5, modifiers: { taxPercent: 2, tradePercent: 2, resourcePercent: 2 } },
  Administration: { name: 'Администрация', baseCost: 240, baseBuildTime: 10, maintenance: 4, maxLevel: 5, modifiers: { taxPercent: 2, stabilityPerYear: .3 } },
  Hospital: { name: 'Госпиталь', baseCost: 300, baseBuildTime: 12, maintenance: 6, maxLevel: 5, modifiers: { populationGrowthPercent: 3, unrestPerYear: -.2 } },
} as Record<BuildingType,BuildingDefinition>;
export const BUILDING_TYPES = Object.keys(BUILDINGS) as BuildingType[];
/** Existing buildings survive migration/conquest; requirements govern only
 * new projects. Levels3–5 require the corresponding technological capability. */
export function buildingRequirementReason(s:GameState,p:Province,type:BuildingType,targetLevel=buildingLevel(p,type)+1):string|null {
  const c=s.countries[p.ownerId]!;
  const capability=unlockTechnology('buildings',type);if(capability&&!hasTechnology(c,capability))return 'Требуется исследование: '+capability;
  const def=BUILDINGS[type];if(s.year<(def.year??1000))return `Доступно с ${def.year} года`;if(def.depositTypes&&![...(p.resourceMix??(p.resourceDeposit?[p.resourceDeposit]:[])),...(p.secondaryDeposit?[p.secondaryDeposit]:[])].some(r=>def.depositTypes!.includes(r.type)))return 'Нужен подходящий ресурсный район';if((type==='Fishery'||type==='CargoPort'||type==='CoastalFort')&&!WATER_ACCESS.has(p.id))return 'Нужен выход к воде';
  const branch=def.branch??({Farm:'Economy',Mine:'Industry',Factory:'Industry',Barracks:'Military',Fort:'Military',University:'Administration',Port:'Diplomacy',Infrastructure:'Administration',Administration:'Administration',Hospital:'Administration'} as Partial<Record<BuildingType,import('./technologySystem.ts').TechnologyBranch>>)[type]??'Industry';
  if((c.technologies?.[branch]??0)<Math.max(def.unlockLevel??0,targetLevel-2))return `Требуется технология ${branch} уровня ${targetLevel-2}`;
  if(type==='Mine'&&!(p.resourceMix??(p.resourceDeposit?[p.resourceDeposit]:[])).some(r=>!['food','timber'].includes(r.type)))return 'Требуется минеральное месторождение';
  if(type==='Port'&&!WATER_ACCESS.has(p.id))return 'Нужен выход к воде на карте';
  if(type==='Port'&&buildingLevel(p,'Infrastructure')<1)return 'Требуется инфраструктура уровня 1';
  if((type==='University'||type==='Hospital')&&(p.development??40)<40){let sites=capitalSites.get(s);if(!sites){sites=new Set((s.cities??[]).filter(c=>c.isCapital).map(c=>c.provinceId));capitalSites.set(s,sites);}if(!sites.has(p.id))return 'Нужно развитие 40 или столица';}
  if(['Factory','Barracks','Fort'].includes(type)&&targetLevel>2&&buildingLevel(p,'Infrastructure')<targetLevel-2)return `Требуется инфраструктура уровня ${targetLevel-2}`;
  return null;
}

const precise = (value: number): number => {
  if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER / 1000) throw new Error('Building money overflow');
  return Math.round(value * 1000) / 1000;
};
export function buildingLevel(province: Province, type: BuildingType): number {
  const level = province.buildings?.[type] ?? 0;
  if (!Number.isInteger(level) || level < 0 || level > BUILDINGS[type].maxLevel) throw new Error('Invalid building level');
  return level;
}
export function buildingQuote(province: Province, type: BuildingType): { targetLevel: number; cost: number; buildTime: number } {
  const current = buildingLevel(province, type), definition = BUILDINGS[type];
  if (current >= definition.maxLevel) throw new Error('Достигнут максимальный уровень здания');
  return { targetLevel: current + 1, cost: precise(definition.baseCost * (1 + current * .6)), buildTime: definition.baseBuildTime + current * 2 };
}
const EMPTY_MODIFIERS=Object.freeze(zero());
export function provinceBuildingModifiers(province: Province): BuildingModifiers {
  if(!province.buildings || Object.keys(province.buildings).length===0)return EMPTY_MODIFIERS;
  const result = zero();
  for (const type of BUILDING_TYPES) {
    const level = buildingLevel(province, type);
    if (!level) continue;
    for (const [key, value] of Object.entries(BUILDINGS[type].modifiers) as [keyof BuildingModifiers, number][]) result[key] += value * level*(1-(province.buildingDamage??0));
  }
  return result;
}
export function provinceBuildingMaintenance(province: Province): number {
  if(!province.buildings)return 0;
  let total = 0;
  for (const type of BUILDING_TYPES) total += buildingLevel(province, type) * BUILDINGS[type].maintenance;
  return precise(total);
}
export function buildingModifierTotals(state: GameState): Map<CountryId, BuildingModifiers> {
  const totals = new Map<CountryId, BuildingModifiers>();
  for (const province of state.provinces) {
    if (!province.buildings || province.rebellion || (province.controllerId ?? province.ownerId) !== province.ownerId) continue;
    const source = provinceBuildingModifiers(province), target = totals.get(province.ownerId) ?? zero();
    for (const key of Object.keys(source) as (keyof BuildingModifiers)[]) target[key] += source[key];
    totals.set(province.ownerId, target);
  }
  return totals;
}
function validateBuildingMap(province: Province): void {
  if (province.buildings === undefined) return;
  if (!province.buildings || typeof province.buildings !== 'object' || Array.isArray(province.buildings)) throw new Error('Invalid province buildings');
  for (const [key, value] of Object.entries(province.buildings)) {
    if (!Object.hasOwn(BUILDINGS, key) || !Number.isInteger(value) || Number(value) < 1 || Number(value) > BUILDINGS[key as BuildingType].maxLevel) throw new Error('Invalid province building');
  }
}
function validateConstruction(state: GameState, construction: Construction): void {
  if (!construction || typeof construction !== 'object' || !/^[A-Za-z0-9_-]{1,256}$/.test(construction.id)) throw new Error('Invalid construction');
  if (!Object.hasOwn(BUILDINGS, construction.buildingType)) throw new Error('Invalid construction building');
  const province = state.provinces.find(p => p.id === construction.provinceId);
  if (!province || !state.countries[construction.ownerId] || province.ownerId !== construction.ownerId) throw new Error('Invalid construction owner');
  const quote = buildingQuote(province, construction.buildingType);
  if (construction.targetLevel !== quote.targetLevel || construction.cost !== quote.cost) throw new Error('Invalid construction quote');
  if (!Number.isSafeInteger(construction.startedTick) || !Number.isSafeInteger(construction.completeTick) || construction.startedTick < 0 || construction.startedTick > state.tick || construction.completeTick !== construction.startedTick + quote.buildTime) throw new Error('Invalid construction timing');
  // Industry(10%), science(5%) and bounded course rewards(35%) can earn at
  // most1.5 work units per elapsed month. Delayed jobs may pass their quote's
  // date, but a save cannot invent completed work or future work ticks.
  if(construction.workDone!==undefined||construction.workTick!==undefined){if(!Number.isFinite(construction.workDone)||construction.workDone!<0||construction.workDone!>=quote.buildTime||!Number.isSafeInteger(construction.workTick)||construction.workTick!<construction.startedTick||construction.workTick!>state.tick||construction.workDone!>(construction.workTick!-construction.startedTick)*2+1e-9)throw Error('Invalid construction progress');}
}
/** Modern save migration/validation. Missing building maps stay sparse to avoid inflating 4k-province snapshots. */
export function initializeBuildings(state: GameState): void {
  if (!state.dataset) return;
  for (const province of state.provinces) validateBuildingMap(province);
  state.constructions ??= [];
  if (!Array.isArray(state.constructions)) throw new Error('Invalid construction queue');
  const ids = new Set<string>(), provinces = new Set<string>();
  for (const construction of state.constructions) {
    validateConstruction(state, construction);
    if (ids.has(construction.id) || provinces.has(construction.provinceId)) throw new Error('Duplicate construction');
    ids.add(construction.id); provinces.add(construction.provinceId);
  }
}
export function startConstruction(state: GameState, ownerId: CountryId, province: Province, buildingType: BuildingType): Construction {
  if (!state.dataset) throw new Error('Строительство доступно в кампании современного мира');
  if (province.rebellion || province.ownerId !== ownerId || (province.controllerId ?? province.ownerId) !== ownerId) throw new Error('Нельзя строить в чужой провинции');
  if (state.constructions!.some(item => item.provinceId === province.id)||state.constructionQueue?.some(item=>item.provinceId===province.id)) throw new Error('В провинции уже идёт строительство');
  const nation = state.countries[ownerId];
  if (!nation) throw new Error('Страна не найдена');
  if(state.constructions!.filter(q=>q.ownerId===ownerId).length>=civilianConstructionSlots(state,state.countries[ownerId]!))throw Error('Строительные мощности заняты; добавьте в очередь');
  const quote = buildingQuote(province, buildingType);
  const reason=buildingRequirementReason(state,province,buildingType,quote.targetLevel);if(reason)throw Error(reason);
  if(state.tick<(nation.bankruptcyUntilTick??0))throw Error('Строительство недоступно после банкротства');
  if(!Number.isSafeInteger(state.tick+quote.buildTime))throw Error('Construction date overflow');
  if (nation.treasury < quote.cost) throw new Error('Недостаточно средств для строительства');
  const materials=buildingMaterials(buildingType,quote.targetLevel,state.year),missing=materialReason(nation,materials);if(missing)throw Error(missing);payMaterials(nation,materials);
  if (state.nextEntityId === undefined) state.nextEntityId = 1;
  if (!Number.isSafeInteger(state.nextEntityId) || state.nextEntityId < 1 || state.nextEntityId >= Number.MAX_SAFE_INTEGER) throw new Error('Entity sequence exhausted');
  const id = `construction-${state.id}-${state.nextEntityId++}`;
  const construction: Construction = { materials,id, provinceId: province.id, ownerId, buildingType, targetLevel: quote.targetLevel, startedTick: state.tick, completeTick: state.tick + quote.buildTime, cost: quote.cost };
  nation.treasury = precise(nation.treasury - quote.cost);
  state.constructions!.push(construction);
  return construction;
}
export function cancelConstructionInProvince(state: GameState, provinceId: string): void {
  if (!state.dataset) return;
  if(state.constructionQueue?.length)state.constructionQueue=state.constructionQueue.filter(item=>item.provinceId!==provinceId);
  if(state.constructions?.length)state.constructions = state.constructions.filter(item => item.provinceId !== provinceId);
}
function constructionRate(state:GameState,ownerId:CountryId):number {
  const c=state.countries[ownerId]!;
  return (1+(c.technologies?.Industry??0)*.02+scienceLevel(c)*.01+focusBonuses(c).construction+technologyBonuses(c).construction)*espionageModifiers(state,ownerId).productionMultiplier;
}
export function constructionProgress(state:GameState,job:Construction):{percent:number;months:number}{
  const duration=job.completeTick-job.startedTick,done=job.workDone??state.tick-job.startedTick,rate=constructionRate(state,job.ownerId);
  return {percent:Math.min(100,Math.round(100*done/duration)),months:Math.max(0,Math.ceil((duration-done)/rate))};
}
export function completeConstructions(state: GameState): void {
  if (!state.dataset || !state.constructions?.length) return;
  const remaining: Construction[] = [];
  for (const construction of state.constructions) {
    const site=state.provinces.find(p=>p.id===construction.provinceId);if(site&&(site.controllerId??site.ownerId)!==construction.ownerId){construction.workDone??=Math.max(0,state.tick-construction.startedTick-1);construction.workTick=state.tick;remaining.push(construction);continue;}
    const rate=constructionRate(state,construction.ownerId);
    if(rate!==1||construction.workDone!==undefined){
      // Old paid jobs retain their quoted duration. A newly opened capability
      // changes work from this month onwards; previous work is never credited
      // twice. Sabotage's dated modifier uses the same indexed country effects
      // as production and supply, without a construction × mission scan.
      construction.workDone??=Math.max(0,state.tick-construction.startedTick-1);
      construction.workTick??=Math.max(construction.startedTick,state.tick-1);
      construction.workDone+=(state.tick-construction.workTick)*rate;construction.workTick=state.tick;
    }
    const unfinished=construction.workDone===undefined?construction.completeTick>state.tick:construction.workDone+1e-9<construction.completeTick-construction.startedTick;
    if (unfinished) { remaining.push(construction); continue; }
    const province = state.provinces.find(p => p.id === construction.provinceId);
    if (!province || province.rebellion || province.ownerId !== construction.ownerId || (province.controllerId ?? province.ownerId) !== construction.ownerId) continue;
    const current = buildingLevel(province, construction.buildingType);
    if (current + 1 !== construction.targetLevel) throw new Error('Construction target changed');
    province.buildings = { ...(province.buildings ?? {}), [construction.buildingType]: construction.targetLevel };
  }
  state.constructions = remaining;
}
