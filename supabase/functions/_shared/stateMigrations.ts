import {validateArmyOrders} from './armyOrders.ts';
import {initializeMovements} from './movementHistory.ts';
import { initializeAI } from './aiSystem.ts';
import { initializeStability } from './stabilitySystem.ts';
import { initializeWars } from './warSystem.ts';
import { initializeDiplomacy } from './diplomacySystem.ts';
import { initializeMilitary } from './militarySystem.ts';
import { initializeTechnology } from './technologySystem.ts';
import { initializeBuildings } from './buildingSystem.ts';
import type { GameState } from './gameTypes.ts';

export const CURRENT_STATE_VERSION = 11;

/** Ordered schema migrations; every normalizer is also run as validation for current saves. */
export function migrateV1ToV2(s:GameState){initializeBuildings(s);}
export function migrateV2ToV3(s:GameState){initializeTechnology(s);}
export function migrateV3ToV4(s:GameState){initializeMilitary(s);}
export function migrateV4ToV5(s:GameState){initializeDiplomacy(s);}
export function migrateV5ToV6(s:GameState){initializeWars(s);}
export function migrateV6ToV7(s:GameState){initializeStability(s);}
export function migrateV7ToV8(s:GameState){initializeAI(s);}
export function migrateV8ToV9(s:GameState){for(const p of s.players){p.connected??=true;p.aiControlled??=false;p.lastSeen??=0;if(typeof p.connected!=='boolean'||typeof p.aiControlled!=='boolean'||!Number.isFinite(p.lastSeen)||p.lastSeen<0)throw Error('Invalid player presence');}}
export function migrateV9ToV10(s:GameState){initializeMovements(s);}
const migrations=[migrateV1ToV2,migrateV2ToV3,migrateV3ToV4,migrateV4ToV5,migrateV5ToV6,migrateV6ToV7,migrateV7ToV8,migrateV8ToV9,migrateV9ToV10];
export function normalizeGameState(state:GameState):void {
 if(!state.dataset)return;
 if(state.dataset!=='modern-world-v2')throw Error('Эта кампания использует карту v3. Откройте её в v3; для карты v4 создайте новую кампанию. Старое сохранение не изменено.');
 const version=state.stateVersion??1;
 if(!Number.isSafeInteger(version)||version<1||version>CURRENT_STATE_VERSION)throw Error('Unsupported campaign state version');
 for(let i=0;i<migrations.length;i++){migrations[i]!(state);if(version<=i+1)state.stateVersion=i+2;}
 validateArmyOrders(state);
 state.stateVersion=CURRENT_STATE_VERSION;
}
