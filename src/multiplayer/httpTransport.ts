import { GameCommand, GameState } from '../types/game';
import { MultiplayerTransport, TransportSession, Unsubscribe } from './transport';

interface RemoteSession { gameId: string; playerId: string; token: string; version?: number; }
interface RoomResponse { state: GameState; playerId: string; token?: string; version?: number; }
const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');

export class HttpTransport implements MultiplayerTransport {
  private readonly sessions = new Map<string, RemoteSession>();
  private readonly baseUrl: string;

  constructor(baseUrl: string) { this.baseUrl = normalizeBaseUrl(baseUrl); }

  private async request<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${this.baseUrl}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string } & T;
    if (!response.ok) throw new Error(payload.error || `Server error ${response.status}`);
    return payload;
  }

  async createRoom(displayName: string): Promise<TransportSession> {
    const result = await this.request<RoomResponse>('game-room', { action: 'create', displayName });
    if (!result.token) throw new Error('Сервер не вернул токен игрока');
    this.sessions.set(result.state.id, { gameId: result.state.id, playerId: result.playerId, token: result.token, version: result.version });
    return { state: result.state, playerId: result.playerId };
  }

  async joinRoom(roomCode: string, displayName: string): Promise<TransportSession> {
    const result = await this.request<RoomResponse>('game-room', { action: 'join', roomCode, displayName });
    if (!result.token) throw new Error('Сервер не вернул токен игрока');
    this.sessions.set(result.state.id, { gameId: result.state.id, playerId: result.playerId, token: result.token, version: result.version });
    return { state: result.state, playerId: result.playerId };
  }

  async sendCommand(gameId: string, command: GameCommand): Promise<void> {
    const session = this.sessions.get(gameId);
    if (!session) throw new Error('Сессия комнаты потеряна');
    await this.request('game-command', { gameId, playerId: session.playerId, token: session.token, command });
  }

  subscribe(gameId: string, onState: (state: GameState) => void): Unsubscribe {
    let stopped = false;
    let inFlight = false;
    const poll = async () => {
      if (stopped || inFlight) return;
      const session = this.sessions.get(gameId);
      if (!session) return;
      inFlight = true;
      try {
        const result = await this.request<RoomResponse & { unchanged?: boolean }>('game-room', { action: 'state', gameId, playerId: session.playerId, token: session.token, version: session.version });
        if (stopped) return;
        if (result.version !== undefined) session.version = result.version;
        if (!result.unchanged) onState(result.state);
      } catch {
        // A transient network miss must not destroy an active campaign.
      } finally {
        inFlight = false;
      }
    };
    const timer = setInterval(poll, 900);
    void poll();
    return () => { stopped = true; clearInterval(timer); };
  }

  async leave(gameId: string): Promise<void> { this.sessions.delete(gameId); }
}
