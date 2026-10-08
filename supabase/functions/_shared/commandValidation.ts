import { assertPeaceTerms } from './warSystem.ts';
import { TREATIES } from './diplomacySystem.ts';
import { UNITS } from './militarySystem.ts';
import { TECHNOLOGIES } from './technologySystem.ts';
import { BUILDING_TYPES } from './buildingSystem.ts';
import { assertReligion } from './religionSystem.ts';
import { assertLoanAmount, assertTaxRate } from './economySystem.ts';
import { GOVERNMENT_TYPES } from './governmentSystem.ts';
import type { BuildingType, GovernmentType } from './gameTypes.ts';
/** Validate JSON at both command boundaries. No client state, prices or derived economic fields are accepted. */
const fields: Record<string, readonly string[]> = {
  SET_TAX_RATE: ['type', 'playerId', 'taxRate'],
  BORROW: ['type', 'playerId', 'amount'],
  REPAY_DEBT: ['type', 'playerId', 'amount'],
  PACIFY_PROVINCE: ['type','playerId','provinceId'],
  SUPPRESS_REBELLION: ['type','playerId','provinceId'],
  PROPOSE_PEACE: ['type','playerId','warId','terms'],
  RESPOND_PEACE: ['type','playerId','warId','accept'],
  DIPLOMATIC_ACTION: ['type','playerId','targetId','action'],
  OFFER_TREATY: ['type','playerId','targetId','treaty'],
  RESPOND_TREATY: ['type','playerId','targetId','accept'],
  DECLARE_WAR: ['type','playerId','targetId'],
  RECRUIT_UNIT: ['type','playerId','provinceId','troops','unitType'],
  ASSIGN_COMMANDER: ['type','playerId','armyId','commanderId'],
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
  for (const key of ['playerId', 'provinceId', 'armyId', 'commanderId', 'warId']) {
    // Natural Earth retains literal '+' and '?' in a few province IDs. Ownership
    // and exact membership are still checked by the authoritative reducer.
    const pattern = key === 'provinceId' ? /^[A-Za-z0-9_+?-]{1,128}$/ : /^[A-Za-z0-9_-]{1,128}$/;
    if (allowed.includes(key) && (typeof command[key] !== 'string' || !pattern.test(command[key] as string))) throw new Error('Invalid command identifier');
  }
  if (allowed.includes('targetId') && (typeof command.targetId !== 'string' || !countryIds.includes(command.targetId))) throw new Error('Unknown target country');
  if (type === 'DIPLOMATIC_ACTION' && !['Improve','Rival','Guarantee','Cancel'].includes(command.action as string)) throw new Error('Invalid diplomacy action');
  if (type === 'OFFER_TREATY' && (typeof command.treaty !== 'string' || !Object.hasOwn(TREATIES,command.treaty))) throw new Error('Invalid treaty type');
  if (type === 'PROPOSE_PEACE') assertPeaceTerms(command.terms);
  if ((type === 'RESPOND_TREATY' || type === 'RESPOND_PEACE') && typeof command.accept !== 'boolean') throw new Error('Invalid treaty response');
  if (type === 'SELECT_COUNTRY' && (typeof command.countryId !== 'string' || !countryIds.includes(command.countryId))) throw new Error('Unknown country');
  if (type === 'SET_TAX_RATE') assertTaxRate(command.taxRate);
  if (type === 'BORROW' || type === 'REPAY_DEBT') assertLoanAmount(command.amount);
  if (type === 'RECRUIT_UNIT' && (typeof command.unitType !== 'string' || !Object.hasOwn(UNITS, command.unitType))) throw new Error('Invalid unit type');
  if (type === 'START_RESEARCH' && (typeof command.branch !== 'string' || !Object.hasOwn(TECHNOLOGIES, command.branch))) throw new Error('Invalid research branch');
  if (type === 'BUILD' && (typeof command.buildingType !== 'string' || !BUILDING_TYPES.includes(command.buildingType as BuildingType))) throw new Error('Invalid building type');
  if (type === 'CHANGE_RELIGION') assertReligion(command.religionId);
  if (type === 'CHANGE_GOVERNMENT' && (typeof command.governmentType !== 'string' || !GOVERNMENT_TYPES.includes(command.governmentType as GovernmentType))) throw new Error('Invalid government type');
  if (type === 'SET_READY' && typeof command.ready !== 'boolean') throw new Error('Invalid ready value');
  if (type === 'SET_SPEED' && (typeof command.speed !== 'number' || !Number.isInteger(command.speed) || command.speed < 0 || command.speed > 4)) throw new Error('Invalid game speed');
  if ((type === 'RECRUIT' || type === 'RECRUIT_UNIT') && (typeof command.troops !== 'number' || !Number.isSafeInteger(command.troops) || command.troops < 1000 || command.troops > 100000)) throw new Error('Invalid recruitment amount');
}
