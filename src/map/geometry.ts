export interface Point { x: number; y: number }
export interface Bounds { left: number; top: number; right: number; bottom: number }
export interface MapFeature {
  id: string;
  name: string;
  countryId: string | null;
  provinceId: string | null;
  polygons: Point[][][];
  bounds: Bounds;
  anchor: Point;
}
export const WORLD_WIDTH = 1440;
export const WORLD_HEIGHT = 720;
export const TILE_SIZE = 120;

export function project(lon: number, lat: number): Point {
  return { x: (lon + 180) * 4, y: (90 - lat) * 4 };
}

export function boundsOf(points: readonly Point[]): Bounds {
  if (!points.length || points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) throw new Error('Invalid geometry');
  return points.reduce((b, p) => ({ left: Math.min(b.left, p.x), top: Math.min(b.top, p.y), right: Math.max(b.right, p.x), bottom: Math.max(b.bottom, p.y) }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
}
export function overlaps(a: Bounds, b: Bounds): boolean {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}
export function inRing(point: Point, ring: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!, b = ring[j]!;
    if (((a.y > point.y) !== (b.y > point.y)) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
export function contains(feature: MapFeature, point: Point): boolean {
  if (!overlaps(feature.bounds, { left: point.x, right: point.x, top: point.y, bottom: point.y })) return false;
  return feature.polygons.some(rings => Boolean(rings[0] && inRing(point, rings[0]) && !rings.slice(1).some(ring => inRing(point, ring))));
}
export function featurePath(feature: MapFeature): string {
  return feature.polygons.map(rings => rings.map(ring => ring.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ') + 'Z').join(' ')).join(' ');
}
/** Distance to generalized coastline, used for coastal city coordinates. */
export function distanceToFeature(feature: MapFeature, point: Point): number {
  if (contains(feature, point)) return 0;
  let min = Infinity;
  for (const polygon of feature.polygons) for (const ring of polygon) for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1]!, b = ring[i]!, dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    min = Math.min(min, Math.hypot(point.x - a.x - dx * t, point.y - a.y - dy * t));
  }
  return min;
}

/** A feature may intersect several tiles. Query results never contain duplicates. */
export class SpatialIndex {
  private tiles = new Map<string, MapFeature[]>();
  constructor(features: readonly MapFeature[]) {
    for (const feature of features) for (const key of tileKeys(feature.bounds)) {
      const list = this.tiles.get(key) ?? [];
      list.push(feature); this.tiles.set(key, list);
    }
  }
  query(bounds: Bounds): MapFeature[] {
    const seen = new Map<string, MapFeature>();
    for (const key of tileKeys(bounds)) for (const f of this.tiles.get(key) ?? []) if (overlaps(f.bounds, bounds)) seen.set(f.id, f);
    return [...seen.values()];
  }
  hit(point: Point): MapFeature | null {
    return this.query({ left: point.x, right: point.x, top: point.y, bottom: point.y }).find(f => f.provinceId && contains(f, point)) ?? null;
  }
}
export function tileKeys(bounds: Bounds): string[] {
  const keys: string[] = [];
  if (Object.values(bounds).some(v => !Number.isFinite(v)) || bounds.left > bounds.right || bounds.top > bounds.bottom) return keys;
  const maxX = Math.ceil(WORLD_WIDTH / TILE_SIZE) - 1, maxY = Math.ceil(WORLD_HEIGHT / TILE_SIZE) - 1;
  for (let y = Math.max(0, Math.floor(bounds.top / TILE_SIZE)); y <= Math.min(maxY, Math.floor(bounds.bottom / TILE_SIZE)); y++) {
    for (let x = Math.max(0, Math.floor(bounds.left / TILE_SIZE)); x <= Math.min(maxX, Math.floor(bounds.right / TILE_SIZE)); x++) keys.push(`${x}:${y}`);
  }
  return keys;
}
