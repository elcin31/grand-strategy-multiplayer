import type { Army, GameState, Province } from './gameTypes.ts';
import { techLevel } from './technologySystem.ts';
import { generateLeader } from './leaderGeneration.ts';
export const UNITS = {
  Infantry: { name: 'Пехота', cost: 20, attack: 1, defense: 1, unlock: 0 },
  Mechanized: { name: 'Механизированная пехота', cost: 35, attack: 1.25, defense: 1.15, unlock: 1 },
  Armor: { name: 'Бронетехника', cost: 55, attack: 1.7, defense: 1.25, unlock: 2 },
  Artillery: { name: 'Артиллерия', cost: 40, attack: 1.4, defense: .9, unlock: 1 },
  AirDefense: { name: 'ПВО', cost: 35, attack: .8, defense: 1.4, unlock: 1 },
  SpecialForces: { name: 'Спецназ', cost: 65, attack: 1.35, defense: 1.25, unlock: 3 },
} as const;
export type UnitType = keyof typeof UNITS;
export const UNIT_TYPES = Object.keys(UNITS) as UnitType[];
export type TerrainType = 'plains' | 'forest' | 'mountain' | 'desert' | 'urban';
export interface Commander { id: string; countryId: string; name: string; skill: number }
function hash(s: string) { let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h>>>0; }
/** Original deterministic scenario terrain, not a real-world elevation survey. */
export function initialTerrain(p: Province): TerrainType {
  if ((p.development ?? 0) >= 85) return 'urban';
  return (['plains','plains','forest','mountain','desert'] as const)[hash(p.id)%5]!;
}
export function initializeMilitary(state: GameState): void {
  if (!state.dataset) return;
  state.commanders ??= {};
  for (const c of Object.values(state.countries)) {
    for(let i=0;i<3;i++) {
      const id=`general-${c.id}-${i}`;
      if (!Object.hasOwn(state.commanders,id)) { const leader=generateLeader(c.id,(state.campaignSeed!+i+1000)>>>0,c.region ?? 'Europe');state.commanders[id]={id,countryId:c.id,name:leader.name,skill:leader.militarySkill}; }
    }
  }
  for(const [id,c] of Object.entries(state.commanders)) if(id!==c.id || !Object.hasOwn(state.countries,c.countryId) || !Number.isFinite(c.skill) || c.skill<0 || c.skill>100 || typeof c.name!=='string') throw new Error('Invalid commander');
  for(const p of state.provinces) {
    p.terrain ??= initialTerrain(p);
    if(!['plains','forest','mountain','desert','urban'].includes(p.terrain)) throw new Error('Invalid military terrain');
  }
  const ids=new Set<string>(), assigned=new Set<string>(), provinces=new Set(state.provinces.map(p=>p.id));
  for(const a of state.armies) {
    a.unitType ??= 'Infantry';a.morale ??= 80;a.organization ??= 80;
    if(ids.has(a.id) || !provinces.has(a.provinceId) || !Object.hasOwn(state.countries,a.ownerId) || !Object.hasOwn(UNITS,a.unitType) || !Number.isSafeInteger(a.troops) || a.troops<=0 || ![a.morale,a.organization].every(n=>Number.isFinite(n)&&n>=0&&n<=100))throw new Error('Invalid military army');
    ids.add(a.id);
    if(a.commanderId) {const c=state.commanders[a.commanderId];if(!c || c.countryId!==a.ownerId || assigned.has(c.id))throw new Error('Invalid commander assignment');assigned.add(c.id);}
  }
}
export function assignCommander(state: GameState,countryId: string,armyId: string,commanderId: string): void {
  const army=state.armies.find(a=>a.id===armyId), commander=state.commanders?.[commanderId];
  if(!army || army.ownerId!==countryId || !commander || commander.countryId!==countryId)throw new Error('Армия или командир недоступны');
  if(state.armies.some(a=>a.id!==armyId && a.commanderId===commanderId))throw new Error('Командир уже назначен');
  army.commanderId=commanderId;
}
export function combatMultiplier(state: GameState,army: Army,province: Province,defending: boolean): number {
  if(!state.dataset)return 1;
  const unit=UNITS[army.unitType ?? 'Infantry'];
  const skill=army.commanderId ? state.commanders?.[army.commanderId]?.skill ?? 0 : 0;
  const terrain=province.terrain ?? 'plains';
  let terrainFactor=defending ? ({plains:1,forest:1.15,mountain:1.35,desert:1.05,urban:1.3}[terrain]) : 1;
  if(!defending && army.unitType==='Armor' && ['mountain','urban','forest'].includes(terrain))terrainFactor=.65;
  if(army.unitType==='SpecialForces' && terrain==='mountain')terrainFactor*=1.25;
  return (defending?unit.defense:unit.attack)*(.4+(army.morale??80)/200+(army.organization??80)/200)*(1+skill/500)*(1+techLevel(state.countries[army.ownerId]!,'Military')*.06)*terrainFactor;
}
export function recoverMilitary(state: GameState): void {
  if(!state.dataset)return;
  const provinces=new Map(state.provinces.map(p=>[p.id,p]));
  for(const a of state.armies) {
    const p=provinces.get(a.provinceId)!;
    const friendly=(p.controllerId??p.ownerId)===a.ownerId;
    a.morale=Math.min(100,(a.morale??80)+(friendly?5:2));a.organization=Math.min(100,(a.organization??80)+(friendly?8:3));
  }
}
export function battleFatigue(armies: Army[]): void { for(const a of armies){a.morale=Math.max(0,(a.morale??80)-15);a.organization=Math.max(0,(a.organization??80)-25);} }
