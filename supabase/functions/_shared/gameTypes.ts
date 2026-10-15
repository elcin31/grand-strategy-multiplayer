import type { Rebellion, RebellionEvent } from './stabilitySystem.ts';
import type { PeaceTerms, WarSummary } from './warSystem.ts';
import type { DiplomacyLink, TreatyType, War } from './diplomacySystem.ts';
import type { Commander, TerrainType, UnitType } from './militarySystem.ts';
import type { Research, TechnologyBranch } from './technologySystem.ts';
import type { ResourceDeposit } from './resourceSystem.ts';
export type CountryId = string;
export type GameSpeed = 0 | 1 | 2 | 3 | 4 | 5;
export type GovernmentType = 'Parliamentary Republic' | 'Presidential Republic' | 'Semi-Presidential Republic' | 'Constitutional Monarchy' | 'Absolute Monarchy' | 'Military Junta' | 'Theocracy' | 'One-Party State' | 'Federation' | 'Tribal Government';
export type BuildingType = 'Farm' | 'Mine' | 'Factory' | 'Barracks' | 'Fort' | 'University' | 'Port' | 'Infrastructure' | 'Administration' | 'Hospital' | 'Ranch' | 'Fishery' | 'FoodProcessor' | 'IronMine' | 'CoalMine' | 'OilWell' | 'GasField' | 'Quarry' | 'RareMine' | 'Steelworks' | 'Refinery' | 'ChemicalPlant' | 'TextileMill' | 'Machinery' | 'ElectronicsPlant' | 'ArmsFactory' | 'AmmoFactory' | 'VehicleFactory' | 'MilitaryDepot' | 'RailHub' | 'TransportTerminal' | 'Warehouse' | 'PowerGrid' | 'CargoPort' | 'ResearchCenter' | 'Laboratory' | 'Embassy' | 'IntelligenceCenter' | 'CoastalFort' | 'MilitaryBase';

export interface Country {
  politicalGroups?:Record<import('./internalPolitics23.ts').PoliticalGroup,import('./internalPolitics23.ts').PoliticalGroupState>;
  politicalGroupTick?:number;politicalGroupReason?:string;
  eventReceipts?:Record<string,import('./eventTypes.ts').EventReceipt>;
  eventUnlockedFocuses?:string[];
  intelligenceLevel?:'Detailed'|'Estimate'|'Unknown';
  advisers?:Partial<Record<import('./strategy3System.ts').AdviserRole,import('./strategy3System.ts').Adviser>>;
  adviserCooldown?:number;
  vassalAutonomy?:number;
  vassalIntegration?:import('./strategy3System.ts').VassalIntegration;
  tutorialStep?:number;
  militaryCeiling?:{untilTick:number;troops:number};
  reparations?:{to:string;amount:number;untilTick:number;lastTick:number};
  nationalSpirits?:import('./focusExpansion.ts').NationalSpiritId[];
  decisions?:import('./politicalDecisions.ts').DecisionProject[];
  decisionCooldowns?:Partial<Record<import('./politicalDecisions.ts').DecisionId,number>>;
  industrialTechnologyBonus?:number;
  nationalProject?:import('./construction3System.ts').NationalProject;
  completedProjects?:import('./construction3System.ts').NationalProjectId[];
  stockpile?:import('./stockpileSystem.ts').Stockpile;
  lastResourceCrisis?:boolean;
  internationalThreat?:number;
  lastWarEndedTick?:number;
  lastAggressionTick?:number;
  crisisCooldownUntilTick?:number;
  regionalInterests?:import('./geopoliticsSystem.ts').RegionalInterests;
  reserveManpower?:number;
  militaryLosses?:number;
  mobilizationCooldownUntilTick?:number;
  doctrineCooldownUntilTick?:number;
  mobilization?:'Peacetime'|'Partial'|'General';
  armyTemplates?:import('./armyFormationSystem.ts').ArmyTemplate[];
  militaryDoctrine?:'Offensive'|'Defensive'|'Mobile'|'Logistics'|'Siege';
  aiArmyCursor?:number;
  aiStrategy?:import('./ai3System.ts').AIStrategy;
  autoPause?: import('./notificationSystem.ts').NotificationCategory[];
  notificationReadThrough?: number;
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
  scientificDiscoveries?: import('./technologyTree.ts').TechnologyId[];
  completedFocuses?:import('./focusCatalogue.ts').FocusCompletion[];
  nationalFocus?:import('./focusCatalogue.ts').FocusProject;
  taxRate?: number;
  debt?: number;
  bankruptcyUntilTick?: number;
  bankruptcyCount?: number;
  economy?: EconomyBudget;
  militaryUpkeepBase?:number;
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
  importExpense?:number;
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
  factoryAssignments?:Partial<Record<BuildingType,import('./productionSystem.ts').RecipeId>>;
  productionQueue?:import('./productionSystem.ts').ProductionOrder[];
  productionResults?:import('./productionSystem.ts').ProductionResult[];
  lastProductionTick?:number;
  specialization?:'Agriculture'|'Extraction'|'Industry'|'Research';
  secondaryDeposit?:import('./resourceSystem.ts').ResourceDeposit;
  buildingDamage?:number;
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
  materials?:import('./stockpileSystem.ts').ResourceLedger;
  id: string;
  provinceId: string;
  ownerId: CountryId;
  buildingType: BuildingType;
  targetLevel: number;
  startedTick: number;
  completeTick: number;
  cost: number;
  workDone?: number;
  workTick?: number;
}

export interface Army {
  name?:string;
  formationId?:string;
  aiRole?:'Field'|'Reserve';
  militaryPlan?:import('./ai3System.ts').MilitaryPlan;
  intelligenceLevel?:'Detailed'|'Estimate';
  formation?:import('./military3System.ts').Formation;
  escortArmyId?:string;
  composition?:import('./armyComposition.ts').Composition;
  template?:import('./armyComposition.ts').Composition;
  experience?:number;
  supply?:number;
  lastSupplyTick?:number;
  reinforcementEnabled?:boolean;
  lastReinforcementTick?:number;
  lastReinforcementCost?:number;
  retreatUntilTick?:number;
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
  countryLosses?:Record<string,number>;
  durationDays?:number;
  attackerInitial?:number;
  defenderInitial?:number;
  reasons?:string[];
  experience?:number;
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
  scenario?:import('./scenarioTypes.ts').CampaignScenario;
  events?:import('./eventTypes.ts').CampaignEvents;
  commanderTraining?:import('./militaryDevelopment.ts').CommanderTraining[];
  coalitions?:import('./geopoliticsSystem.ts').Coalition[];
  diplomaticCrises?:import('./geopoliticsSystem.ts').DiplomaticCrisis[];
  armyFormations?:import('./armyFormationSystem.ts').ArmyFormation[];
  aiDifficulty?:'Easy'|'Normal'|'Hard'|'VeryHard';
  aiMilitaryCursor?:number;
  clockNeedsReset?:boolean;
  resourceLeaderOutput?:Partial<Record<import('./resourceCatalogue.ts').ResourceType,{countryId:string;units:number}[]>>;
  fogViewerId?:string;
  chronicle?:import('./strategy3System.ts').ChronicleEntry[];
  chronicleSequence?:number;
  focusChoices?:import('./politicalDecisions.ts').FocusChoice[];
  tradeContracts?:import('./stockpileSystem.ts').ResourceContract[];
  resourcePrices?:import('./stockpileSystem.ts').ResourceLedger;
  resourceLeaders?:Partial<Record<import('./resourceCatalogue.ts').ResourceType,string[]>>;
  activeBattles?:import('./military3System.ts').ActiveBattle[];
  sieges?:import('./military3System.ts').Siege[];
  armyGroups?:import('./military3System.ts').ArmyGroup[];
  day?:number;
  simulationDay?:number;
  pauseRequests?:string[];
  notifications?: import('./notificationSystem.ts').CampaignNotification[];
  notificationSequence?: number;
  focusEvents?:import('./focusSystem.ts').FocusEvent[];
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
  | {type:'SET_CONSTRUCTION_AUTOMATION';playerId:string;enabled:boolean}
  | {type:'APPROVE_PEACE_PLAN';playerId:string;warId:string;accept:boolean}
  | {type:'SELECT_SCENARIO';playerId:string;scenarioId:string}
  | {type:'RESOLVE_GAME_EVENT';playerId:string;eventId:string;choiceId:string}
  | {type:'SET_AI_DIFFICULTY';playerId:string;difficulty:NonNullable<GameState['aiDifficulty']>}
  | {type:'SET_MOBILIZATION';playerId:string;level:NonNullable<Country['mobilization']>}
  | {type:'SET_MILITARY_DOCTRINE';playerId:string;doctrine:import('./militaryDevelopment.ts').MilitaryDoctrine}
  | {type:'TRAIN_COMMANDER';playerId:string;specialization:import('./militaryDevelopment.ts').CommanderTraining['specialization']}
  | {type:'SET_MILITARY_PLAN';playerId:string;armyId:string;provinceId:string;objective:import('./ai3System.ts').MilitaryObjective;autoCommand:boolean}
  | {type:'SET_AUTO_COMMAND';playerId:string;armyId:string;enabled:boolean}
  | {type:'RESOLVE_DIPLOMATIC_CRISIS';playerId:string;crisisId:string;resolution:import('./geopoliticsSystem.ts').CrisisResolution}
  | {type:'JOIN_COALITION';playerId:string;coalitionId:string}
  | {type:'CREATE_NEW_ARMY';playerId:string;name:string;provinceId:string;composition:import('./armyComposition.ts').Composition;commanderId:string|null}
  | {type:'CANCEL_ARMY_FORMATION';playerId:string;formationId:string}
  | {type:'SAVE_ARMY_TEMPLATE';playerId:string;templateId:string;name:string;weights:import('./armyComposition.ts').Composition}
  | {type:'RENAME_ARMY';playerId:string;armyId:string;name:string}
  | {type:'TRANSFER_REGIMENT';playerId:string;fromArmyId:string;toArmyId:string;unitType:UnitType;troops:number}
  | {type:'DECLARE_WAR_GOAL';playerId:string;targetId:string;goal:import('./strategy3System.ts').WarGoalType;provinceIds:string[]}
  | {type:'APPOINT_ADVISER';playerId:string;role:import('./strategy3System.ts').AdviserRole}
  | {type:'VASSAL_POLICY';playerId:string;targetId:string;policy:'Raise'|'Lower'|'Integrate'}
  | {type:'RESPOND_INTEGRATION';playerId:string;accept:boolean}
  | {type:'SET_TUTORIAL_STEP';playerId:string;step:number}
  | {type:'START_POLITICAL_DECISION';playerId:string;decisionId:import('./politicalDecisions.ts').DecisionId}
  | {type:'RESOLVE_FOCUS_CHOICE';playerId:string;eventId:string;choice:'Investment'|'Consensus'}
  | {type:'SET_FACTORY_PRODUCTION';playerId:string;provinceId:string;buildingType:BuildingType;recipeId:import('./productionSystem.ts').RecipeId}
  | {type:'QUEUE_PRODUCTION';playerId:string;provinceId:string;buildingType:BuildingType;recipeId:import('./productionSystem.ts').RecipeId;quantity:number}
  | {type:'CANCEL_PRODUCTION';playerId:string;provinceId:string;orderId:string}
  | {type:'SET_REGION_SPECIALIZATION';playerId:string;provinceId:string;specialization:'Agriculture'|'Extraction'|'Industry'|'Research'}
  | {type:'BULK_BUILD';playerId:string;provinceIds:string[];buildingType:BuildingType}
  | {type:'PRIORITIZE_CONSTRUCTION';playerId:string;constructionId:string}
  | {type:'REPAIR_PROVINCE';playerId:string;provinceId:string}
  | {type:'START_NATIONAL_PROJECT';playerId:string;provinceId:string;projectId:import('./construction3System.ts').NationalProjectId}
  | {type:'SET_INDUSTRY_POLICY';playerId:string;autoTrade:boolean;autoRepair:boolean;priority:'Balanced'|'Civilian'|'Military'}
  | {type:'OFFER_RESOURCE_TRADE';playerId:string;targetId:string;resource:import('./resourceCatalogue.ts').ResourceType;quantity:number;mode:'Import'|'Export'}
  | {type:'RESPOND_RESOURCE_TRADE';playerId:string;contractId:string;accept:boolean}
  | {type:'CANCEL_RESOURCE_TRADE';playerId:string;contractId:string}
  | {type:'ROUTE_ARMY';playerId:string;armyId:string;waypoints:string[];redeploy:boolean}
  | {type:'MERGE_ARMIES';playerId:string;armyIds:string[]}
  | {type:'SPLIT_ARMY';playerId:string;armyId:string;percent:number}
  | {type:'SET_FORMATION';playerId:string;armyId:string;formation:import('./military3System.ts').Formation}
  | {type:'ESCORT_ARMY';playerId:string;armyId:string;targetArmyId:string}
  | {type:'SET_ARMY_GROUP';playerId:string;armyIds:string[];name:string;objective:import('./military3System.ts').ArmyGroup['objective'];provinceId:string;supplyPriority:'Normal'|'High'}
  | {type:'ADVANCE_DAY'}
  | {type:'REQUEST_PAUSE';playerId:string}
  | {type:'VOTE_PAUSE';playerId:string;accept:boolean}
  | {type:'ACK_NOTIFICATIONS';playerId:string}
  | {type:'SET_AUTOPAUSE';playerId:string;categories:import('./notificationSystem.ts').NotificationCategory[]}
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
  | {type:'ADD_REGIMENT';playerId:string;armyId:string;unitType:UnitType;troops:number}
  | {type:'REINFORCE_ARMY';playerId:string;armyId:string}
  | {type:'ASSAULT_SIEGE';playerId:string;siegeId:string}
  | {type:'SET_REINFORCEMENT';playerId:string;armyId:string;enabled:boolean}
  | {type:'RETREAT_ARMY';playerId:string;armyId:string;provinceId:string}
  | { type: 'ASSIGN_COMMANDER'; playerId: string; armyId: string; commanderId: string }
  | {type:'START_TECHNOLOGY';playerId:string;nodeId:import('./technologyTree.ts').TechnologyId}
  | {type:'START_NATIONAL_FOCUS';playerId:string;focusId:import('./focusCatalogue.ts').FocusId}
  | {type:'CANCEL_NATIONAL_FOCUS';playerId:string}
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
