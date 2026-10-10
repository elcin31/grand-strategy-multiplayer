import type { Rebellion, RebellionEvent } from './stabilitySystem.ts';
import type { PeaceTerms, WarSummary } from './warSystem.ts';
import type { DiplomacyLink, TreatyType, War } from './diplomacySystem.ts';
import type { Commander, TerrainType, UnitType } from './militarySystem.ts';
import type { Research, TechnologyBranch } from './technologySystem.ts';
import type { ResourceDeposit } from './resourceSystem.ts';
export type CountryId = string;
export type GameSpeed = 0 | 1 | 2 | 3 | 4;
export type GovernmentType = 'Parliamentary Republic' | 'Presidential Republic' | 'Semi-Presidential Republic' | 'Constitutional Monarchy' | 'Absolute Monarchy' | 'Military Junta' | 'Theocracy' | 'One-Party State' | 'Federation' | 'Tribal Government';
export type BuildingType = 'Farm' | 'Mine' | 'Factory' | 'Barracks' | 'Fort' | 'University' | 'Port' | 'Infrastructure' | 'Administration' | 'Hospital';

export interface Country {
  economicPolicy?: import('./economy2System.ts').EconomicPolicy;
  researchFunding?: import('./economy2System.ts').FundingLevel;
  militaryFunding?: import('./economy2System.ts').FundingLevel;
  policyCooldownUntilTick?: number;
  budgetCooldownUntilTick?: number;
  spyCooldowns?: Record<string,number>;
  warExhaustion?: number;
  aggressiveExpansion?: number;
  overlordId?: string;
  technologies?: Record<TechnologyBranch, number>;
  research?: Research;
  taxRate?: number;
  debt?: number;
  bankruptcyUntilTick?: number;
  bankruptcyCount?: number;
  economy?: EconomyBudget;
  id: CountryId;
  name: string;
  shortName: string;
  color: string;
  adjective?: string;
  flag?: string;
  capitalCityId?: string;
  rulerId?: string;
  monthlyPopulationGrowth?: number;
  region?: string;
  religion?: string;
  religiousUnity?: number;
  religionCooldownUntilTick?: number;
  governmentType?: GovernmentType;
  politicalPower?: number;
  governmentCooldownUntilTick?: number;
  diplomaticReputation?: number;
  unrest?: number;
  provinceIds?: string[];
  treasury: number;
  income: number;
  population: number;
  manpower: number;
  army: number;
  technology: number;
  stability: number;
}

/** Monetary values are millions, with precision to $1,000. Derived forecast. */
export interface EconomyBudget {
  researchMaintenance?: number;
  diplomaticMaintenance?: number;
  productionIncome: number;
  administrationMaintenance: number;
  taxIncome: number;
  tradeIncome: number;
  resourceIncome: number;
  monthlyIncome: number;
  armyMaintenance: number;
  buildingMaintenance: number;
  interest: number;
  monthlyBalance: number;
  creditLimit: number;
}

export interface Province {
  rebellion?: Rebellion;
  rebellionCooldownUntilTick?: number;
  originalOwnerId?: string;
  terrain?: TerrainType;
  terrainShares?: Partial<Record<TerrainType,number>>;
  religionShares?: Record<string,number>;
  buildings?: Partial<Record<BuildingType, number>>;
  resourceDeposit?: ResourceDeposit;
  resourceMix?: (ResourceDeposit & {weight:number})[];
  populationGrowthCarry?: number;
  monthlyPopulationGrowth?: number;
  religion?: string;
  unrest?: number;
  id: string;
  name: string;
  ownerId: CountryId;
  x: number;
  y: number;
  width: number;
  height: number;
  population: number;
  income: number;
  neighbors: string[];
  countryId?: CountryId;
  controllerId?: CountryId;
  cityIds?: string[];
  development?: number;
}

export interface Construction {
  id: string;
  provinceId: string;
  ownerId: CountryId;
  buildingType: BuildingType;
  targetLevel: number;
  startedTick: number;
  completeTick: number;
  cost: number;
}

export interface Army {
  order?: import("./armyOrders.ts").ArmyOrder;
  unitType?: UnitType;
  morale?: number;
  organization?: number;
  commanderId?: string;
  id: string;
  ownerId: CountryId;
  provinceId: string;
  troops: number;
}

export interface Player {
  connected?: boolean;
  lastSeen?: number;
  aiControlled?: boolean;
  id: string;
  displayName: string;
  countryId: CountryId | null;
  isHost: boolean;
  ready: boolean;
}

export interface BattleEvent {
  id: string;
  tick: number;
  provinceId: string;
  attackerId: CountryId;
  defenderId: CountryId;
  attackerLosses: number;
  defenderLosses: number;
  winnerId: CountryId;
  captured: boolean;
  message: string;
}

export interface City {
  /** Deferred fractional urban-growth units carried through city consolidation. */
  populationGrowthCarryReserve?: number;
  populationGrowthCarry?: number;
  id: string;
  name: string;
  countryId: CountryId;
  provinceId: string;
  population: number;
  development: number;
  isCapital: boolean;
  isRegionalCapital: boolean;
}

export interface Leader {
  aiPersonality?: import("./aiSystem.ts").AIPersonality;
  id: string;
  name: string;
  countryId: CountryId;
  age: number;
  portraitSeed: number;
  ideology: string;
  traits: string[];
  militarySkill: number;
  diplomaticSkill: number;
  economicSkill: number;
  popularity: number;
}

export interface GameState {
  constructionQueue?: import('./constructionQueueSystem.ts').QueuedConstruction[];
  spyMissions?: import('./espionageSystem.ts').SpyMission[];
  spyReports?: import('./espionageSystem.ts').SpyReport[];
  spyEffects?: import('./espionageSystem.ts').SpyEffect[];
  relationMissions?: import('./diplomacyTypes.ts').RelationMission[];
  diplomaticOffers?: import('./diplomacyTypes.ts').DiplomaticOffer[];
  diplomaticHistory?: import('./diplomacyTypes.ts').DiplomaticEvent[];
  politicalUnions?: import('./diplomacyTypes.ts').PoliticalUnion[];
  movements?: import("./movementHistory.ts").MovementEvent[];
  rebellionLog?: RebellionEvent[];
  warHistory?: WarSummary[];
  diplomacy?: Record<string, DiplomacyLink>;
  wars?: War[];
  commanders?: Record<string, Commander>;
  stateVersion?: number;
  nextEntityId?: number;
  dataset?: 'modern-world-v1' | 'modern-world-v2';
  campaignSeed?: number;
  cities?: City[];
  leaders?: Record<string, Leader>;
  constructions?: Construction[];
  id: string;
  roomCode: string;
  phase: 'lobby' | 'running' | 'paused' | 'finished';
  tick: number;
  year: number;
  month: number;
  speed: GameSpeed;
  countries: Record<CountryId, Country>;
  provinces: Province[];
  armies: Army[];
  players: Player[];
  selectedCountryId: CountryId | null;
  battleLog: BattleEvent[];
}

export type GameCommand =
  | {type:'SET_ECONOMIC_POLICY';playerId:string;policy:import('./economy2System.ts').EconomicPolicy}
  | {type:'SET_FUNDING';playerId:string;domain:'Research'|'Military';level:import('./economy2System.ts').FundingLevel}
  | {type:'QUEUE_BUILD';playerId:string;provinceId:string;buildingType:BuildingType}
  | {type:'CANCEL_CONSTRUCTION';playerId:string;constructionId:string}
  | {type:'START_ESPIONAGE';playerId:string;targetId:string;kind:import('./espionageSystem.ts').EspionageKind}
  | {type:'CANCEL_ESPIONAGE';playerId:string;missionId:string}
  | {type:'START_RELATION_MISSION';playerId:string;targetId:string;kind:import('./diplomacyTypes.ts').RelationMissionKind}
  | {type:'CANCEL_RELATION_MISSION';playerId:string;missionId:string}
  | {type:'SEND_GIFT';playerId:string;targetId:string;amount:number}
  | {type:'SEND_INSULT';playerId:string;targetId:string}
  | {type:'OFFER_DIPLOMACY';playerId:string;targetId:string;terms:import('./diplomacyTypes.ts').DiplomaticTerms}
  | {type:'RESPOND_DIPLOMACY';playerId:string;offerId:string;accept:boolean}
  | {type:'TERMINATE_TREATY';playerId:string;targetId:string;treatyId:string}
  | { type: 'PACIFY_PROVINCE'; playerId: string; provinceId: string }
  | { type: 'SUPPRESS_REBELLION'; playerId: string; provinceId: string }
  | { type: 'PROPOSE_PEACE'; playerId: string; warId: string; terms: PeaceTerms }
  | { type: 'RESPOND_PEACE'; playerId: string; warId: string; accept: boolean }
  | { type: 'DIPLOMATIC_ACTION'; playerId: string; targetId: string; action: 'Improve' | 'Rival' | 'Guarantee' | 'Cancel' }
  | { type: 'OFFER_TREATY'; playerId: string; targetId: string; treaty: TreatyType }
  | { type: 'RESPOND_TREATY'; playerId: string; targetId: string; accept: boolean }
  | { type: 'DECLARE_WAR'; playerId: string; targetId: string }
  | { type: 'RECRUIT_UNIT'; playerId: string; provinceId: string; troops: number; unitType: UnitType }
  | { type: 'ASSIGN_COMMANDER'; playerId: string; armyId: string; commanderId: string }
  | { type: 'START_RESEARCH'; playerId: string; branch: TechnologyBranch }
  | { type: 'SET_TAX_RATE'; playerId: string; taxRate: number }
  | { type: 'BORROW'; playerId: string; amount: number }
  | { type: 'REPAY_DEBT'; playerId: string; amount: number }
  | { type: 'BUILD'; playerId: string; provinceId: string; buildingType: BuildingType }
  | { type: 'SELECT_COUNTRY'; playerId: string; countryId: CountryId }
  | { type: 'SET_READY'; playerId: string; ready: boolean }
  | { type: 'START_GAME'; playerId: string }
  | { type: 'SET_SPEED'; playerId: string; speed: GameSpeed }
  | { type: 'RECRUIT'; playerId: string; provinceId: string; troops: number }
  | { type: 'CANCEL_ARMY_ORDER'; playerId: string; armyId: string }
  | { type: 'ORDER_ARMY'; playerId: string; armyId: string; provinceId: string }
  | { type: 'MOVE_ARMY'; playerId: string; armyId: string; provinceId: string }
  | { type: 'CHANGE_RELIGION'; playerId: string; religionId: string }
  | { type: 'CHANGE_GOVERNMENT'; playerId: string; governmentType: GovernmentType }
  | { type: 'ADVANCE_TICK' };

/** Campaign country IDs are extensible; lookups fail explicitly on corrupted links. */
export function countryFor(state: Pick<GameState, 'countries'>, id: string): Country {
  if (!Object.hasOwn(state.countries, id)) throw new Error('Unknown campaign country: '+id);
  const country = state.countries[id];
  if (!country || country.id !== id) throw new Error('Invalid campaign country: '+id);
  return country;
}
