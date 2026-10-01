import type { GameState } from './gameTypes.ts';
/** Recheck every fresh CAS read, not only the initial room lookup. */
export function joinCampaign(state: GameState, playerId: string, displayName: string): GameState {
  if (state.phase !== 'lobby') throw new Error('Кампания уже началась');
  if (state.players.length >= 8) throw new Error('Комната заполнена');
  if (state.players.some(p => p.id === playerId)) throw new Error('Игрок уже в комнате');
  const next = structuredClone(state);
  next.players.push({ id: playerId, displayName, countryId: null, isHost: false, ready: false });
  return next;
}
