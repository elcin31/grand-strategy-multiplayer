import { applyCommand } from './gameEngine.ts';
import type { GameCommand, GameState } from './gameTypes.ts';

/** Production server-authority boundary, intentionally independent of legacy fixture data. */
export function applyServerCommand(state: GameState, command: GameCommand, actorId: string): GameState {
  const actor = state.players.find((player) => player.id === actorId);
  if (!actor) throw new Error('Игрок не найден');
  if (command && typeof command === 'object' && 'playerId' in command && command.playerId !== actorId) throw new Error('Подмена игрока отклонена');
  if (command?.type === 'ADVANCE_TICK' && !actor.isHost) throw new Error('Только хост двигает игровой clock');
  return applyCommand(state, command);
}
