import type { Country, GameState, Province } from './gameTypes.ts';

/** Original scenario deposits/prices, not real geological or market data. */
export const RESOURCES = {
  food: { name: 'Продовольствие', color: '#87A66B', price: .08 },
  iron: { name: 'Железо', color: '#A37D70', price: .12 },
  coal: { name: 'Уголь', color: '#657080', price: .10 },
  oil: { name: 'Нефть', color: '#9A7DA8', price: .20 },
  gas: { name: 'Газ', color: '#70AFC0', price: .16 },
  gold: { name: 'Золото', color: '#D1AF59', price: .35 },
  copper: { name: 'Медь', color: '#CB9062', price: .14 },
  uranium: { name: 'Уран', color: '#ADD16D', price: .25 },
  timber: { name: 'Древесина', color: '#5F9987', price: .09 },
  rare_materials: { name: 'Редкие материалы', color: '#B995C2', price: .28 },
} as const;
export type ResourceType = keyof typeof RESOURCES;
export interface ResourceDeposit { type: ResourceType; richness: number }
export const RESOURCE_TYPES = Object.keys(RESOURCES) as ResourceType[];
const distribution: ResourceType[] = ['food','food','food','timber','timber','iron','iron','coal','oil','gas','copper','gold','uranium','rare_materials'];
function hash(value: string): number {
  let result = 2166136261;
  for (let i = 0; i < value.length; i++) result = Math.imul(result ^ value.charCodeAt(i), 16777619);
  return result >>> 0;
}
export function initialDeposit(provinceId: string, seed: number): ResourceDeposit {
  const value = hash(`resources-v1:${seed}:${provinceId}`);
  return { type: distribution[value % distribution.length]!, richness: 40 + (value >>> 8) % 61 };
}
export function assertDeposit(value: unknown): asserts value is ResourceDeposit {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid resource deposit');
  const v = value as Record<string, unknown>;
  if (Object.keys(v).length !== 2 || typeof v.type !== 'string' || !Object.hasOwn(RESOURCES, v.type) || !Number.isInteger(v.richness) || Number(v.richness) < 1 || Number(v.richness) > 100) throw new Error('Invalid resource deposit');
}
/** Initialize only absent fields; existing saves keep their deposits after conquest. */
export function initializeResources(state: GameState): void {
  if (!state.dataset) return;
  if (!Number.isSafeInteger(state.campaignSeed) || state.campaignSeed! < 0) throw new Error('Invalid resource campaign seed');
  for (const p of state.provinces) {
    if (p.resourceDeposit === undefined) p.resourceDeposit = initialDeposit(p.id, state.campaignSeed!);
    assertDeposit(p.resourceDeposit);
  }
}
/** Production is automatically sold each month. Units and fixed prices are game abstractions. */
export function provinceProduction(p: Province, country: Country): { units: number; revenue: number } {
  if (!p.resourceDeposit) return { units: 0, revenue: 0 }; // legacy scenarios
  assertDeposit(p.resourceDeposit);
  const development = p.development ?? 40, unrest = p.unrest ?? 0;
  if (![development, unrest, country.technology].every(n => Number.isFinite(n) && n >= 0 && n <= 100) || !Number.isFinite(p.income) || p.income < 0) throw new Error('Invalid resource production inputs');
  // Province base output is stable; ownership controls recipient, not the deposit.
  const units = Math.round(p.income * p.resourceDeposit.richness / 100 * (.5 + development / 100) * (.5 + country.technology / 100) * (1 - unrest / 200) * 1000) / 1000;
  const revenue = Math.round(units * RESOURCES[p.resourceDeposit.type].price * 1000) / 1000;
  if (![units, revenue].every(n => Number.isFinite(n) && n >= 0 && n <= Number.MAX_SAFE_INTEGER / 1000)) throw new Error('Resource production overflow');
  return { units, revenue };
}
export function resourceReport(state: GameState, countryId: string): { type: ResourceType; units: number; revenue: number }[] {
  const country = state.countries[countryId];
  if (!country || country.id !== countryId) throw new Error('Unknown resource country');
  const rows = new Map(RESOURCE_TYPES.map(type => [type, { type, units: 0, revenue: 0 }]));
  for (const p of state.provinces) if (p.ownerId === countryId && p.resourceDeposit) {
    const row = rows.get(p.resourceDeposit.type)!;
    const production = provinceProduction(p, country);
    row.units = Math.round((row.units + production.units) * 1000) / 1000;
    row.revenue = Math.round((row.revenue + production.revenue) * 1000) / 1000;
  }
  return [...rows.values()];
}
