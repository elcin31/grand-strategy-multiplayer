import { createInitialGame } from '../data/world';
import { applyCommand } from '../engine/gameEngine';
import { GameCommand, GameState } from '../types/game';
import { MultiplayerTransport, TransportSession, Unsubscribe } from './transport';

const listeners = new Map<string, Set<(state: GameState) => void>>();
const rooms = new Map<string, GameState>();
const randomCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();
const emit = (state: GameState) => listeners.get(state.id)?.forEach((listener) => listener(structuredClone(state)));

export class LocalTransport implements MultiplayerTransport {
  private readonly playerIds = new Map<string, string>();

  async createRoom(displayName: string): Promise<TransportSession> {
    const roomCode = randomCode();
    const state = createInitialGame(roomCode);
    state.players[0]!.displayName = displayName.trim() || 'Игрок 1';
    rooms.set(state.id, state);
    this.playerIds.set(state.id, 'local-player');
    return { state: structuredClone(state), playerId: 'local-player' };
  }

  async joinRoom(roomCode: string, displayName: string): Promise<TransportSession> {
    const normalized = roomCode.trim().toUpperCase();
    const state = [...rooms.values()].find((candidate) => candidate.roomCode === normalized);
    if (!state) throw new Error('Комната не найдена в локальном прототипе');
    const playerId = `player-${state.players.length + 1}`;
    state.players.push({ id: playerId, displayName: displayName.trim() || `Игрок ${state.players.length + 1}`, countryId: null, isHost: false, ready: false });
    this.playerIds.set(state.id, playerId);
    emit(state);
    return { state: structuredClone(state), playerId };
  }

  async sendCommand(gameId: string, command: GameCommand): Promise<void> {
    const state = rooms.get(gameId);
    if (!state) throw new Error('Комната не существует');
    const next = applyCommand(state, command);
    rooms.set(gameId, next);
    emit(next);
  }

  subscribe(gameId: string, onState: (state: GameState) => void): Unsubscribe {
    const roomListeners = listeners.get(gameId) ?? new Set<(state: GameState) => void>();
    roomListeners.add(onState);
    listeners.set(gameId, roomListeners);
    return () => roomListeners.delete(onState);
  }

  async leave(gameId: string): Promise<void> {
    listeners.delete(gameId);
    this.playerIds.delete(gameId);
  }
}
