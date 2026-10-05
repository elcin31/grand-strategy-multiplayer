import { GameCommand, GameState } from '../types/game';

export type Unsubscribe = () => void;

export interface TransportSession {
  state: GameState;
  playerId: string;
}

export interface MultiplayerTransport {
  createRoom(displayName: string): Promise<TransportSession>;
  joinRoom(roomCode: string, displayName: string): Promise<TransportSession>;
  sendCommand(gameId: string, command: GameCommand): Promise<void>;
  subscribe(gameId: string, onState: (state: GameState) => void, onStatus?: (status: string) => void): Unsubscribe;
  leave(gameId: string): Promise<void>;
}
