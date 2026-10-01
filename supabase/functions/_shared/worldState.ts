import { countryDefinitions, provinceDefinitions, cityDefinitions } from './worldDefinitions.ts';
import type { GameState, Country } from './gameTypes.ts';
import { generateLeader } from './leaderGeneration.ts';
import { governmentIncome, initializeGovernment } from './governmentSystem.ts';

function seedForCampaign(id: string): number {
  let seed = 2166136261;
  for (let i = 0; i < id.length; i++) seed = Math.imul(seed ^ id.charCodeAt(i), 16777619);
  return seed >>> 0;
}

/** All mutable state is newly allocated. Geometry/flag assets stay out of snapshots. */
export function createWorldState(gameId: string, roomCode: string, playerId: string, displayName: string, campaignSeed = seedForCampaign(gameId)): GameState {
  if (!Number.isSafeInteger(campaignSeed) || campaignSeed < 0) throw new Error('Invalid campaign seed');
  const countries: Record<string, Country> = {};
  const provinces = provinceDefinitions.map(p => ({ ...p, ownerId: p.countryId, controllerId: p.countryId, neighbors: [...p.neighbors], cityIds: [...p.cityIds] }));
  const cities = cityDefinitions.map(c => ({ ...c }));
  const income = new Map<string, number>();
  for (const p of provinces) income.set(p.countryId, (income.get(p.countryId) ?? 0) + p.income);
  const capitals = new Map(cities.filter(c => c.isCapital).map(c => [c.countryId, c]));
  const armies: GameState['armies'] = [];
  const leaders: NonNullable<GameState['leaders']> = {};
  for (const definition of countryDefinitions) {
    const capital = capitals.get(definition.id);
    if (!capital || capital.id !== definition.capitalCityId) throw new Error('Invalid capital definition');
    const monthly = income.get(definition.id) ?? 0;
    const troops = definition.populationEstimate >= 100000 ? Math.min(120000, Math.max(1000, Math.floor(definition.populationEstimate * .003 / 1000) * 1000)) : 0;
    const ruler = generateLeader(definition.id, campaignSeed, definition.region);
    leaders[ruler.id] = ruler;
    countries[definition.id] = { ...definition, rulerId: ruler.id, provinceIds: [...definition.provinceIds], income: monthly, population: definition.populationEstimate, treasury: monthly * 12 + 400, manpower: Math.max(0, Math.floor(definition.populationEstimate * .012) - troops), army: troops, technology: 60, stability: 75 };
    const country = countries[definition.id]!;
    initializeGovernment(country);
    country.income = governmentIncome(monthly, country.governmentType);
    if (troops) armies.push({ id: 'army-capital-'+definition.id, ownerId: definition.id, provinceId: capital.provinceId, troops });
  }
  return { dataset: 'modern-world-v1', campaignSeed, nextEntityId: 1, id: gameId, roomCode, phase: 'lobby', tick: 0, year: 2026, month: 1, speed: 1, countries, provinces, cities, leaders, armies, players: [{ id: playerId, displayName, countryId: null, isHost: true, ready: false }], selectedCountryId: null, battleLog: [] };
}
