import {data,contentHash} from './scenarioContent.ts';
import type {ScenarioPack,CampaignScenario} from './scenarioTypes.ts';
import type {GameState} from './gameTypes.ts';
import {createWorldState} from './worldState.ts';
import {validateScenarioPack} from './contentValidation.ts';
import {initializeArmyComposition} from './armyComposition.ts';
import {initializeDiplomacy2} from './diplomacy2System.ts';
import {diplomaticLink} from './diplomacySystem.ts';
import {recalcPopulationTotals} from './populationSystem.ts';
import {recalcReligiousUnity} from './religionSystem.ts';
import {recalcEconomy} from './economySystem.ts';
import {seedScenarioTechnologies,initializeTechnologyTree} from './technologyTree.ts';
import {hasTechnology} from './technologyTree.ts';
import {ensureStrategy} from './ai3System.ts';

const pack=data as unknown as ScenarioPack;
const base:CampaignScenario={id:'modern-world',version:1,contentHash:'dominion-modern-world-v2-default-v1'};
export const SCENARIOS=Object.freeze([
 {id:base.id,name:'Современный мир',description:'Существующая кампания Dominion на карте 2.2.'},
 {id:pack.id,name:pack.name,description:pack.description}
]);
let packValidated=false;
export function scenarioPack(id:string):ScenarioPack|undefined{return id===pack.id?pack:undefined;}
export function initializeScenario(s:GameState,migrate:boolean):void{
 if(!s.dataset)return;
 if(migrate)s.scenario??={...base};const current=s.scenario;
 if(!current||Object.keys(current).some(k=>!['id','version','contentHash'].includes(k)))throw Error('Invalid campaign scenario');
 const expected=current.id===base.id?base:current.id===pack.id?{id:pack.id,version:pack.version,contentHash}:null;
 if(!expected||current.version!==expected.version||current.contentHash!==expected.contentHash)throw Error('Не найдена совместимая версия сценария. Сохранение не изменено.');
}
/** A lobby command, never a migration of an existing running campaign. Geometry
 * stays in worldDefinitions and the renderer retains exactly the same IDs. */
export function selectScenario(state:GameState,scenarioId:string):GameState{
 if(state.phase!=='lobby')throw Error('Сценарий можно менять только до начала кампании');
 if(!SCENARIOS.some(s=>s.id===scenarioId))throw Error('Неизвестный сценарий');
 if(state.scenario?.id===scenarioId)return state;
 const first=state.players[0]!;
 const s=createWorldState(state.id,state.roomCode,first.id,first.displayName,state.campaignSeed);
 s.players=state.players.map(p=>({...p,ready:false}));s.aiDifficulty=state.aiDifficulty;
 if(scenarioId===base.id)return s;
 if(!packValidated){validateScenarioPack(pack);packValidated=true;}
 s.scenario={id:pack.id,version:pack.version,contentHash};s.year=pack.startDate.year;s.month=pack.startDate.month;s.day=pack.startDate.day;
 // Start definitions are immutable; only their resulting campaign state is saved.
 seedScenarioTechnologies(s);
 for(const definition of pack.countries){const c=s.countries[definition.id]!;
  if(definition.treasury!==undefined)c.treasury=definition.treasury;
  if(definition.manpower!==undefined)c.manpower=definition.manpower;
  if(definition.governmentType)c.governmentType=definition.governmentType;
  if(definition.technologies)Object.assign(c.technologies!,definition.technologies);
  if(definition.discoveries)c.scientificDiscoveries=[...definition.discoveries];
  if(definition.resources){Object.assign(c.stockpile!.amounts,definition.resources);c.stockpile!.capacity=Math.max(c.stockpile!.capacity,...Object.values(c.stockpile!.amounts).map(n=>n??0));}
 }
 const provinces=new Map(s.provinces.map(p=>[p.id,p]));
 for(const definition of pack.provinceOwners){const p=provinces.get(definition.provinceId)!;p.ownerId=definition.ownerId;p.countryId=p.ownerId;p.controllerId=p.ownerId;if(definition.originalOwnerId)p.originalOwnerId=definition.originalOwnerId;if(definition.buildingDamage!==undefined)p.buildingDamage=definition.buildingDamage;}
 for(const city of s.cities??[])city.countryId=provinces.get(city.provinceId)!.ownerId;
 if(pack.armyMode==='replace')s.armies=[];
 const armyIds=new Set(s.armies.map(a=>a.id));
 for(const definition of pack.armies){if(armyIds.has(definition.id))throw Error('Duplicate initial army');const a={id:definition.id,ownerId:definition.ownerId,provinceId:definition.provinceId,composition:{...definition.composition},template:{...definition.composition},troops:Object.values(definition.composition).reduce((n,v)=>n+(v??0),0)};initializeArmyComposition(a);s.armies.push(a);armyIds.add(a.id);}
 for(const definition of pack.relations){const link=diplomaticLink(s,definition.a,definition.b);link.relation=definition.relation;link.baselineRelation=definition.relation;link.trust=definition.trust;link.treaties=[...definition.treaties];}
 initializeDiplomacy2(s,true);
 for(const c of Object.values(s.countries)){c.provinceIds=[];c.army=0;}
 for(const p of s.provinces)s.countries[p.ownerId]!.provinceIds!.push(p.id);
 for(const a of s.armies)s.countries[a.ownerId]!.army+=a.troops;
 for(const c of Object.values(s.countries))for(const id of c.scientificDiscoveries??[])if(!hasTechnology(c,id))throw Error('Invalid scenario technology');
 initializeTechnologyTree(s,false);recalcPopulationTotals(s);recalcReligiousUnity(s);recalcEconomy(s);
 for(const c of Object.values(s.countries)){delete c.aiStrategy;ensureStrategy(s,c);}
 return s;
}
