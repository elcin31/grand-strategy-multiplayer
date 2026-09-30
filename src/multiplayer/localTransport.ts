import { createInitialGame } from '../data/world';
import { applyCommand } from '../engine/gameEngine';
import { GameCommand, GameState } from '../types/game';
import { MultiplayerTransport, Unsubscribe } from './transport';

const listeners = new Map<string, Set<(state: GameState) => void>>();
const rooms = new Map<string, GameState>();
const randomCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();
const emit = (state: GameState) => listeners.get(state.id)?.forEach((listener) => listener(structuredClone(state)));

export class LocalTransport implements MultiplayerTransport {
  async createRoom(displayName: string): Promise<GameState> {
    const roomCode = randomCode();
    const state = createInitialGame(roomCode);
    state.players[0]!.displayName = displayName.trim() || 'Игрок 1';
    rooms.set(state.id, state);
    return structuredClone(state);
  }

  async joinRoom(roomCode: string, displayName: string): Promise<GameState> {
    const normalized = roomCode.trim().toUpperCase();
    const state = [...rooms.values()].find((candidate) => candidate.roomCode === normalized);
    if (!state) throw new Error('Комната не найдена в локальном прототипе');
    state.players.push({ id: `player-${state.players.length + 1}`, displayName: displayName.trim() || `Игрок ${state.players.length + 1}`, countryId: null, isHost: false, ready: false });
    emit(state);
    return structuredClone(state);
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

  async leave(gameId: string): Promise<void> { listeners.delete(gameId); }
}
