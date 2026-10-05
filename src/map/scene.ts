import {DIPLOMATIC_COLORS,TERRAIN_COLORS,GOVERNMENT_COLORS,diplomaticCategory,relationColor} from './modes';
import {pairKey} from '../../supabase/functions/_shared/diplomacySystem';
import { RESOURCES } from '../../supabase/functions/_shared/resourceSystem';
import { countryFor, type GameState } from '../types/game';
import geography from './geography.json';
import { Bounds, contains, MapFeature, Point, SpatialIndex } from './geometry';
import { GraphicsPreset, GRAPHICS, MapMode } from './settings';
import { RELIGIONS } from '../../supabase/functions/_shared/religionSystem';
import { GOVERNMENT_TYPES } from '../../supabase/functions/_shared/governmentSystem';
export const features: MapFeature[] = geography;
export const spatialIndex = new SpatialIndex(features);
export const provinceGeometry = new Map(features.filter(f => f.provinceId).map(f => [f.provinceId!, f]));
export interface Edge { a: Point; b: Point; provinces: string[] }
export function buildEdges(data: readonly MapFeature[]): Edge[] {
  const edges = new Map<string, Edge>();
  const key = (p: Point) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
  for (const f of data) {
    if (!f.provinceId) continue;
    for (const polygon of f.polygons) for (const ring of polygon) for (let i = 1; i < ring.length; i++) {
      const a = ring[i - 1]!, b = ring[i]!;
      const ak = key(a), bk = key(b), ek = ak < bk ? `${ak}/${bk}` : `${bk}/${ak}`;
      const edge = edges.get(ek) ?? { a, b, provinces: [] };
      if (!edge.provinces.includes(f.provinceId)) edge.provinces.push(f.provinceId);
      edges.set(ek, edge);
    }
  }
  return [...edges.values()];
}
export const edges = buildEdges(features);
export function borderPaths(state: GameState, visibleIds: Set<string>, data: readonly Edge[] = edges): { outer: string; inner: string } {
  const owners = new Map(state.provinces.map(p => [p.id, p.ownerId]));
  let outer = '', inner = '';
  for (const edge of data) {
    if (!edge.provinces.some(id => visibleIds.has(id))) continue;
    const line = `M${edge.a.x},${edge.a.y}L${edge.b.x},${edge.b.y}`;
    if (edge.provinces.length === 1 || new Set(edge.provinces.map(id => owners.get(id))).size > 1) outer += line;
    else inner += line;
  }
  return { outer, inner };
}
export function troopsByProvince(state: GameState): Map<string, number> {
  const result = new Map<string, number>();
  for (const army of state.armies) result.set(army.provinceId, (result.get(army.provinceId) ?? 0) + army.troops);
  return result;
}
/** Linear preprocessing, then O(1) lookup. Never scan the full world per visible polygon. */
export function buildProvinceColors(state: GameState, mode: MapMode, troops: Map<string, number>, reference=state.selectedCountryId??state.players[0]?.countryId??Object.keys(state.countries)[0]!): Map<string, string> {
  if(mode==='Diplomatic')return new Map(state.provinces.map(p=>[p.id,DIPLOMATIC_COLORS[diplomaticCategory(state,reference,p.ownerId)]]));
  if(mode==='Relations')return new Map(state.provinces.map(p=>[p.id,relationColor(p.ownerId===reference?100:state.diplomacy?.[pairKey(reference,p.ownerId)]?.relation??0)]));
  if(mode==='Terrain')return new Map(state.provinces.map(p=>[p.id,TERRAIN_COLORS[p.terrain??'plains']]));
  if (mode === 'Resources') return new Map(state.provinces.map(p => [p.id, p.resourceDeposit ? RESOURCES[p.resourceDeposit.type].color : '#657080']));
  if (mode === 'Religion') return new Map(state.provinces.map(p => [p.id, RELIGIONS[p.religion ?? 'secular']?.color ?? RELIGIONS.secular!.color]));
  if (mode === 'Government') {
    const palette = GOVERNMENT_COLORS;
    const colors = new Map(Object.values(state.countries).map(c => [c.id, palette[GOVERNMENT_TYPES.indexOf(c.governmentType ?? 'Parliamentary Republic')] ?? palette[0]!]));
    return new Map(state.provinces.map(p => [p.id, colors.get(p.ownerId) ?? palette[0]!]));
  }
  if (mode === 'Political') return new Map(state.provinces.map(p => [p.id, countryFor(state, p.ownerId).color]));
  const values = new Map(state.provinces.map(p => [p.id, mode === 'Development' ? p.development??40 : mode === 'Economy' ? p.income*(1+(p.development??40)/100) : mode === 'Population' ? p.population : mode === 'Military' ? troops.get(p.id) ?? 0 : (countryFor(state,p.ownerId).stability+100-(p.unrest??0))/2]));
  const all = [...values.values()], max = Math.max(1, ...all), min = Math.min(...all);
  const low = [66, 77, 91], high = [197, 161, 89];
  return new Map([...values.entries()].map(([id, value]) => {
    const t = max === min ? 0.5 : Math.max(0, Math.min(1, (value - min) / (max - min)));
    return [id, `rgb(${low.map((v, i) => Math.round(v + (high[i]! - v) * t)).join(',')})`];
  }));
}
export function visibleCities<T extends { capital: boolean; population: number; point: Point }>(cities: readonly T[], bounds: Bounds, zoom: number, preset: GraphicsPreset): T[] {
  return cities.filter(c => (c.capital || (zoom >= 5 && (c.population>=250000||zoom>=9))) && c.point.x >= bounds.left && c.point.x <= bounds.right && c.point.y >= bounds.top && c.point.y <= bounds.bottom)
    .sort((a, b) => Number(b.capital) - Number(a.capital) || b.population - a.population).slice(0, GRAPHICS[preset].cityBudget);
}

export interface CountryLabel { countryId: string; anchor: Point; width: number; blocked: boolean }
export interface LabelBlocker extends Point { halfWidth?: number; halfHeight?: number }
export interface CityLabelPlacement { dx: number; dy: number; box: LabelBlocker }
/** Screen-sized text is placed once per culled camera update, never in the frame loop. */
export function cityLabelPlacements<T extends { id: string; name: string; capital: boolean; population: number; point: Point }>(
  cities: readonly T[], zoom: number, tilt: number, measureWidth: (name: string) => number,
  blockers: readonly LabelBlocker[] = [], bounds?: Bounds,
): Map<string, CityLabelPlacement> {
  const result = new Map<string, CityLabelPlacement>();
  if (!Number.isFinite(zoom) || zoom < 4 || !Number.isFinite(tilt) || tilt <= 0) return result;
  const overlaps = (a: LabelBlocker, b: LabelBlocker) => Math.abs(a.x - b.x) < (a.halfWidth ?? 1.5) + (b.halfWidth ?? 1.5) && Math.abs(a.y - b.y) < (a.halfHeight ?? 1.5) + (b.halfHeight ?? 1.5);
  const markers = cities.map(c => ({ id: c.id, ...c.point, halfWidth: (c.capital ? 7 : 4) / zoom, halfHeight: (c.capital ? 7 : 4) / (zoom * tilt) }));
  const occupied = [...blockers];
  for (const city of [...cities].sort((a, b) => Number(b.capital) - Number(a.capital) || b.population - a.population || a.id.localeCompare(b.id))) {
    const width = measureWidth(city.name);
    if (!Number.isFinite(width) || width <= 0) continue;
    for (const [dx, dy] of [[8, 4], [-8 - width, 4], [-width / 2, -10], [-width / 2, 18], [32, 4], [-32 - width, 4], [-width / 2, -24], [-width / 2, 28]]) {
      const box = { x: city.point.x + (dx! + width / 2) / zoom, y: city.point.y + (dy! - 4) / (zoom * tilt), halfWidth: (width / 2 + 3) / zoom, halfHeight: 8 / (zoom * tilt) };
      if (bounds && (box.x - box.halfWidth < bounds.left || box.x + box.halfWidth > bounds.right || box.y - box.halfHeight < bounds.top || box.y + box.halfHeight > bounds.bottom)) continue;
      if (occupied.some(b => overlaps(box, b)) || markers.some(b => b.id !== city.id && overlaps(box, b))) continue;
      result.set(city.id, { dx: dx!, dy: dy!, box }); occupied.push(box); break;
    }
  }
  return result;
}
export interface LabelLayout { height: number; widths?: ReadonlyMap<string, number> }
const labelGeometry = new WeakMap<readonly MapFeature[], { index: SpatialIndex; areas: Map<string, number> }>();
function polygonArea(ring: readonly Point[]): number {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) area += ring[j]!.x * ring[i]!.y - ring[i]!.x * ring[j]!.y;
  return Math.abs(area) / 2;
}
/** Union horizontal land intervals, including holes and borders between owned provinces. */
function labelWidth(land: readonly MapFeature[], anchor: Point): number {
  const intervals: [number, number][] = [];
  for (const f of land) {
    if (anchor.y < f.bounds.top || anchor.y > f.bounds.bottom) continue;
    for (const rings of f.polygons) {
      const crossings: number[] = [];
      for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = ring[j]!, b = ring[i]!;
        if ((a.y > anchor.y) !== (b.y > anchor.y)) crossings.push(a.x + (anchor.y - a.y) * (b.x - a.x) / (b.y - a.y));
      }
      crossings.sort((a, b) => a - b);
      for (let i = 0; i + 1 < crossings.length; i += 2) intervals.push([crossings[i]!, crossings[i + 1]!]);
    }
  }
  intervals.sort((a, b) => a[0] - b[0]);
  let left = Infinity, right = -Infinity;
  for (const interval of intervals) {
    if (interval[0] > right + 1e-6) {
      if (anchor.x >= left && anchor.x <= right) break;
      [left, right] = interval;
    } else right = Math.max(right, interval[1]);
  }
  return anchor.x >= left && anchor.x <= right ? Math.max(0, Math.min(anchor.x - left, right - anchor.x) * 1.9) : 0;
}
/** Bounded candidates and cached spatial geometry keep full-world labels off the frame loop. */
export function countryLabels(data: readonly MapFeature[], owners: ReadonlyMap<string, string>, blockers: readonly LabelBlocker[] = [], layout: LabelLayout = { height: 4 }, visibleCountries?: ReadonlySet<string>): CountryLabel[] {
  let geometry = labelGeometry.get(data);
  if (!geometry) {
    geometry = { index: new SpatialIndex(data), areas: new Map(data.map(f => [f.id, f.polygons.reduce((sum, rings) => sum + polygonArea(rings[0]!) - rings.slice(1).reduce((holes, ring) => holes + polygonArea(ring), 0), 0)])) };
    labelGeometry.set(data, geometry);
  }
  const groups = new Map<string, MapFeature[]>();
  for (const f of data) {
    const owner = f.provinceId && owners.get(f.provinceId);
    if (owner && (!visibleCountries || visibleCountries.has(owner))) { const group = groups.get(owner) ?? []; group.push(f); groups.set(owner, group); }
  }
  const { index, areas } = geometry;
  return [...groups].map(([countryId, land]) => {
    const inside = (point: Point) => index.query({ left: point.x, right: point.x, top: point.y, bottom: point.y }).some(f => f.provinceId && owners.get(f.provinceId) === countryId && contains(f, point));
    const largest = [...land].sort((a, b) => areas.get(b.id)! - areas.get(a.id)!).slice(0, 3);
    const totalArea = land.reduce((sum, f) => sum + areas.get(f.id)!, 0);
    const center = land.reduce((p, f) => ({ x: p.x + f.anchor.x * areas.get(f.id)! / totalArea, y: p.y + f.anchor.y * areas.get(f.id)! / totalArea }), { x: 0, y: 0 });
    const candidates = [center, ...largest.map(f => f.anchor)];
    for (const f of largest) for (let iy = 1; iy < 6; iy++) for (let ix = 1; ix < 6; ix++) candidates.push({ x: f.bounds.left + (f.bounds.right - f.bounds.left) * ix / 6, y: f.bounds.top + (f.bounds.bottom - f.bounds.top) * iy / 6 });
    // Counter edges supply placements between armies that the coarse grid can miss.
    for (const blocker of blockers) {
      if (!largest.some(f => blocker.x >= f.bounds.left && blocker.x <= f.bounds.right && blocker.y >= f.bounds.top && blocker.y <= f.bounds.bottom)) continue;
      const offset = (blocker.halfHeight ?? 1.5) + layout.height / 2 + 0.5;
      for (const candidateX of [blocker.x, center.x]) for (const sign of [-1, 1]) candidates.push({ x: candidateX, y: blocker.y + offset * sign });
    }
    let best = { anchor: largest[0]!.anchor, width: 0, score: -Infinity, blocked: true };
    for (const anchor of candidates) {
      if (!inside(anchor)) continue;
      const width = labelWidth(land, anchor);
      const halfWidth = Math.min(width, layout.widths?.get(countryId) ?? width) / 2;
      const collisions = blockers.filter(p => Math.abs(anchor.x - p.x) < halfWidth + (p.halfWidth ?? 1.5) && Math.abs(anchor.y - p.y) < layout.height / 2 + (p.halfHeight ?? 1.5)).length;
      const score = width / 2 - collisions * 10000;
      if (score > best.score) best = { anchor, width, score, blocked: collisions > 0 };
    }
    return { countryId, anchor: best.anchor, width: best.width, blocked: best.blocked };
  });
}
