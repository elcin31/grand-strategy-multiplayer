import { createInitialGame } from './legacyWorld.ts';
import { applyCommand } from './gameEngine.ts';
import type { GameCommand, GameState } from './gameTypes.ts';
export * from './gameTypes.ts';
export type { GameSpeed as Speed } from './gameTypes.ts';

/** Retained for legacy fixtures; production world creation uses worldState.ts. */
export function createInitialState(gameId: string, roomCode: string, playerId: string, displayName: string): GameState {
  const state = createInitialGame(roomCode);
  state.id = gameId;
  state.players[0]!.id = playerId;
  state.players[0]!.displayName = displayName;
  return state;
}
export function applyServerCommand(state: GameState, command: GameCommand, actorId: string): GameState {
  const actor = state.players.find(p => p.id === actorId);
  if (!actor) throw new Error('Игрок не найден');
  if (command && typeof command === 'object' && 'playerId' in command && command.playerId !== actorId) throw new Error('Подмена игрока отклонена');
  if (command?.type === 'ADVANCE_TICK' && !actor.isHost) throw new Error('Только хост двигает игровой clock');
  return applyCommand(state, command);
}
