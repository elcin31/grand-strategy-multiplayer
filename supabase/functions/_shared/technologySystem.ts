import type { Country, GameState } from './gameTypes.ts';
import { buildingModifierTotals } from './buildingSystem.ts';
import { governmentModifiers } from './governmentSystem.ts';
import { money,refreshResearchBudget } from './economySystem.ts';
import {economicPolicy,researchFunding} from './economy2System.ts';

export const TECHNOLOGIES = {
  Economy: { name: 'Экономика', effect: '+4% налогов / уровень' },
  Military: { name: 'Военное дело', effect: '+6% боевой силы / уровень' },
  Administration: { name: 'Управление', effect: '+0.6 стабильности / год / уровень' },
  Diplomacy: { name: 'Дипломатия', effect: '+4 к оценке договоров / уровень' },
  Industry: { name: 'Промышленность', effect: '+5% выпуска ресурсов / уровень' },
} as const;
export type TechnologyBranch = keyof typeof TECHNOLOGIES;
export const TECHNOLOGY_BRANCHES = Object.keys(TECHNOLOGIES) as TechnologyBranch[];
export interface Research { branch: TechnologyBranch; targetLevel: number; progress: number; required: number; startedTick: number }
export function techLevel(c: Country, branch: TechnologyBranch): number { return c.technologies?.[branch] ?? 0; }
export function researchQuote(c: Country, branch: TechnologyBranch) {
  const level = techLevel(c, branch);
  return { cost: 150 * (level + 1), months: 6 + level * 3, targetLevel: level + 1 };
}
export function initializeTechnology(state: GameState): void {
  if (!state.dataset) return;
  for (const c of Object.values(state.countries)) {
    c.technologies ??= { Economy: 0, Military: 0, Administration: 0, Diplomacy: 0, Industry: 0 };
    if (Object.keys(c.technologies).length !== 5) throw new Error('Invalid technology branches');
    for (const key of TECHNOLOGY_BRANCHES) if (!Number.isInteger(c.technologies[key]) || c.technologies[key] < 0 || c.technologies[key] > 5) throw new Error('Invalid technology level');
    if (c.research) {
      const r = c.research;
      if (!Object.hasOwn(TECHNOLOGIES, r.branch)) throw new Error('Invalid research branch');
      const q = researchQuote(c, r.branch);
      if (r.targetLevel !== q.targetLevel || r.targetLevel > 5 || r.required !== q.months || !Number.isFinite(r.progress) || r.progress < 0 || r.progress >= r.required || !Number.isSafeInteger(r.startedTick) || r.startedTick < 0 || r.startedTick > state.tick) throw new Error('Invalid research project');
    }
  }
}
export function startResearch(state: GameState, c: Country, branch: TechnologyBranch): void {
  const q = researchQuote(c, branch);
  if (c.research) throw new Error('Исследование уже идёт');
  if (q.targetLevel > 5) throw new Error('Максимальный уровень технологии');
  if (!c.provinceIds?.length || state.tick < c.bankruptcyUntilTick!) throw new Error('Исследования недоступны');
  if (c.treasury < q.cost) throw new Error('Недостаточно средств');
  c.treasury = money(c.treasury - q.cost);
  c.research = { branch, targetLevel: q.targetLevel, progress: 0, required: q.months, startedTick: state.tick };
  refreshResearchBudget(c);
}
export function monthlyResearch(state: GameState): void {
  if (!state.dataset) return;
  const totals = buildingModifierTotals(state);
  for (const c of Object.values(state.countries)) {
    const r = c.research;
    if (!r || !c.provinceIds?.length || state.tick < c.bankruptcyUntilTick!) continue;
    r.progress += (1 + (governmentModifiers(c.governmentType).researchPercent + (totals.get(c.id)?.researchPercent ?? 0)) / 100)*researchFunding(c)*economicPolicy(c).research;
    if (r.progress + 1e-9 >= r.required) { c.technologies![r.branch] = r.targetLevel; delete c.research; refreshResearchBudget(c); }
  }
}
