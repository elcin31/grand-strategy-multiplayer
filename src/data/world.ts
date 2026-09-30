import { Country, CountryId, GameState, Province } from '../types/game';

const country = (id: CountryId, name: string, shortName: string, color: string, treasury: number, income: number, population: number, manpower: number, army: number, technology: number, stability: number): Country => ({ id, name, shortName, color, treasury, income, population, manpower, army, technology, stability });

export const countries: Record<CountryId, Country> = {
  germany: country('germany', 'Германия', 'GER', '#586E75', 6800, 520, 84_700_000, 1_200_000, 210_000, 78, 82),
  france: country('france', 'Франция', 'FRA', '#355C9A', 6100, 480, 68_400_000, 980_000, 185_000, 76, 79),
  italy: country('italy', 'Италия', 'ITA', '#4F7C64', 4400, 360, 58_900_000, 760_000, 150_000, 70, 72),
  poland: country('poland', 'Польша', 'POL', '#A95D67', 3100, 280, 37_600_000, 640_000, 170_000, 68, 77),
  spain: country('spain', 'Испания', 'ESP', '#B38B49', 3900, 320, 48_600_000, 620_000, 135_000, 69, 75),
  uk: country('uk', 'Великобритания', 'GBR', '#574E8C', 6300, 490, 69_200_000, 900_000, 175_000, 80, 80),
  turkey: country('turkey', 'Турция', 'TUR', '#A34A4A', 3500, 300, 86_000_000, 1_350_000, 260_000, 64, 68),
  russia: country('russia', 'Россия', 'RUS', '#486A7A', 7200, 530, 146_000_000, 2_100_000, 420_000, 71, 65),
};

export const provinces: Province[] = [
  { id: 'uk-1', name: 'Британия', ownerId: 'uk', x: 70, y: 68, width: 54, height: 75, population: 69_200_000, income: 490 },
  { id: 'fr-1', name: 'Северная Франция', ownerId: 'france', x: 142, y: 120, width: 68, height: 55, population: 39_000_000, income: 300 },
  { id: 'fr-2', name: 'Южная Франция', ownerId: 'france', x: 150, y: 177, width: 66, height: 48, population: 29_400_000, income: 180 },
  { id: 'de-1', name: 'Западная Германия', ownerId: 'germany', x: 215, y: 105, width: 56, height: 58, population: 42_000_000, income: 270 },
  { id: 'de-2', name: 'Восточная Германия', ownerId: 'germany', x: 273, y: 108, width: 52, height: 58, population: 42_700_000, income: 250 },
  { id: 'pl-1', name: 'Польша', ownerId: 'poland', x: 330, y: 104, width: 62, height: 62, population: 37_600_000, income: 280 },
  { id: 'it-1', name: 'Северная Италия', ownerId: 'italy', x: 245, y: 179, width: 48, height: 48, population: 31_000_000, income: 210 },
  { id: 'it-2', name: 'Южная Италия', ownerId: 'italy', x: 272, y: 221, width: 42, height: 64, population: 27_900_000, income: 150 },
  { id: 'es-1', name: 'Испания', ownerId: 'spain', x: 84, y: 220, width: 88, height: 68, population: 48_600_000, income: 320 },
  { id: 'tr-1', name: 'Анатолия', ownerId: 'turkey', x: 363, y: 230, width: 102, height: 58, population: 86_000_000, income: 300 },
  { id: 'ru-1', name: 'Западная Россия', ownerId: 'russia', x: 402, y: 62, width: 118, height: 115, population: 86_000_000, income: 350 },
  { id: 'ru-2', name: 'Восточная Россия', ownerId: 'russia', x: 522, y: 55, width: 150, height: 122, population: 60_000_000, income: 180 },
];

export function createInitialGame(roomCode = 'LOCAL1'): GameState {
  return {
    id: `game-${roomCode.toLowerCase()}`,
    roomCode,
    phase: 'lobby',
    tick: 0,
    year: 2026,
    month: 1,
    speed: 1,
    countries: structuredClone(countries),
    provinces: provinces.map((province) => ({ ...province })),
    armies: [],
    players: [{ id: 'local-player', displayName: 'Игрок 1', countryId: null, isHost: true, ready: false }],
    selectedCountryId: null,
  };
}
