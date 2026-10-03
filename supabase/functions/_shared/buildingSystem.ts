import type { BuildingType, Construction, CountryId, GameState, Province } from './gameTypes.ts';

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
  name: string;
  baseCost: number;
  baseBuildTime: number;
  maintenance: number;
  maxLevel: number;
  modifiers: Partial<BuildingModifiers>;
}
const zero = (): BuildingModifiers => ({ taxPercent: 0, tradePercent: 0, resourcePercent: 0, manpowerPercent: 0, researchPercent: 0, defensePercent: 0, populationGrowthPercent: 0, stabilityPerYear: 0, unrestPerYear: 0 });

/** Original game balance. Costs/bonuses are abstractions, not real-world estimates. */
export const BUILDINGS: Record<BuildingType, BuildingDefinition> = {
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
};
export const BUILDING_TYPES = Object.keys(BUILDINGS) as BuildingType[];

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
export function provinceBuildingModifiers(province: Province): BuildingModifiers {
  const result = zero();
  for (const type of BUILDING_TYPES) {
    const level = buildingLevel(province, type);
    if (!level) continue;
    for (const [key, value] of Object.entries(BUILDINGS[type].modifiers) as [keyof BuildingModifiers, number][]) result[key] += value * level;
  }
  return result;
}
export function provinceBuildingMaintenance(province: Province): number {
  let total = 0;
  for (const type of BUILDING_TYPES) total += buildingLevel(province, type) * BUILDINGS[type].maintenance;
  return precise(total);
}
export function buildingModifierTotals(state: GameState): Map<CountryId, BuildingModifiers> {
  const totals = new Map<CountryId, BuildingModifiers>();
  for (const province of state.provinces) {
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
  if (!Number.isSafeInteger(construction.startedTick) || !Number.isSafeInteger(construction.completeTick) || construction.startedTick < 0 || construction.completeTick !== construction.startedTick + quote.buildTime) throw new Error('Invalid construction timing');
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
  if (province.ownerId !== ownerId) throw new Error('Нельзя строить в чужой провинции');
  if (state.constructions!.some(item => item.provinceId === province.id)) throw new Error('В провинции уже идёт строительство');
  const nation = state.countries[ownerId];
  if (!nation) throw new Error('Страна не найдена');
  const quote = buildingQuote(province, buildingType);
  if (nation.treasury < quote.cost) throw new Error('Недостаточно средств для строительства');
  if (state.nextEntityId === undefined) state.nextEntityId = 1;
  if (!Number.isSafeInteger(state.nextEntityId) || state.nextEntityId < 1 || state.nextEntityId >= Number.MAX_SAFE_INTEGER) throw new Error('Entity sequence exhausted');
  const id = `construction-${state.id}-${state.nextEntityId++}`;
  const construction: Construction = { id, provinceId: province.id, ownerId, buildingType, targetLevel: quote.targetLevel, startedTick: state.tick, completeTick: state.tick + quote.buildTime, cost: quote.cost };
  nation.treasury = precise(nation.treasury - quote.cost);
  state.constructions!.push(construction);
  return construction;
}
export function cancelConstructionInProvince(state: GameState, provinceId: string): void {
  if (!state.dataset || !state.constructions?.length) return;
  state.constructions = state.constructions.filter(item => item.provinceId !== provinceId);
}
export function completeConstructions(state: GameState): void {
  if (!state.dataset || !state.constructions?.length) return;
  const remaining: Construction[] = [];
  for (const construction of state.constructions) {
    if (construction.completeTick > state.tick) { remaining.push(construction); continue; }
    const province = state.provinces.find(p => p.id === construction.provinceId);
    if (!province || province.ownerId !== construction.ownerId) continue;
    const current = buildingLevel(province, construction.buildingType);
    if (current + 1 !== construction.targetLevel) throw new Error('Construction target changed');
    province.buildings = { ...(province.buildings ?? {}), [construction.buildingType]: construction.targetLevel };
  }
  state.constructions = remaining;
}
