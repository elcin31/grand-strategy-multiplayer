import { provinceProduction } from './resourceSystem.ts';
import type { Country, GameState } from './gameTypes.ts';
import { governmentIncome } from './governmentSystem.ts';

export const DEFAULT_TAX_RATE = 30;
export const MIN_TAX_RATE = 10;
export const MAX_TAX_RATE = 60;
export const ARMY_MAINTENANCE_PER_THOUSAND = 1.25;
export const MONTHLY_INTEREST = .005;
export const BANKRUPTCY_MONTHS = 24;
const MAX_MONEY = Math.floor(Number.MAX_SAFE_INTEGER / 1000);

/** Fixed precision arithmetic avoids accumulated fractional money drift. */
export function money(value: number): number {
  if (!Number.isFinite(value) || Math.abs(value) > MAX_MONEY) throw new Error('Economic amount overflow');
  return Math.round(value * 1000) / 1000;
}
function validMoney(value: number): void {
  if (value < 0 || money(value) !== value) throw new Error('Invalid economic amount');
}
export function assertLoanAmount(value: unknown): asserts value is number {
  if (typeof value !== 'number' || value < .001 || value > 1_000_000) throw new Error('Invalid loan amount');
  validMoney(value);
}
export function assertTaxRate(value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < MIN_TAX_RATE || value > MAX_TAX_RATE) throw new Error('Invalid tax rate');
}

/** Derived from current owners/armies every time; client budget fields are never accepted. */
export function recalcEconomy(state: GameState): void {
  if (!state.dataset) return;
  const resources = new Map<string, number>();
  const base = new Map<string, number>(), development = new Map<string, number>(), population = new Map<string, number>(), troops = new Map<string, number>();
  for (const p of state.provinces) {
    if (!Object.hasOwn(state.countries, p.ownerId)) throw new Error('Unknown economic province owner');
    validMoney(p.income);
    resources.set(p.ownerId, money((resources.get(p.ownerId) ?? 0) + provinceProduction(p, state.countries[p.ownerId]!).revenue));
    base.set(p.ownerId, money((base.get(p.ownerId) ?? 0) + p.income));
    development.set(p.ownerId, (development.get(p.ownerId) ?? 0) + p.population * (p.development ?? 40));
    population.set(p.ownerId, (population.get(p.ownerId) ?? 0) + p.population);
  }
  for (const a of state.armies) {
    if (!Object.hasOwn(state.countries, a.ownerId) || !Number.isSafeInteger(a.troops) || a.troops <= 0) throw new Error('Invalid economic army');
    const sum = (troops.get(a.ownerId) ?? 0) + a.troops;
    if (!Number.isSafeInteger(sum)) throw new Error('Army upkeep overflow');
    troops.set(a.ownerId, sum);
  }
  for (const c of Object.values(state.countries)) {
    const raw = base.get(c.id) ?? 0;
    const taxIncome = money(governmentIncome(raw, c.governmentType) * c.taxRate! / DEFAULT_TAX_RATE);
    const people = population.get(c.id) ?? 0;
    const meanDevelopment = people > 0 ? (development.get(c.id) ?? 0) / people : 0;
    // Original commerce model: local production/development and stable institutions.
    // Building maintenance is added when construction is implemented.
    const tradeIncome = money(raw * .1 * meanDevelopment / 100 * (.5 + c.stability / 200));
    const resourceIncome = resources.get(c.id) ?? 0, buildingMaintenance = 0;
    const monthlyIncome = money(taxIncome + tradeIncome + resourceIncome);
    const armyMaintenance = money((troops.get(c.id) ?? 0) / 1000 * ARMY_MAINTENANCE_PER_THOUSAND);
    const interest = money(c.debt! * MONTHLY_INTEREST);
    const monthlyBalance = money(monthlyIncome - armyMaintenance - buildingMaintenance - interest);
    const creditLimit = state.tick < c.bankruptcyUntilTick! ? 0 : money(monthlyIncome * 24);
    c.income = taxIncome;
    c.army = troops.get(c.id) ?? 0;
    c.economy = { taxIncome, tradeIncome, resourceIncome, monthlyIncome, armyMaintenance, buildingMaintenance, interest, monthlyBalance, creditLimit };
  }
}

/** Recruitment changes no income source, so update only this country's upkeep. */
export function refreshArmyBudget(c: Country): void {
  if (!c.economy) return;
  c.economy.armyMaintenance = money(c.army / 1000 * ARMY_MAINTENANCE_PER_THOUSAND);
  c.economy.monthlyBalance = money(c.economy.monthlyIncome - c.economy.armyMaintenance - c.economy.buildingMaintenance - c.economy.interest);
}

export function initializeEconomy(state: GameState): void {
  if (!state.dataset) return;
  for (const c of Object.values(state.countries)) {
    c.taxRate ??= DEFAULT_TAX_RATE; c.debt ??= 0; c.bankruptcyUntilTick ??= 0; c.bankruptcyCount ??= 0;
    assertTaxRate(c.taxRate); validMoney(c.treasury); validMoney(c.debt);
    if (!Number.isSafeInteger(c.bankruptcyUntilTick) || c.bankruptcyUntilTick < 0 || !Number.isSafeInteger(c.bankruptcyCount) || c.bankruptcyCount < 0) throw new Error('Invalid bankruptcy state');
  }
  recalcEconomy(state);
}

export function borrow(state: GameState, c: Country, amount: number): void {
  assertLoanAmount(amount);
  if (state.tick < c.bankruptcyUntilTick!) throw new Error('Кредит недоступен после банкротства');
  const debt = money(c.debt! + amount);
  if (debt > c.economy!.creditLimit) throw new Error('Превышен кредитный лимит');
  c.treasury = money(c.treasury + amount); c.debt = debt;
  recalcEconomy(state);
}
export function repay(state: GameState, c: Country, amount: number): void {
  assertLoanAmount(amount);
  if (amount > c.debt! || amount > c.treasury) throw new Error('Недостаточно средств или долга');
  c.treasury = money(c.treasury - amount); c.debt = money(c.debt! - amount);
  recalcEconomy(state);
}

function bankruptcy(state: GameState, c: Country): void {
  if (state.tick >= c.bankruptcyUntilTick!) {
    if (!Number.isSafeInteger(state.tick) || state.tick > Number.MAX_SAFE_INTEGER - BANKRUPTCY_MONTHS) throw new Error('Bankruptcy date overflow');
    if (c.bankruptcyCount! >= Number.MAX_SAFE_INTEGER) throw new Error('Bankruptcy count overflow');
    c.bankruptcyCount! += 1; c.bankruptcyUntilTick = state.tick + BANKRUPTCY_MONTHS;
    c.stability = Math.max(0, c.stability - 20); c.unrest = Math.min(100, c.unrest! + 20);
    c.politicalPower = Math.max(0, c.politicalPower! - 50);
    c.diplomaticReputation = Math.max(0, c.diplomaticReputation! - 10);
    for (const p of state.provinces) if (p.ownerId === c.id) p.unrest = Math.min(100, p.unrest! + 5);
  }
  c.treasury = 0; c.debt = 0;
  // Liquidate unaffordable forces, including at least half on default. No unpaid army survives forever.
  const ratio = c.economy!.armyMaintenance > 0 ? Math.max(0, Math.min(.5, c.economy!.monthlyIncome * .8 / c.economy!.armyMaintenance)) : 0;
  for (const a of state.armies) if (a.ownerId === c.id) a.troops = Math.floor(a.troops * ratio / 1000) * 1000;
  state.armies = state.armies.filter(a => a.troops > 0);
}

export function monthlyEconomy(state: GameState): void {
  if (!state.dataset) return;
  recalcEconomy(state);
  const pressures = new Map<string, number>();
  for (const c of Object.values(state.countries)) {
    const balance = money(c.treasury + c.economy!.monthlyBalance);
    if (balance >= 0) c.treasury = balance;
    else {
      const debt = money(c.debt! - balance);
      if (debt <= c.economy!.creditLimit) { c.debt = debt; c.treasury = 0; }
      else bankruptcy(state, c);
    }
    // Taxation tradeoff applies monthly, not when the player repeatedly presses a button.
    const pressure = Math.max(0, c.taxRate! - DEFAULT_TAX_RATE) / 300;
    c.stability = Math.max(0, Math.min(100, c.stability - pressure));
    c.unrest = Math.max(0, Math.min(100, c.unrest! + pressure));
    pressures.set(c.id, pressure);
  }
  for (const p of state.provinces) p.unrest = Math.min(100, p.unrest! + (pressures.get(p.ownerId) ?? 0));
  recalcEconomy(state);
}
