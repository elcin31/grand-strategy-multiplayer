import { GameCommand, GameState } from '../types/game';

export type Unsubscribe = () => void;

export interface MultiplayerTransport {
  createRoom(displayName: string): Promise<GameState>;
  joinRoom(roomCode: string, displayName: string): Promise<GameState>;
  sendCommand(gameId: string, command: GameCommand): Promise<void>;
  subscribe(gameId: string, onState: (state: GameState) => void): Unsubscribe;
  leave(gameId: string): Promise<void>;
}
