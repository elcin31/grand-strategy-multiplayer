import {assertFormationComposition} from './armyFormationSystem.ts';
import {WAR_GOALS} from './strategy3System.ts';
import {POLITICAL_DECISIONS} from './politicalDecisions.ts';
import {PRODUCTION_RECIPES} from './productionSystem.ts';
import {NATIONAL_PROJECTS} from './construction3System.ts';
import {RESOURCES} from './resourceCatalogue.ts';
import {NOTIFICATION_CATEGORIES} from './notificationSystem.ts';
import {technologyNode} from './technologyTree.ts';
import {focusNode} from './focusCatalogue.ts';
import { assertPeaceTerms } from './warSystem.ts';
import { TREATIES } from './diplomacySystem.ts';
import { UNITS } from './militarySystem.ts';
import { TECHNOLOGIES } from './technologySystem.ts';
import { BUILDING_TYPES } from './buildingSystem.ts';
import { assertReligion } from './religionSystem.ts';
import { assertLoanAmount, assertTaxRate } from './economySystem.ts';
import { assertDiplomaticTerms, assertDiplomaticAmount } from './diplomacy2System.ts';
import { ESPIONAGE_MISSIONS } from './espionageSystem.ts';
import {ECONOMIC_POLICIES,FUNDING_LEVELS} from './economy2System.ts';
import { GOVERNMENT_TYPES } from './governmentSystem.ts';
import type { BuildingType, GovernmentType } from './gameTypes.ts';
/** Validate JSON at both command boundaries. No client state, prices or derived economic fields are accepted. */
const fields: Record<string, readonly string[]> = {
  SET_AI_DIFFICULTY:['type','playerId','difficulty'],
  SET_MOBILIZATION:['type','playerId','level'],
  SET_MILITARY_DOCTRINE:['type','playerId','doctrine'],
  TRAIN_COMMANDER:['type','playerId','specialization'],
  SET_MILITARY_PLAN:['type','playerId','armyId','provinceId','objective','autoCommand'],
  SET_AUTO_COMMAND:['type','playerId','armyId','enabled'],
  RESOLVE_DIPLOMATIC_CRISIS:['type','playerId','crisisId','resolution'],
  JOIN_COALITION:['type','playerId','coalitionId'],
  CREATE_NEW_ARMY:['type','playerId','name','provinceId','composition','commanderId'],
  CANCEL_ARMY_FORMATION:['type','playerId','formationId'],
  SAVE_ARMY_TEMPLATE:['type','playerId','templateId','name','weights'],
  RENAME_ARMY:['type','playerId','armyId','name'],
  TRANSFER_REGIMENT:['type','playerId','fromArmyId','toArmyId','unitType','troops'],
  DECLARE_WAR_GOAL:['type','playerId','targetId','goal','provinceIds'],
  APPOINT_ADVISER:['type','playerId','role'],
  VASSAL_POLICY:['type','playerId','targetId','policy'],
  RESPOND_INTEGRATION:['type','playerId','accept'],
  SET_TUTORIAL_STEP:['type','playerId','step'],
  START_POLITICAL_DECISION:['type','playerId','decisionId'],
  RESOLVE_FOCUS_CHOICE:['type','playerId','eventId','choice'],
  SET_FACTORY_PRODUCTION:['type','playerId','provinceId','buildingType','recipeId'],
  QUEUE_PRODUCTION:['type','playerId','provinceId','buildingType','recipeId','quantity'],
  CANCEL_PRODUCTION:['type','playerId','provinceId','orderId'],
  SET_REGION_SPECIALIZATION:['type','playerId','provinceId','specialization'],
  BULK_BUILD:['type','playerId','provinceIds','buildingType'],
  PRIORITIZE_CONSTRUCTION:['type','playerId','constructionId'],
  REPAIR_PROVINCE:['type','playerId','provinceId'],
  START_NATIONAL_PROJECT:['type','playerId','provinceId','projectId'],
  SET_INDUSTRY_POLICY:['type','playerId','autoTrade','autoRepair','priority'],
  OFFER_RESOURCE_TRADE:['type','playerId','targetId','resource','quantity','mode'],
  RESPOND_RESOURCE_TRADE:['type','playerId','contractId','accept'],
  CANCEL_RESOURCE_TRADE:['type','playerId','contractId'],
  ROUTE_ARMY:['type','playerId','armyId','waypoints','redeploy'],
  MERGE_ARMIES:['type','playerId','armyIds'],
  SPLIT_ARMY:['type','playerId','armyId','percent'],
  SET_FORMATION:['type','playerId','armyId','formation'],
  ESCORT_ARMY:['type','playerId','armyId','targetArmyId'],
  SET_ARMY_GROUP:['type','playerId','armyIds','name','objective','provinceId','supplyPriority'],
  ADVANCE_DAY:['type'],
  REQUEST_PAUSE:['type','playerId'],
  VOTE_PAUSE:['type','playerId','accept'],
  ACK_NOTIFICATIONS:['type','playerId'],
  SET_AUTOPAUSE:['type','playerId','categories'],
  SET_ECONOMIC_POLICY: ['type','playerId','policy'],
  SET_FUNDING: ['type','playerId','domain','level'],
  QUEUE_BUILD: ['type','playerId','provinceId','buildingType'],
  CANCEL_CONSTRUCTION: ['type','playerId','constructionId'],
  START_ESPIONAGE: ['type','playerId','targetId','kind'],
  CANCEL_ESPIONAGE: ['type','playerId','missionId'],
  SET_TAX_RATE: ['type', 'playerId', 'taxRate'],
  BORROW: ['type', 'playerId', 'amount'],
  REPAY_DEBT: ['type', 'playerId', 'amount'],
  PACIFY_PROVINCE: ['type','playerId','provinceId'],
  SUPPRESS_REBELLION: ['type','playerId','provinceId'],
  PROPOSE_PEACE: ['type','playerId','warId','terms'],
  RESPOND_PEACE: ['type','playerId','warId','accept'],
  DIPLOMATIC_ACTION: ['type','playerId','targetId','action'],
  START_RELATION_MISSION: ['type','playerId','targetId','kind'],
  CANCEL_RELATION_MISSION: ['type','playerId','missionId'],
  SEND_GIFT: ['type','playerId','targetId','amount'],
  SEND_INSULT: ['type','playerId','targetId'],
  OFFER_DIPLOMACY: ['type','playerId','targetId','terms'],
  RESPOND_DIPLOMACY: ['type','playerId','offerId','accept'],
  TERMINATE_TREATY: ['type','playerId','targetId','treatyId'],
  OFFER_TREATY: ['type','playerId','targetId','treaty'],
  RESPOND_TREATY: ['type','playerId','targetId','accept'],
  DECLARE_WAR: ['type','playerId','targetId'],
  ADD_REGIMENT:['type','playerId','armyId','unitType','troops'],
  REINFORCE_ARMY:['type','playerId','armyId'],
  ASSAULT_SIEGE:['type','playerId','siegeId'],
  SET_REINFORCEMENT:['type','playerId','armyId','enabled'],
  RETREAT_ARMY:['type','playerId','armyId','provinceId'],
  RECRUIT_UNIT: ['type','playerId','provinceId','troops','unitType'],
  ASSIGN_COMMANDER: ['type','playerId','armyId','commanderId'],
  START_TECHNOLOGY:['type','playerId','nodeId'],
  START_NATIONAL_FOCUS:['type','playerId','focusId'],
  CANCEL_NATIONAL_FOCUS:['type','playerId'],
  START_RESEARCH: ['type', 'playerId', 'branch'],
  BUILD: ['type', 'playerId', 'provinceId', 'buildingType'],
  SELECT_COUNTRY: ['type', 'playerId', 'countryId'],
  SET_READY: ['type', 'playerId', 'ready'],
  START_GAME: ['type', 'playerId'],
  SET_SPEED: ['type', 'playerId', 'speed'],
  RECRUIT: ['type', 'playerId', 'provinceId', 'troops'],
  CANCEL_ARMY_ORDER: ['type','playerId','armyId'],
  ORDER_ARMY: ['type','playerId','armyId','provinceId'],
  MOVE_ARMY: ['type', 'playerId', 'armyId', 'provinceId'],
  ADVANCE_TICK: ['type'],
  CHANGE_RELIGION: ['type', 'playerId', 'religionId'],
  CHANGE_GOVERNMENT: ['type', 'playerId', 'governmentType'],
};
export function assertGameCommand(input: unknown, countryIds: readonly string[]): void {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid command payload');
  const command = input as Record<string, unknown>;
  const type = command.type;
  if (typeof type !== 'string' || !Object.hasOwn(fields, type)) throw new Error('Unknown command');
  const allowed = fields[type]!;
  if (Object.keys(command).some(key => !allowed.includes(key)) || allowed.some(key => !Object.hasOwn(command, key))) throw new Error('Invalid command fields');
  for (const key of ['playerId', 'provinceId', 'armyId', 'commanderId', 'warId','missionId','offerId','treatyId','constructionId','contractId','orderId','formationId','fromArmyId','toArmyId','templateId','crisisId','coalitionId']) {
    // Natural Earth retains literal '+' and '?' in a few province IDs. Ownership
    // and exact membership are still checked by the authoritative reducer.
    if(type==='CREATE_NEW_ARMY'&&key==='commanderId'&&command[key]===null)continue;
    const pattern = key === 'provinceId' ? /^[A-Za-z0-9_+?-]{1,128}$/ : /^[A-Za-z0-9_-]{1,128}$/;
    if (allowed.includes(key) && (typeof command[key] !== 'string' || !pattern.test(command[key] as string))) throw new Error('Invalid command identifier');
  }
  if(type==='SET_AI_DIFFICULTY'&&!['Easy','Normal','Hard','VeryHard'].includes(command.difficulty as string))throw Error('Invalid AI difficulty');
  if(type==='SET_MOBILIZATION'&&!['Peacetime','Partial','General'].includes(command.level as string))throw Error('Invalid mobilization');
  if(type==='SET_MILITARY_DOCTRINE'&&!['Offensive','Defensive','Mobile','Logistics','Siege'].includes(command.doctrine as string))throw Error('Invalid military doctrine');
  if(type==='TRAIN_COMMANDER'&&!['Offense','Defense','Logistics','Siege'].includes(command.specialization as string))throw Error('Invalid commander specialization');
  if(type==='SET_MILITARY_PLAN'&&(!['Capture','Defend','Border','Capital','Support','Reserve'].includes(command.objective as string)||typeof command.autoCommand!=='boolean'))throw Error('Invalid military plan');
  if(type==='SET_AUTO_COMMAND'&&typeof command.enabled!=='boolean')throw Error('Invalid auto command');
  if(type==='RESOLVE_DIPLOMATIC_CRISIS'&&!['Negotiate','Concede','Mobilize','StandFirm'].includes(command.resolution as string))throw Error('Invalid crisis response');
  if(['CREATE_NEW_ARMY','RENAME_ARMY','SAVE_ARMY_TEMPLATE'].includes(type)&&(typeof command.name!=='string'||command.name.trim().length<1||command.name.length>48||/[\u0000-\u001f]/.test(command.name)))throw Error('Недопустимое название армии');
  if(type==='CREATE_NEW_ARMY')assertFormationComposition(command.composition);
  if(type==='SAVE_ARMY_TEMPLATE'&&(!command.weights||typeof command.weights!=='object'||Array.isArray(command.weights)||!Object.keys(command.weights).length||Object.entries(command.weights).some(([t,n])=>!Object.hasOwn(UNITS,t)||!Number.isSafeInteger(n)||Number(n)<1||Number(n)>1000)))throw Error('Недопустимый шаблон');
  if (allowed.includes('targetId') && (typeof command.targetId !== 'string' || !countryIds.includes(command.targetId))) throw new Error('Unknown target country');
  if (type === 'DIPLOMATIC_ACTION' && !['Improve','Rival','Guarantee','Cancel'].includes(command.action as string)) throw new Error('Invalid diplomacy action');
  if (type === 'START_RELATION_MISSION' && !['Improve','Damage'].includes(command.kind as string)) throw new Error('Invalid relation mission');
  if (type === 'START_ESPIONAGE' && (typeof command.kind!=='string'||!Object.hasOwn(ESPIONAGE_MISSIONS,command.kind))) throw new Error('Invalid espionage kind');
  if (type === 'SEND_GIFT') assertDiplomaticAmount(command.amount,false);
  if (type === 'OFFER_DIPLOMACY') assertDiplomaticTerms(command.terms,countryIds);
  if (type === 'OFFER_TREATY' && (typeof command.treaty !== 'string' || !Object.hasOwn(TREATIES,command.treaty))) throw new Error('Invalid treaty type');
  if (type === 'PROPOSE_PEACE') assertPeaceTerms(command.terms);
  if ((type==='VOTE_PAUSE'||type === 'RESPOND_TREATY' || type === 'RESPOND_PEACE' || type === 'RESPOND_DIPLOMACY') && typeof command.accept !== 'boolean') throw new Error('Invalid treaty response');
  if(type==='ASSAULT_SIEGE'&&(typeof command.siegeId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(command.siegeId)))throw Error('Invalid siege identifier');
  if (type === 'SELECT_COUNTRY' && (typeof command.countryId !== 'string' || !countryIds.includes(command.countryId))) throw new Error('Unknown country');
  if (type === 'SET_TAX_RATE') assertTaxRate(command.taxRate);
  if(type==='SET_ECONOMIC_POLICY'&&(typeof command.policy!=='string'||!Object.hasOwn(ECONOMIC_POLICIES,command.policy)))throw Error('Invalid economic policy');
  if(type==='SET_FUNDING'&&(!['Research','Military'].includes(command.domain as string)||typeof command.level!=='string'||!Object.hasOwn(FUNDING_LEVELS,command.level)))throw Error('Invalid funding');
  if (type === 'BORROW' || type === 'REPAY_DEBT') assertLoanAmount(command.amount);
  if ((type === 'RECRUIT_UNIT'||type==='ADD_REGIMENT'||type==='TRANSFER_REGIMENT') && (typeof command.unitType !== 'string' || !Object.hasOwn(UNITS, command.unitType))) throw new Error('Invalid unit type');
  if(type==='START_TECHNOLOGY'&&(typeof command.nodeId!=='string'||!technologyNode(command.nodeId)))throw Error('Invalid named technology');
  if(type==='START_NATIONAL_FOCUS'&&(typeof command.focusId!=='string'||!focusNode(command.focusId)))throw Error('Invalid national course');
  if (type === 'START_RESEARCH' && (typeof command.branch !== 'string' || !Object.hasOwn(TECHNOLOGIES, command.branch))) throw new Error('Invalid research branch');
  if ((type === 'BUILD'||type==='QUEUE_BUILD'||type==='BULK_BUILD'||type==='SET_FACTORY_PRODUCTION'||type==='QUEUE_PRODUCTION') && (typeof command.buildingType !== 'string' || !BUILDING_TYPES.includes(command.buildingType as BuildingType))) throw new Error('Invalid building type');
  if (type === 'CHANGE_RELIGION') assertReligion(command.religionId);
  if (type === 'CHANGE_GOVERNMENT' && (typeof command.governmentType !== 'string' || !GOVERNMENT_TYPES.includes(command.governmentType as GovernmentType))) throw new Error('Invalid government type');
  if(type==='SET_REINFORCEMENT'&&typeof command.enabled!=='boolean')throw Error('Invalid reinforcement toggle');
  if(type==='SET_AUTOPAUSE'&&(!Array.isArray(command.categories)||command.categories.length>8||new Set(command.categories).size!==command.categories.length||command.categories.some(x=>typeof x!=='string'||!Object.hasOwn(NOTIFICATION_CATEGORIES,x))))throw Error('Invalid autopause categories');
  for(const key of ['armyIds','waypoints'])if(allowed.includes(key)&&(!Array.isArray(command[key])||(command[key] as unknown[]).length<1||(command[key] as unknown[]).length>(key==='armyIds'?20:12)||new Set(command[key] as unknown[]).size!==(command[key] as unknown[]).length||(command[key] as unknown[]).some(id=>typeof id!=='string'||!/^[A-Za-z0-9_+?-]{1,128}$/.test(id))))throw Error('Invalid military list');
  if(type==='SPLIT_ARMY'&&![25,50,75].includes(command.percent as number))throw Error('Invalid split');
  if(type==='ROUTE_ARMY'&&typeof command.redeploy!=='boolean')throw Error('Invalid redeployment');
  if(type==='SET_FORMATION'&&!['Balanced','Assault','Defensive','Mobile'].includes(command.formation as string))throw Error('Invalid formation');
  if(type==='ESCORT_ARMY'&&(typeof command.targetArmyId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(command.targetArmyId)))throw Error('Invalid escort');
  if(type==='SET_ARMY_GROUP'&&(typeof command.name!=='string'||command.name.length<1||command.name.length>40||!['Defend','Offensive','Reserve','Escort'].includes(command.objective as string)||!['Normal','High'].includes(command.supplyPriority as string)))throw Error('Invalid army group');
  if(type==='SET_INDUSTRY_POLICY'&&(typeof command.autoTrade!=='boolean'||typeof command.autoRepair!=='boolean'||!['Balanced','Civilian','Military'].includes(command.priority as string)))throw Error('Invalid industry policy');
  if(type==='OFFER_RESOURCE_TRADE'&&(typeof command.resource!=='string'||!Object.hasOwn(RESOURCES,command.resource)||!Number.isInteger(command.quantity)||Number(command.quantity)<1||Number(command.quantity)>10000||!['Import','Export'].includes(command.mode as string)))throw Error('Invalid resource trade');
  if(type==='RESPOND_RESOURCE_TRADE'&&typeof command.accept!=='boolean')throw Error('Invalid trade consent');
  if((type==='BULK_BUILD'||type==='DECLARE_WAR_GOAL')&&(!Array.isArray(command.provinceIds)||command.provinceIds.length<(type==='BULK_BUILD'?1:0)||command.provinceIds.length>12||new Set(command.provinceIds).size!==command.provinceIds.length||command.provinceIds.some(id=>typeof id!=='string'||!/^[A-Za-z0-9_+?-]{1,128}$/.test(id))))throw Error('Invalid bulk construction');
  if(type==='START_NATIONAL_PROJECT'&&(typeof command.projectId!=='string'||!Object.hasOwn(NATIONAL_PROJECTS,command.projectId)))throw Error('Invalid national project');
  if(['SET_FACTORY_PRODUCTION','QUEUE_PRODUCTION'].includes(type)&&(typeof command.recipeId!=='string'||!Object.hasOwn(PRODUCTION_RECIPES,command.recipeId)))throw Error('Invalid production recipe');
  if(type==='QUEUE_PRODUCTION'&&(!Number.isInteger(command.quantity)||Number(command.quantity)<1||Number(command.quantity)>10000))throw Error('Invalid production quantity');
  if(type==='SET_REGION_SPECIALIZATION'&&!['Agriculture','Extraction','Industry','Research'].includes(command.specialization as string))throw Error('Invalid regional specialization');
  if(type==='START_POLITICAL_DECISION'&&(typeof command.decisionId!=='string'||!Object.hasOwn(POLITICAL_DECISIONS,command.decisionId)))throw Error('Invalid political decision');
  if(type==='RESOLVE_FOCUS_CHOICE'&&(typeof command.eventId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(command.eventId)||!['Investment','Consensus'].includes(command.choice as string)))throw Error('Invalid focus choice');
  if(type==='DECLARE_WAR_GOAL'&&(typeof command.goal!=='string'||!Object.hasOwn(WAR_GOALS,command.goal)))throw Error('Invalid war goal');
  if(type==='APPOINT_ADVISER'&&!['Economy','Military','Diplomacy','Science'].includes(command.role as string))throw Error('Invalid adviser');
  if(type==='VASSAL_POLICY'&&!['Raise','Lower','Integrate'].includes(command.policy as string))throw Error('Invalid vassal policy');
  if(type==='RESPOND_INTEGRATION'&&typeof command.accept!=='boolean')throw Error('Invalid integration response');
  if(type==='SET_TUTORIAL_STEP'&&(!Number.isInteger(command.step)||Number(command.step)<0||Number(command.step)>8))throw Error('Invalid tutorial step');
  if (type === 'SET_READY' && typeof command.ready !== 'boolean') throw new Error('Invalid ready value');
  if (type === 'SET_SPEED' && (typeof command.speed !== 'number' || !Number.isInteger(command.speed) || command.speed < 0 || command.speed > 5)) throw new Error('Invalid game speed');
  if ((type === 'RECRUIT' || type === 'RECRUIT_UNIT'||type==='ADD_REGIMENT'||type==='TRANSFER_REGIMENT') && (typeof command.troops !== 'number' || !Number.isSafeInteger(command.troops) || command.troops < 1000 || command.troops > 100000)) throw new Error('Invalid recruitment amount');
}
