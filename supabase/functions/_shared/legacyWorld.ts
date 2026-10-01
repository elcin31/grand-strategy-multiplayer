import { Army, Country, CountryId, GameState, Province } from './gameTypes.ts';

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
  { id: 'uk-1', name: 'Британия', ownerId: 'uk', x: 70, y: 68, width: 54, height: 75, population: 69_200_000, income: 490, neighbors: ['fr-1'] },
  { id: 'fr-1', name: 'Северная Франция', ownerId: 'france', x: 142, y: 120, width: 68, height: 55, population: 39_000_000, income: 300, neighbors: ['uk-1', 'fr-2', 'de-1'] },
  { id: 'fr-2', name: 'Южная Франция', ownerId: 'france', x: 150, y: 177, width: 66, height: 48, population: 29_400_000, income: 180, neighbors: ['fr-1', 'es-1', 'it-1'] },
  { id: 'de-1', name: 'Западная Германия', ownerId: 'germany', x: 215, y: 105, width: 56, height: 58, population: 42_000_000, income: 270, neighbors: ['fr-1', 'de-2', 'it-1'] },
  { id: 'de-2', name: 'Восточная Германия', ownerId: 'germany', x: 273, y: 108, width: 52, height: 58, population: 42_700_000, income: 250, neighbors: ['de-1', 'pl-1', 'it-1', 'ru-1'] },
  { id: 'pl-1', name: 'Польша', ownerId: 'poland', x: 330, y: 104, width: 62, height: 62, population: 37_600_000, income: 280, neighbors: ['de-2', 'ru-1'] },
  { id: 'it-1', name: 'Северная Италия', ownerId: 'italy', x: 245, y: 179, width: 48, height: 48, population: 31_000_000, income: 210, neighbors: ['fr-2', 'de-1', 'de-2', 'it-2'] },
  { id: 'it-2', name: 'Южная Италия', ownerId: 'italy', x: 272, y: 221, width: 42, height: 64, population: 27_900_000, income: 150, neighbors: ['it-1', 'tr-1'] },
  { id: 'es-1', name: 'Испания', ownerId: 'spain', x: 84, y: 220, width: 88, height: 68, population: 48_600_000, income: 320, neighbors: ['fr-2'] },
  { id: 'tr-1', name: 'Анатолия', ownerId: 'turkey', x: 363, y: 230, width: 102, height: 58, population: 86_000_000, income: 300, neighbors: ['it-2', 'ru-1'] },
  { id: 'ru-1', name: 'Западная Россия', ownerId: 'russia', x: 402, y: 62, width: 118, height: 115, population: 86_000_000, income: 350, neighbors: ['de-2', 'pl-1', 'tr-1', 'ru-2'] },
  { id: 'ru-2', name: 'Восточная Россия', ownerId: 'russia', x: 522, y: 55, width: 150, height: 122, population: 60_000_000, income: 180, neighbors: ['ru-1'] },
];

export const initialArmies: Army[] = [
  { id: 'army-uk-1', ownerId: 'uk', provinceId: 'uk-1', troops: 175_000 },
  { id: 'army-fr-1', ownerId: 'france', provinceId: 'fr-1', troops: 100_000 },
  { id: 'army-fr-2', ownerId: 'france', provinceId: 'fr-2', troops: 85_000 },
  { id: 'army-de-1', ownerId: 'germany', provinceId: 'de-1', troops: 110_000 },
  { id: 'army-de-2', ownerId: 'germany', provinceId: 'de-2', troops: 100_000 },
  { id: 'army-pl-1', ownerId: 'poland', provinceId: 'pl-1', troops: 170_000 },
  { id: 'army-it-1', ownerId: 'italy', provinceId: 'it-1', troops: 90_000 },
  { id: 'army-it-2', ownerId: 'italy', provinceId: 'it-2', troops: 60_000 },
  { id: 'army-es-1', ownerId: 'spain', provinceId: 'es-1', troops: 135_000 },
  { id: 'army-tr-1', ownerId: 'turkey', provinceId: 'tr-1', troops: 260_000 },
  { id: 'army-ru-1', ownerId: 'russia', provinceId: 'ru-1', troops: 250_000 },
  { id: 'army-ru-2', ownerId: 'russia', provinceId: 'ru-2', troops: 170_000 },
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
    provinces: provinces.map((province) => ({ ...province, neighbors: [...province.neighbors] })),
    armies: initialArmies.map((army) => ({ ...army })),
    players: [{ id: 'local-player', displayName: 'Игрок 1', countryId: null, isHost: true, ready: false }],
    selectedCountryId: null,
    battleLog: [],
  };
}
