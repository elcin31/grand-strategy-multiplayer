import {provinceDefinitions} from './worldDefinitions.ts';
const mergedRegions=new Map(provinceDefinitions.filter(p=>p.sourceRegions).map(p=>[p.id,p.sourceRegions!]));
import type { Country, GameState } from './gameTypes.ts';

/** All faiths use identical rules. This catalogue can grow without changing the engine. */
export const RELIGIONS: Record<string, { name: string; group: string; color: string }> = {
  'christian-catholic': { name: 'Католицизм', group: 'Christianity', color: '#A99D78' },
  'christian-orthodox': { name: 'Православие', group: 'Christianity', color: '#9B8267' },
  'christian-protestant': { name: 'Протестантизм', group: 'Christianity', color: '#8E9EAE' },
  'islam-sunni': { name: 'Суннизм', group: 'Islam', color: '#6F9C86' },
  'islam-shia': { name: 'Шиизм', group: 'Islam', color: '#638F92' },
  hinduism: { name: 'Индуизм', group: 'Hinduism', color: '#B2926A' },
  buddhism: { name: 'Буддизм', group: 'Buddhism', color: '#A7A078' },
  judaism: { name: 'Иудаизм', group: 'Judaism', color: '#708FAF' },
  folk: { name: 'Традиционные верования', group: 'Folk / Traditional', color: '#8A9671' },
  shinto: { name: 'Синтоизм', group: 'Shinto', color: '#AD817E' },
  sikhism: { name: 'Сикхизм', group: 'Sikhism', color: '#B29C70' },
  secular: { name: 'Светское общество', group: 'Secular', color: '#859298' },
  other: { name: 'Другие верования', group: 'Other', color: '#93849B' },
};
export const RELIGION_IDS = Object.keys(RELIGIONS);
export const RELIGION_CHANGE_COST = 120;
export const RELIGION_STABILITY_COST = 12;
export const RELIGION_COOLDOWN_TICKS = 36;
export function assertReligion(id: unknown): asserts id is string {
  if (typeof id !== 'string' || !Object.hasOwn(RELIGIONS, id)) throw new Error('Invalid religion');
}
const regionalPools: Record<string, string[]> = {
  Europe: ['christian-catholic', 'christian-protestant', 'christian-orthodox', 'secular', 'islam-sunni', 'other'],
  Asia: ['islam-sunni', 'islam-shia', 'hinduism', 'buddhism', 'secular', 'folk', 'other'],
  Africa: ['christian-protestant', 'christian-catholic', 'islam-sunni', 'folk', 'other'],
  Americas: ['christian-catholic', 'christian-protestant', 'secular', 'folk', 'other'],
  Oceania: ['christian-protestant', 'christian-catholic', 'folk', 'secular', 'other'],
};
/** Original scenario starting policies, not a census or current legal-status database. */
export function initialReligion(country: Country): string {
  const choices: Record<string, string> = {
    'christian-catholic': 'phl tls ago bdi rwa cpv gnq',
    'christian-orthodox': 'russia ukr blr grc rou bgr srb mne mkd geo arm mda eth eri',
    'christian-protestant': 'germany uk usa dnk nor swe fin isl aus nzl zaf ken zmb zwe',
    'islam-sunni': 'afg alb are aze bgd bfa bhr bih brn com dji dza egy gmb gin idn irq jor kaz kgz kwt lby mar mdv mli mrt mys ner nga omn pak psx qat sau sdn sen sle som syr tcd tjk tkm tun turkey uzb yem',
    'islam-shia': 'irn', hinduism: 'ind npl mus', buddhism: 'btn khm lao lka mmr mng tha vnm',
    judaism: 'isr', shinto: 'jpn', secular: 'france cze est chn prk kor sgp cub ury',
  };
  for (const [religion, ids] of Object.entries(choices)) if (ids.split(' ').includes(country.id)) return religion;
  return regionalPools[country.region ?? '']?.[0] ?? 'secular';
}
function hash(value: string): number {
  let result = 2166136261;
  for (let i = 0; i < value.length; i++) result = Math.imul(result ^ value.charCodeAt(i), 16777619);
  return result >>> 0;
}
/** Recompute from controlled population in one province pass, including after conquest. */
export function recalcReligiousUnity(state: GameState): void {
  if (!state.dataset) return;
  const totals = new Map<string, { total: number; aligned: number }>();
  for (const p of state.provinces) {
    const country = state.countries[p.ownerId];
    if (!country) throw new Error('Unknown religious province owner');
    if (!Number.isFinite(p.population) || p.population < 0) throw new Error('Invalid religious population');
    const sum = totals.get(p.ownerId) ?? { total: 0, aligned: 0 };
    sum.total += p.population;
    if (p.religion === country.religion) sum.aligned += p.population;
    if (!Number.isFinite(sum.total) || !Number.isFinite(sum.aligned)) throw new Error('Religious population overflow');
    totals.set(p.ownerId, sum);
  }
  for (const c of Object.values(state.countries)) {
    const sum = totals.get(c.id);
    c.religiousUnity = sum && sum.total > 0 ? Math.min(100, Math.max(0, sum.aligned / sum.total * 100)) : 100;
  }
}
/** Missing fields migrate on the server clone once; existing province identities survive policy changes. */
export function initializeReligions(state: GameState): void {
  if (!state.dataset) return;
  for (const c of Object.values(state.countries)) {
    c.religion ??= initialReligion(c); c.religionCooldownUntilTick ??= 0;
    assertReligion(c.religion);
    if (!Number.isSafeInteger(c.religionCooldownUntilTick) || c.religionCooldownUntilTick < 0) throw new Error('Invalid religion cooldown');
  }
  const capitals = new Map((state.cities ?? []).filter(c => c.isCapital).map(c => [c.id, c.provinceId]));
  for (const p of state.provinces) {
    const country = state.countries[p.ownerId]!;
    if (!country || !Number.isFinite(p.population) || p.population < 0) throw new Error('Invalid religious province');
    if (p.religion == null) {
      const value = hash(`${state.campaignSeed ?? 0}:${p.id}`);
      const pool = regionalPools[country.region ?? ''] ?? ['secular', 'other'];
      const minorities = country.id === 'ind' || country.id === 'can' ? [...pool, 'sikhism'] : pool;
      p.religion = p.id === capitals.get(country.capitalCityId ?? '') || value % 100 < 80 ? country.religion! : minorities[value % minorities.length]!;
      const regions=mergedRegions.get(p.id);if(regions){const shares:Record<string,number>={};const total=regions.reduce((n,r)=>n+Math.max(1,r.population),0);for(const r of regions){const v=hash(`${state.campaignSeed??0}:${r.id}`),faith=r.id===capitals.get(country.capitalCityId??'')||v%100<80?country.religion!:minorities[v%minorities.length]!;shares[faith]=(shares[faith]??0)+Math.max(1,r.population)/total;}p.religionShares=shares;p.religion=p.id===capitals.get(country.capitalCityId??'')?country.religion!:Object.entries(shares).sort((a,b)=>b[1]-a[1])[0]![0];}
    }
    p.unrest ??= 10; assertReligion(p.religion);
    if(p.religionShares){for(const [faith,share]of Object.entries(p.religionShares)){assertReligion(faith);if(!Number.isFinite(share)||share<0)throw Error("Invalid religion shares");}if(Math.abs(Object.values(p.religionShares).reduce((n,v)=>n+v,0)-1)>1e-6)throw Error("Invalid religion shares");}
    if (!Number.isFinite(p.unrest) || p.unrest < 0 || p.unrest > 100) throw new Error('Invalid religious unrest');
  }
  recalcReligiousUnity(state);
}
export function monthlyReligionEffects(state: GameState): void {
  if (!state.dataset) return;
  recalcReligiousUnity(state);
  for (const c of Object.values(state.countries)) {
    const pressure = Math.max(0, (60 - c.religiousUnity!) / 60);
    c.unrest = Math.min(100, Math.max(0, c.unrest! + pressure * .15));
  }
  for (const p of state.provinces) {
    const country = state.countries[p.ownerId]!;
    const pressure = Math.max(0, (60 - country.religiousUnity!) / 60);
    p.unrest = Math.min(100, Math.max(0, p.unrest! + pressure * .12 + (p.religion === country.religion ? -.03 : .02)));
  }
}
