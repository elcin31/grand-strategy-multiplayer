import type { GameState } from '../types/game';
import geography from './geography.json';
import { Bounds, contains, MapFeature, Point, SpatialIndex } from './geometry';
import { GraphicsPreset, GRAPHICS, MapMode } from './settings';
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
export function borderPaths(state: GameState, visibleIds: Set<string>): { outer: string; inner: string } {
  const owners = new Map(state.provinces.map(p => [p.id, p.ownerId]));
  let outer = '', inner = '';
  for (const edge of edges) {
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
export function buildProvinceColors(state: GameState, mode: MapMode, troops: Map<string, number>): Map<string, string> {
  if (mode === 'Political' || mode === 'Terrain') return new Map(state.provinces.map(p => [p.id, mode === 'Political' ? state.countries[p.ownerId].color : '#637364']));
  const values = new Map(state.provinces.map(p => [p.id, mode === 'Economy' ? p.income : mode === 'Population' ? p.population : mode === 'Military' ? troops.get(p.id) ?? 0 : state.countries[p.ownerId].stability]));
  const all = [...values.values()], max = Math.max(1, ...all), min = Math.min(...all);
  const low = [66, 77, 91], high = [197, 161, 89];
  return new Map([...values.entries()].map(([id, value]) => {
    const t = max === min ? 0.5 : Math.max(0, Math.min(1, (value - min) / (max - min)));
    return [id, `rgb(${low.map((v, i) => Math.round(v + (high[i]! - v) * t)).join(',')})`];
  }));
}
export function visibleCities<T extends { capital: boolean; population: number; point: Point }>(cities: readonly T[], bounds: Bounds, zoom: number, preset: GraphicsPreset): T[] {
  return cities.filter(c => (c.capital || zoom >= 5) && c.point.x >= bounds.left && c.point.x <= bounds.right && c.point.y >= bounds.top && c.point.y <= bounds.bottom)
    .sort((a, b) => Number(b.capital) - Number(a.capital) || b.population - a.population).slice(0, GRAPHICS[preset].cityBudget);
}

export interface CountryLabel { countryId: string; anchor: Point; width: number; blocked: boolean }
export interface LabelBlocker extends Point { halfWidth?: number; halfHeight?: number }
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
export function countryLabels(data: readonly MapFeature[], owners: ReadonlyMap<string, string>, blockers: readonly LabelBlocker[] = [], layout: LabelLayout = { height: 4 }): CountryLabel[] {
  let geometry = labelGeometry.get(data);
  if (!geometry) {
    geometry = { index: new SpatialIndex(data), areas: new Map(data.map(f => [f.id, f.polygons.reduce((sum, rings) => sum + polygonArea(rings[0]!) - rings.slice(1).reduce((holes, ring) => holes + polygonArea(ring), 0), 0)])) };
    labelGeometry.set(data, geometry);
  }
  const groups = new Map<string, MapFeature[]>();
  for (const f of data) {
    const owner = f.provinceId && owners.get(f.provinceId);
    if (owner) { const group = groups.get(owner) ?? []; group.push(f); groups.set(owner, group); }
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
