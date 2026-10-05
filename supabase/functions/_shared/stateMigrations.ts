import { initializeAI } from './aiSystem.ts';
import { initializeStability } from './stabilitySystem.ts';
import { initializeWars } from './warSystem.ts';
import { initializeDiplomacy } from './diplomacySystem.ts';
import { initializeMilitary } from './militarySystem.ts';
import { initializeTechnology } from './technologySystem.ts';
import { initializeBuildings } from './buildingSystem.ts';
import type { GameState } from './gameTypes.ts';

export const CURRENT_STATE_VERSION = 8;

/** Explicit modern-world state migrations. Legacy prototype saves keep their original schema/rules. */
export function normalizeGameState(state: GameState): void {
  if (!state.dataset) return;
  const version = state.stateVersion ?? 1;
  if (!Number.isSafeInteger(version) || version < 1 || version > CURRENT_STATE_VERSION) throw new Error('Unsupported campaign state version');
  initializeBuildings(state);
  initializeTechnology(state);
  initializeMilitary(state);
  initializeDiplomacy(state);
  initializeWars(state);
  initializeStability(state);
  initializeAI(state);
  state.stateVersion = CURRENT_STATE_VERSION;
}
