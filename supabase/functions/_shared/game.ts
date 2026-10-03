import { createInitialGame } from './legacyWorld.ts';
import type { GameState } from './gameTypes.ts';
export * from './gameTypes.ts';
export { applyServerCommand } from './serverCommand.ts';
export type { GameSpeed as Speed } from './gameTypes.ts';

/** Retained for legacy fixtures; production world creation uses worldState.ts. */
export function createInitialState(gameId: string, roomCode: string, playerId: string, displayName: string): GameState {
  const state = createInitialGame(roomCode);
  state.id = gameId;
  state.players[0]!.id = playerId;
  state.players[0]!.displayName = displayName;
  return state;
}
