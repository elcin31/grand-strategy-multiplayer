import {traceStartup} from '../performance/startupTrace';
import {cloneGameState} from '../../supabase/functions/_shared/cloneGameState';
import {recordMetrics} from '../performance/telemetry';
import { createWorldStateAsync } from '../../supabase/functions/_shared/worldState';
import { applyCommand } from '../engine/gameEngine';
import { GameCommand, GameState } from '../types/game';
import { MultiplayerTransport, TransportSession, Unsubscribe } from './transport';

const listeners = new Map<string, Set<(state: GameState) => void>>();
const rooms = new Map<string, GameState>();
const randomCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();
const emit = (state: GameState) => listeners.get(state.id)?.forEach((listener) => listener(cloneGameState(state)));

export class LocalTransport implements MultiplayerTransport {
  private readonly playerIds = new Map<string, string>();

  async restore(state: GameState): Promise<TransportSession> {
    const {validateCampaign}=await import('../persistence/campaignCodec');
    const restored=validateCampaign(state);const playerId=restored.players[0]!.id;
    rooms.set(restored.id,restored);this.playerIds.set(restored.id,playerId);
    return {state:cloneGameState(restored),playerId};
  }

  async createRoom(displayName: string): Promise<TransportSession> {
    const roomCode = randomCode();
    const state = await createWorldStateAsync('game-'+roomCode.toLowerCase(), roomCode, 'local-player', displayName.trim() || 'Игрок 1',stage=>traceStartup(stage));
    state.players[0]!.displayName = displayName.trim() || 'Игрок 1';
    rooms.set(state.id, state);
    this.playerIds.set(state.id, 'local-player');
    return { state: cloneGameState(state), playerId: 'local-player' };
  }

  async joinRoom(roomCode: string, displayName: string): Promise<TransportSession> {
    const normalized = roomCode.trim().toUpperCase();
    const state = [...rooms.values()].find((candidate) => candidate.roomCode === normalized);
    if (!state) throw new Error('Комната не найдена в локальном прототипе');
    const playerId = `player-${state.players.length + 1}`;
    state.players.push({ id: playerId, displayName: displayName.trim() || `Игрок ${state.players.length + 1}`, countryId: null, isHost: false, ready: false });
    this.playerIds.set(state.id, playerId);
    emit(state);
    return { state: cloneGameState(state), playerId };
  }

  async sendCommand(gameId: string, command: GameCommand): Promise<void> {
    const state = rooms.get(gameId);
    if (!state) throw new Error('Комната не существует');
    const started=performance.now();
    const next = applyCommand(state, command, true);
    if(command.type==='ADVANCE_TICK')recordMetrics({simulationMs:performance.now()-started});
    rooms.set(gameId, next);
    emit(next);
  }

  subscribe(gameId: string, onState: (state: GameState) => void): Unsubscribe {
    const roomListeners = listeners.get(gameId) ?? new Set<(state: GameState) => void>();
    roomListeners.add(onState);
    listeners.set(gameId, roomListeners);
    return () => {roomListeners.delete(onState);if(roomListeners.size===0)listeners.delete(gameId);};
  }

  async leave(gameId: string): Promise<void> {
    listeners.delete(gameId);
    this.playerIds.delete(gameId);
    rooms.delete(gameId);
  }
}
