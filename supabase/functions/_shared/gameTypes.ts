export type CountryId = string;
export type GameSpeed = 0 | 1 | 2 | 3 | 4;

export interface Country {
  id: CountryId;
  name: string;
  shortName: string;
  color: string;
  adjective?: string;
  flag?: string;
  capitalCityId?: string;
  rulerId?: string;
  provinceIds?: string[];
  treasury: number;
  income: number;
  population: number;
  manpower: number;
  army: number;
  technology: number;
  stability: number;
}

export interface Province {
  id: string;
  name: string;
  ownerId: CountryId;
  x: number;
  y: number;
  width: number;
  height: number;
  population: number;
  income: number;
  neighbors: string[];
  countryId?: CountryId;
  controllerId?: CountryId;
  cityIds?: string[];
  development?: number;
}

export interface Army {
  id: string;
  ownerId: CountryId;
  provinceId: string;
  troops: number;
}

export interface Player {
  id: string;
  displayName: string;
  countryId: CountryId | null;
  isHost: boolean;
  ready: boolean;
}

export interface BattleEvent {
  id: string;
  tick: number;
  provinceId: string;
  attackerId: CountryId;
  defenderId: CountryId;
  attackerLosses: number;
  defenderLosses: number;
  winnerId: CountryId;
  captured: boolean;
  message: string;
}

export interface City {
  id: string;
  name: string;
  countryId: CountryId;
  provinceId: string;
  population: number;
  development: number;
  isCapital: boolean;
  isRegionalCapital: boolean;
}

export interface Leader {
  id: string;
  name: string;
  countryId: CountryId;
  age: number;
  portraitSeed: number;
  ideology: string;
  traits: string[];
  militarySkill: number;
  diplomaticSkill: number;
  economicSkill: number;
  popularity: number;
}

export interface GameState {
  nextEntityId?: number;
  dataset?: 'modern-world-v1';
  campaignSeed?: number;
  cities?: City[];
  leaders?: Record<string, Leader>;
  id: string;
  roomCode: string;
  phase: 'lobby' | 'running' | 'paused' | 'finished';
  tick: number;
  year: number;
  month: number;
  speed: GameSpeed;
  countries: Record<CountryId, Country>;
  provinces: Province[];
  armies: Army[];
  players: Player[];
  selectedCountryId: CountryId | null;
  battleLog: BattleEvent[];
}

export type GameCommand =
  | { type: 'SELECT_COUNTRY'; playerId: string; countryId: CountryId }
  | { type: 'SET_READY'; playerId: string; ready: boolean }
  | { type: 'START_GAME'; playerId: string }
  | { type: 'SET_SPEED'; playerId: string; speed: GameSpeed }
  | { type: 'RECRUIT'; playerId: string; provinceId: string; troops: number }
  | { type: 'MOVE_ARMY'; playerId: string; armyId: string; provinceId: string }
  | { type: 'ADVANCE_TICK' };

/** Campaign country IDs are extensible; lookups fail explicitly on corrupted links. */
export function countryFor(state: Pick<GameState, 'countries'>, id: string): Country {
  if (!Object.hasOwn(state.countries, id)) throw new Error('Unknown campaign country: '+id);
  const country = state.countries[id];
  if (!country || country.id !== id) throw new Error('Invalid campaign country: '+id);
  return country;
}
