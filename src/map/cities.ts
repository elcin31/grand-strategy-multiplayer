import { project, Point } from './geometry';
export interface MapCity { id: string; name: string; provinceId: string; capital: boolean; population: number; point: Point }
const city = (id: string, name: string, provinceId: string, lon: number, lat: number, capital: boolean, population: number): MapCity => ({ id, name, provinceId, capital, population, point: project(lon, lat) });
// Original positional catalogue for the existing scenario. Population is scenario data, not a live census.
export const mapCities: MapCity[] = [
  city('london', 'Лондон', 'uk-1', -0.1276, 51.5072, true, 8900000),
  city('manchester', 'Манчестер', 'uk-1', -2.245, 53.48, false, 550000),
  city('paris', 'Париж', 'fr-1', 2.3522, 48.8566, true, 2100000),
  city('lyon', 'Лион', 'fr-2', 4.8357, 45.764, false, 520000),
  city('marseille', 'Марсель', 'fr-2', 5.3698, 43.2965, false, 870000),
  city('berlin', 'Берлин', 'de-2', 13.405, 52.52, true, 3800000),
  city('hamburg', 'Гамбург', 'de-1', 9.9937, 53.5511, false, 1900000),
  city('munich', 'Мюнхен', 'de-2', 11.582, 48.1351, false, 1500000),
  city('warsaw', 'Варшава', 'pl-1', 21.0122, 52.2297, true, 1900000),
  city('krakow', 'Краков', 'pl-1', 19.945, 50.0647, false, 800000),
  city('rome', 'Рим', 'it-1', 12.4964, 41.9028, true, 2800000),
  city('milan', 'Милан', 'it-1', 9.19, 45.4642, false, 1400000),
  city('naples', 'Неаполь', 'it-2', 14.2681, 40.8518, false, 910000),
  city('madrid', 'Мадрид', 'es-1', -3.7038, 40.4168, true, 3300000),
  city('barcelona', 'Барселона', 'es-1', 2.1734, 41.3851, false, 1600000),
  city('ankara', 'Анкара', 'tr-1', 32.8597, 39.9334, true, 5700000),
  city('istanbul', 'Стамбул', 'tr-1', 28.9784, 41.0082, false, 15600000),
  city('moscow', 'Москва', 'ru-1', 37.6173, 55.7558, true, 13100000),
  city('petersburg', 'Санкт-Петербург', 'ru-1', 30.3351, 59.9343, false, 5600000),
  city('novosibirsk', 'Новосибирск', 'ru-2', 82.9204, 55.03, false, 1600000),
];
