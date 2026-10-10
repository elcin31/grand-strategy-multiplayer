import {provinceDefinitions} from './worldDefinitions.ts';
const mergedRegions=new Map(provinceDefinitions.filter(p=>p.sourceRegions).map(p=>[p.id,p.sourceRegions!]));
import type { Army, GameState, Province } from './gameTypes.ts';
import { techLevel } from './technologySystem.ts';
import { generateLeader } from './leaderGeneration.ts';
import { espionageModifiers } from './espionageSystem.ts';
import {militaryReadiness} from './economy2System.ts';
import {UNITS,UNIT_TYPES} from './unitCatalogue.ts';
export {UNITS,UNIT_TYPES,type UnitType} from './unitCatalogue.ts';
import {armyParts} from './armyComposition.ts';
import {supplyAt} from './supplySystem.ts';
export type TerrainType = 'plains' | 'forest' | 'mountain' | 'desert' | 'urban';
export interface Commander { id: string; countryId: string; name: string; skill: number;experience?:number }
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
      if (!Object.hasOwn(state.commanders,id)) { const leader=generateLeader(c.id,(state.campaignSeed!+i+1000)>>>0,c.region ?? 'Europe');state.commanders[id]={id,countryId:c.id,name:leader.name,skill:leader.militarySkill,experience:0}; }
    }
  }
  for(const g of Object.values(state.commanders))if((state.stateVersion??1)<16)g.experience??=0;
  for(const [id,c] of Object.entries(state.commanders)) if(id!==c.id || !Object.hasOwn(state.countries,c.countryId) || !Number.isFinite(c.skill) || c.skill<0 || c.skill>100 || typeof c.name!=='string'||!Number.isFinite(c.experience)||c.experience!<0||c.experience!>=20) throw new Error('Invalid commander');
  for(const p of state.provinces) {
    const regions=mergedRegions.get(p.id);
    if(regions&&!p.terrainShares){const shares:Partial<Record<TerrainType,number>>={};const total=regions.reduce((n,r)=>n+Math.max(1,r.population),0);for(const r of regions){const t=initialTerrain({...p,id:r.id,development:r.development});shares[t]=(shares[t]??0)+Math.max(1,r.population)/total;}p.terrainShares=shares;}
    p.terrain ??= p.terrainShares?Object.entries(p.terrainShares).sort((a,b)=>b[1]!-a[1]!)[0]![0] as TerrainType:initialTerrain(p);
    if(p.terrainShares&&(Object.values(p.terrainShares).some(v=>!Number.isFinite(v)||v!<0)||Math.abs(Object.values(p.terrainShares).reduce((n,v)=>n+v!,0)-1)>1e-6))throw Error("Invalid terrain shares");
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
  const skill=army.commanderId ? state.commanders?.[army.commanderId]?.skill ?? 0 : 0;
  const terrain=province.terrain ?? 'plains',parts=armyParts(army);
  const terrainDefense=defending?({plains:1,forest:1.15,mountain:1.35,desert:1.05,urban:1.3}[terrain]):1;
  const strength=UNIT_TYPES.reduce((n,type)=>{let factor=terrainDefense;if(!defending&&type==='Armor'&&['mountain','urban','forest'].includes(terrain))factor*=.65;if(type==='SpecialForces'&&terrain==='mountain')factor*=1.25;return n+(parts[type]??0)*(defending?UNITS[type].defense:UNITS[type].attack)*factor;},0)/Math.max(1,army.troops);
  const combined=(parts.Artillery??0)>0&&((parts.Infantry??0)+(parts.Mechanized??0))>0?1.08:1;
  const logistics=.5+supplyAt(state,army.ownerId,army.provinceId).score/200;
  const intel=!defending&&espionageModifiers(state,army.ownerId).intelTargets.has(province.controllerId??province.ownerId)?1.08:1;
  return strength*combined*logistics*(1+(army.experience??0)/500)*(.4+(army.morale??80)/200+(army.organization??80)/200)*(1+skill/500)*(1+techLevel(state.countries[army.ownerId]!,'Military')*.06)*intel*militaryReadiness(state.countries[army.ownerId]!);
}
export function recoverMilitary(state: GameState): void {
  if(!state.dataset)return;
  const provinces=new Map(state.provinces.map(p=>[p.id,p]));
  for(const a of state.armies) {
    const p=provinces.get(a.provinceId)!;
    const friendly=(p.controllerId??p.ownerId)===a.ownerId,quality=supplyAt(state,a.ownerId,p.id).score/100;
    a.morale=Math.min(100,(a.morale??80)+(friendly?5:2)*quality);a.organization=Math.min(100,(a.organization??80)+(friendly?8:3)*quality);
  }
}
export function battleFatigue(armies: Army[]): void { for(const a of armies){a.morale=Math.max(0,(a.morale??80)-15);a.organization=Math.max(0,(a.organization??80)-25);} }
