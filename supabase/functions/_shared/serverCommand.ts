import { applyCommand } from './gameEngine.ts';
import type { GameCommand, GameState } from './gameTypes.ts';

/** Production server-authority boundary, intentionally independent of legacy fixture data. */
export function applyServerCommand(state: GameState, command: GameCommand, actorId: string): GameState {
  const actor = state.players.find((player) => player.id === actorId);
  if (!actor) throw new Error('Игрок не найден');
  if (command && typeof command === 'object' && 'playerId' in command && command.playerId !== actorId) throw new Error('Подмена игрока отклонена');
  if(command?.type==='ADVANCE_DAY')throw Error('Игровое время рассчитывается сервером');
  // A new retry id may arrive after an accepted START response was lost.
  // Authenticate the host before returning the already launched state.
  if(command?.type==='START_GAME'&&state.phase!=='lobby'){
    if(!actor.isHost)throw Error('Только хост может начать игру');
    return state;
  }
  if (command?.type === 'ADVANCE_TICK' && !actor.isHost) throw new Error('Только хост двигает игровой clock');
  return applyCommand(state, command);
}
