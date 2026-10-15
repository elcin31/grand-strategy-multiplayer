import type {GameState,GovernmentType} from './gameTypes.ts';
import type {Composition} from './armyComposition.ts';
import type {ResourceType} from './resourceCatalogue.ts';
import type {TechnologyBranch} from './technologySystem.ts';
import type {TreatyType} from './diplomacySystem.ts';
import type {EventDefinition} from './eventTypes.ts';
import type {FocusNode} from './focusCatalogue.ts';

export interface ScenarioPack {
 schemaVersion:1;id:string;version:number;name:string;description:string;geography:'modern-world-v2';
 startDate:{year:number;month:number;day:number};
 countries:{id:string;treasury?:number;manpower?:number;governmentType?:GovernmentType;technologies?:Partial<Record<TechnologyBranch,number>>;discoveries?:string[];resources?:Partial<Record<ResourceType,number>>}[];
 provinceOwners:{provinceId:string;ownerId:string;originalOwnerId?:string;buildingDamage?:number}[];
 armyMode:'inherit'|'replace';armies:{id:string;ownerId:string;provinceId:string;composition:Composition}[];
 relations:{a:string;b:string;relation:number;trust:number;treaties:TreatyType[]}[];
 events:EventDefinition[];focuses:(FocusNode&{id:string;scenarioId:string})[];
}
export interface CampaignScenario {id:string;version:number;contentHash:string}
export type ScenarioState=GameState&{scenario:CampaignScenario};
