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

export interface CountryLabel { countryId: string; anchor: Point; width: number }
/** Labels use owned land, including occupations, instead of an arbitrary visible province. */
export function countryLabels(data: readonly MapFeature[], owners: ReadonlyMap<string, string>, blockers: readonly Point[] = []): CountryLabel[] {
  const groups = new Map<string, MapFeature[]>();
  for (const f of data) {
    const owner = f.provinceId && owners.get(f.provinceId);
    if (owner) { const group = groups.get(owner) ?? []; group.push(f); groups.set(owner, group); }
  }
  return [...groups].map(([countryId, land]) => {
    const inside = (p: Point) => land.some(f => contains(f, p));
    let best = { anchor: land[0]!.anchor, width: 0, score: -Infinity };
    for (const f of land) {
      const candidates = [f.anchor];
      for (let iy = 1; iy < 10; iy++) for (let ix = 1; ix < 10; ix++) candidates.push({ x: f.bounds.left + (f.bounds.right - f.bounds.left) * ix / 10, y: f.bounds.top + (f.bounds.bottom - f.bounds.top) * iy / 10 });
      for (const anchor of candidates) {
        if (!inside(anchor)) continue;
        // Symmetric horizontal fit keeps the entire label over land at its baseline.
        let radius = 0;
        for (let r = 0.5; r <= 80; r += 0.5) {
          if (!inside({ x: anchor.x - r, y: anchor.y }) || !inside({ x: anchor.x + r, y: anchor.y })) break;
          radius = r;
        }
        const clearance = blockers.reduce((min, p) => Math.min(min, Math.hypot(anchor.x - p.x, anchor.y - p.y)), Infinity);
        const score = radius - Math.max(0, 7 - clearance) * 3;
        if (score > best.score) best = { anchor, width: radius * 2, score };
      }
    }
    return { countryId, anchor: best.anchor, width: best.width };
  });
}
