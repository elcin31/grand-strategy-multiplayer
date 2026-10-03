import { initializeBuildings } from './buildingSystem.ts';
import type { GameState } from './gameTypes.ts';

export const CURRENT_STATE_VERSION = 2;

/** Explicit modern-world state migrations. Legacy prototype saves keep their original schema/rules. */
export function normalizeGameState(state: GameState): void {
  if (!state.dataset) return;
  const version = state.stateVersion ?? 1;
  if (!Number.isSafeInteger(version) || version < 1 || version > CURRENT_STATE_VERSION) throw new Error('Unsupported campaign state version');
  if (version === 1) {
    initializeBuildings(state);
    state.stateVersion = 2;
  } else initializeBuildings(state);
}
