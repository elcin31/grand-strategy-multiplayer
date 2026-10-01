import countryData from './data/countries.json';
import capitalData from './data/capitals.json';
import sourceData from './data/source.json';
export const worldDataNotices = Object.freeze({ geography: 'Natural Earth · Public domain', flags: sourceData.flags.licenseText, recognitionPolicy: sourceData.worldImport.recognitionPolicy });

/** Immutable world definitions are separate from mutable, authoritative campaign values. */
export interface WorldCountryDefinition {
  readonly id: string;
  readonly sourceCode: string;
  readonly iso2: string;
  readonly name: string;
  readonly englishName: string;
  readonly shortName: string;
  readonly adjective: string;
  readonly color: string;
  readonly flag: string;
  readonly capitalCityId: string;
  readonly populationEstimate: number;
  readonly populationYear: number;
  readonly region: string;
  readonly subregion: string;
  readonly provinceIds: readonly string[];
  readonly neighbors: readonly string[];
}
export interface WorldCapitalDefinition {
  readonly id: string;
  readonly name: string;
  readonly countryId: string;
  readonly provinceId: string;
  readonly point: readonly number[];
  readonly populationEstimate: number;
  readonly isCapital: boolean;
  readonly isRegionalCapital: boolean;
  readonly capitalRole: string | null;
}
export const worldCountries: readonly WorldCountryDefinition[] = Object.freeze(countryData.map(c => Object.freeze({
  ...c, provinceIds: Object.freeze([...c.provinceIds]), neighbors: Object.freeze([...c.neighbors]),
})));
const countries = new Map(worldCountries.map(c => [c.id, c]));
const capitals = new Map(capitalData.map(c => [c.id, Object.freeze({ ...c, point: Object.freeze([...c.point]) })]));
if (countries.size !== worldCountries.length || capitals.size !== capitalData.length) throw new Error('Duplicate world identifiers');
for (const country of worldCountries) {
  const capital = capitals.get(country.capitalCityId);
  if (!country.id || !country.name || !country.adjective || !/^#[0-9a-f]{6}$/i.test(country.color) || !Number.isSafeInteger(country.populationEstimate) || country.populationEstimate < 0 || !country.provinceIds.length) throw new Error('Invalid country definition');
  if (!capital || capital.countryId !== country.id || !country.provinceIds.includes(capital.provinceId) || !capital.isCapital || capital.point.length !== 2 || capital.point.some(v => !Number.isFinite(v))) throw new Error('Invalid country capital');
  if (new Set(country.provinceIds).size !== country.provinceIds.length || new Set(country.neighbors).size !== country.neighbors.length) throw new Error('Duplicate country links');
  for (const neighborId of country.neighbors) {
    const neighbor = countries.get(neighborId);
    if (!neighbor || neighborId === country.id || !neighbor.neighbors.includes(country.id) || neighbor.color.toLowerCase() === country.color.toLowerCase()) throw new Error('Invalid country adjacency');
  }
}
export const getWorldCountry = (id: string): WorldCountryDefinition | null => countries.get(id) ?? null;
export function getWorldCapital(countryId: string): WorldCapitalDefinition | null {
  const country = countries.get(countryId);
  return country ? capitals.get(country.capitalCityId) ?? null : null;
}
/** Search names/codes in a country picker without coupling architecture to roster size. */
export function searchWorldCountries(query: string): readonly WorldCountryDefinition[] {
  const value = query.trim().toLocaleLowerCase('ru-RU');
  if (!value) return worldCountries;
  return worldCountries.filter(c => [c.name, c.englishName, c.id, c.shortName, c.iso2].some(name => name.toLocaleLowerCase('ru-RU').includes(value)));
}
/** SVG data is loaded only when a flag is requested; country definitions contain references. */
export function getWorldFlag(countryId: string): string | null {
  const country = countries.get(countryId);
  if (!country) return null;
  const flags = require('./data/flags.json') as Record<string, string>;
  return flags[country.flag] ?? null;
}
