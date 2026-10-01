import type { Country, GameState, GovernmentType } from './gameTypes.ts';

export interface GovernmentModifiers {
  taxationPercent: number; manpowerPercent: number; researchPercent: number;
  diplomacy: number; stabilityPerYear: number; unrestPerYear: number;
}
/** Fictional scenario policies: restrained tradeoffs, no real-world quality ranking. */
export const GOVERNMENTS: Record<GovernmentType, GovernmentModifiers> = {
  'Parliamentary Republic': { taxationPercent: 0, manpowerPercent: -1, researchPercent: 2, diplomacy: 2, stabilityPerYear: .2, unrestPerYear: .1 },
  'Presidential Republic': { taxationPercent: 1, manpowerPercent: 1, researchPercent: 0, diplomacy: 0, stabilityPerYear: -.1, unrestPerYear: -.1 },
  'Semi-Presidential Republic': { taxationPercent: 1, manpowerPercent: 0, researchPercent: 1, diplomacy: 1, stabilityPerYear: .1, unrestPerYear: .2 },
  'Constitutional Monarchy': { taxationPercent: -1, manpowerPercent: 0, researchPercent: 0, diplomacy: 1, stabilityPerYear: .5, unrestPerYear: -.2 },
  'Absolute Monarchy': { taxationPercent: 3, manpowerPercent: 1, researchPercent: -2, diplomacy: -2, stabilityPerYear: .2, unrestPerYear: .2 },
  'Military Junta': { taxationPercent: -1, manpowerPercent: 3, researchPercent: -1, diplomacy: -2, stabilityPerYear: .3, unrestPerYear: .3 },
  Theocracy: { taxationPercent: 0, manpowerPercent: 1, researchPercent: -1, diplomacy: 0, stabilityPerYear: .2, unrestPerYear: -.3 },
  'One-Party State': { taxationPercent: 2, manpowerPercent: 0, researchPercent: 2, diplomacy: -1, stabilityPerYear: -.2, unrestPerYear: .3 },
  Federation: { taxationPercent: -2, manpowerPercent: -1, researchPercent: 3, diplomacy: 2, stabilityPerYear: 0, unrestPerYear: -.1 },
  'Tribal Government': { taxationPercent: -2, manpowerPercent: 2, researchPercent: -2, diplomacy: 0, stabilityPerYear: .4, unrestPerYear: -.2 },
};
export const GOVERNMENT_TYPES = Object.keys(GOVERNMENTS) as GovernmentType[];
export const GOVERNMENT_CHANGE_COST = 80;
export const GOVERNMENT_COOLDOWN_TICKS = 24;
export const GOVERNMENT_STABILITY_COST = 8;
export const POLITICAL_POWER_MONTHLY = 5;
export function initialGovernment(countryId: string): GovernmentType {
  let hash = 2166136261;
  for (let i = 0; i < countryId.length; i++) hash = Math.imul(hash ^ countryId.charCodeAt(i), 16777619);
  return GOVERNMENT_TYPES[(hash >>> 0) % GOVERNMENT_TYPES.length]!;
}
export function governmentModifiers(type: GovernmentType | undefined): GovernmentModifiers {
  return GOVERNMENTS[type ?? 'Parliamentary Republic'];
}
export function governmentIncome(base: number, type: GovernmentType | undefined): number {
  return Math.max(0, Math.floor(base * (1 + governmentModifiers(type).taxationPercent / 100)));
}
export function initializeGovernment(country: Country): void {
  country.governmentType ??= initialGovernment(country.id);
  country.politicalPower ??= 100;
  country.governmentCooldownUntilTick ??= 0;
  country.diplomaticReputation ??= 50;
  country.unrest ??= 10;
  if (!Object.hasOwn(GOVERNMENTS, country.governmentType)) throw new Error('Invalid campaign government');
  for (const [value, max] of [[country.politicalPower, 500], [country.diplomaticReputation, 100], [country.unrest, 100]]) {
    if (!Number.isFinite(value) || value! < 0 || value! > max!) throw new Error('Invalid government campaign value');
  }
  if (!Number.isSafeInteger(country.governmentCooldownUntilTick) || country.governmentCooldownUntilTick < 0) throw new Error('Invalid government cooldown');
}
/** Upgrade older modern-world snapshots on the authoritative clone; preserve legacy scenarios. */
export function initializeGovernments(state: GameState): void {
  if (state.dataset) for (const country of Object.values(state.countries)) initializeGovernment(country);
}
