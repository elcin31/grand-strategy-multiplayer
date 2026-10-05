import {normalizeGameState} from './stateMigrations.ts';
import type { GameState } from './gameTypes.ts';

export interface StoredRoomState {
  state?: GameState | null;
  state_compressed?: string | null;
}

const PREFIX = 'gz1:';
const CHUNK = 0x8000;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(bytes.length, offset + CHUNK)));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function ownedBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

async function gzip(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzip(bytes: Uint8Array): Promise<string> {
  const stream = new Blob([ownedBuffer(bytes)]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

function assertState(value: unknown): asserts value is GameState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid persisted campaign state');
  const state = value as Partial<GameState>;
  if (typeof state.id !== 'string' || !Array.isArray(state.provinces) || !Array.isArray(state.players) || !state.countries || typeof state.countries !== 'object') throw new Error('Invalid persisted campaign state');
}

/** Wire-efficient persistence. Existing JSONB campaigns remain readable and migrate lazily on their next authoritative write. */
export async function packRoomState(state: GameState): Promise<string> {
  assertState(state);
  const json = JSON.stringify(state);
  if (!json) throw new Error('Campaign state serialization failed');
  return PREFIX + bytesToBase64(await gzip(json));
}

export async function unpackRoomState(row: StoredRoomState): Promise<GameState> {
  if (row.state_compressed) {
    if (!row.state_compressed.startsWith(PREFIX)) throw new Error('Unsupported persisted campaign codec');
    let decoded: unknown;
    try {
      decoded = JSON.parse(await gunzip(base64ToBytes(row.state_compressed.slice(PREFIX.length))));
    } catch {
      throw new Error('Corrupted persisted campaign state');
    }
    assertState(decoded);
    normalizeGameState(decoded);
    return decoded;
  }
  if (row.state) {
    assertState(row.state);
    const restored=structuredClone(row.state);normalizeGameState(restored);return restored;
  }
  throw new Error('Campaign state is missing');
}
