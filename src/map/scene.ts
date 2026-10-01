import type { GameState } from '../types/game';
import geography from './geography.json';
import { Bounds, MapFeature, Point, SpatialIndex } from './geometry';
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
export function provinceColor(id: string, state: GameState, mode: MapMode, troops: Map<string, number>): string {
  const p = state.provinces.find(p => p.id === id);
  if (!p) return '#37423f';
  const c = state.countries[p.ownerId];
  if (mode === 'Political') return c.color;
  if (mode === 'Terrain') return '#637364';
  const metric = (id: string) => { const p = state.provinces.find(p => p.id === id)!; return mode === 'Economy' ? p.income : mode === 'Population' ? p.population : mode === 'Military' ? troops.get(p.id) ?? 0 : state.countries[p.ownerId].stability; };
  const values = state.provinces.map(p => metric(p.id)), value = metric(id);
  const max = Math.max(1, ...values), min = Math.min(...values);
  const t = max === min ? 0.5 : Math.max(0, Math.min(1, (value - min) / (max - min)));
  const low = [66, 77, 91], high = [197, 161, 89];
  return `rgb(${low.map((v, i) => Math.round(v + (high[i]! - v) * t)).join(',')})`;
}
export function visibleCities<T extends { capital: boolean; population: number; point: Point }>(cities: readonly T[], bounds: Bounds, zoom: number, preset: GraphicsPreset): T[] {
  return cities.filter(c => (c.capital || zoom >= 5) && c.point.x >= bounds.left && c.point.x <= bounds.right && c.point.y >= bounds.top && c.point.y <= bounds.bottom)
    .sort((a, b) => Number(b.capital) - Number(a.capital) || b.population - a.population).slice(0, GRAPHICS[preset].cityBudget);
}
