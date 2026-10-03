import { provinceBuildingModifiers } from './buildingSystem.ts';
import type { GameState } from './gameTypes.ts';

function integer(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid population '+name);
}
function carry(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('Invalid population carry');
}
/** Original demographic game model, not a real-world forecast: 0.4–1% annually before building modifiers. */
export function annualPopulationGrowth(development: number, stability: number): number {
  if (![development, stability].every(v => Number.isFinite(v) && v >= 0 && v <= 100)) throw new Error('Invalid demographic modifiers');
  return .004 + .002 * development / 100 + .004 * stability / 100;
}
/** Country totals are derived; province and city counts stay integer and safely bounded. */
export function recalcPopulationTotals(state: GameState): void {
  if (!state.dataset) return;
  for (const c of Object.values(state.countries)) { c.population = 0; c.monthlyPopulationGrowth = 0; }
  for (const p of state.provinces) {
    integer(p.population, 'province');
    const country = state.countries[p.ownerId];
    if (!country) throw new Error('Unknown population owner');
    country.population += p.population; country.monthlyPopulationGrowth! += p.monthlyPopulationGrowth ?? 0;
    integer(country.population, 'country'); integer(country.monthlyPopulationGrowth!, 'growth');
  }
}
/** Initialize old saves without inventing people or losing fractional progress. */
export function initializePopulation(state: GameState): void {
  if (!state.dataset) return;
  const provinces = new Map(state.provinces.map(p => [p.id, p]));
  if (provinces.size !== state.provinces.length) throw new Error('Duplicate population province');
  const cityIds = new Set<string>();
  const cityTotals = new Map<string, number>();
  for (const p of state.provinces) {
    p.populationGrowthCarry ??= 0; p.monthlyPopulationGrowth ??= 0;
    integer(p.population, 'province'); integer(p.monthlyPopulationGrowth, 'growth'); carry(p.populationGrowthCarry);
    annualPopulationGrowth(p.development ?? 40, state.countries[p.ownerId]?.stability ?? NaN);
  }
  for (const city of state.cities ?? []) {
    if (cityIds.has(city.id)) throw new Error('Duplicate population city');
    cityIds.add(city.id);
    city.populationGrowthCarry ??= 0; integer(city.population, 'city'); carry(city.populationGrowthCarry);
    if (!provinces.has(city.provinceId)) throw new Error('Unknown city population province');
    const sum = (cityTotals.get(city.provinceId) ?? 0) + city.population;
    integer(sum, 'city sum'); cityTotals.set(city.provinceId, sum);
  }
  for (const [id, total] of cityTotals) if (total > provinces.get(id)!.population) throw new Error('Cities exceed province population');
  recalcPopulationTotals(state);
}
/** One province pass and one city pass; no per-person simulation or country×province loop. */
export function monthlyPopulationGrowth(state: GameState): void {
  if (!state.dataset) return;
  const growth = new Map<string, { population: number; births: number }>();
  for (const p of state.provinces) {
    const old = p.population;
    const buildingGrowth = provinceBuildingModifiers(p).populationGrowthPercent;
    const rate = annualPopulationGrowth(p.development ?? 40, state.countries[p.ownerId]!.stability) * (1 + buildingGrowth / 100);
    const exact = old * rate / 12 + p.populationGrowthCarry!;
    const births = Math.floor(exact);
    integer(old + births, 'overflow');
    p.population += births; p.populationGrowthCarry = exact - births; p.monthlyPopulationGrowth = births;
    p.income = Math.max(1, Math.round(p.population / 300000 * (.5 + (p.development ?? 40) / 100)));
    growth.set(p.id, { population: old, births });
  }
  for (const city of state.cities ?? []) {
    const province = growth.get(city.provinceId)!;
    const exact = (province.population > 0 ? city.population / province.population * province.births : 0) + city.populationGrowthCarry!;
    const births = Math.floor(exact);
    integer(city.population + births, 'city overflow');
    city.population += births; city.populationGrowthCarry = exact - births;
  }
  recalcPopulationTotals(state);
}
