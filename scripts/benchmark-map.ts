import { performance } from 'node:perf_hooks';
import { SpatialIndex, MapFeature, boundsOf } from '../src/map/geometry';
import { visibleBounds } from '../src/map/camera';
const features: MapFeature[] = Array.from({ length: 5000 }, (_, i) => {
  const x = i % 100 * 14, y = Math.floor(i / 100) * 14;
  const ring = [{ x, y }, { x: x + 13, y }, { x: x + 13, y: y + 13 }, { x, y: y + 13 }];
  return { id: String(i), name: String(i), provinceId: String(i), countryId: String(i % 195), polygons: [[ring]], bounds: boundsOf(ring), anchor: { x: x + 5, y: y + 5 } };
});
const start = performance.now(), index = new SpatialIndex(features), built = performance.now();
const durations: number[] = []; let maxVisible = 0;
for (let i = 0; i < 10000; i++) {
  const before = performance.now();
  const found = index.query(visibleBounds({ x: i * 71 % 1440, y: i * 37 % 720, zoom: 6 }, { width: 1280, height: 720 }, 120));
  maxVisible = Math.max(maxVisible, found.length); durations.push(performance.now() - before);
}
durations.sort((a,b) => a-b);
console.log(JSON.stringify({ features: features.length, queries: durations.length, buildMs: +(built-start).toFixed(2), queryP95Ms: +durations[9500]!.toFixed(3), maxVisible, note: 'CPU spatial index only; not device FPS or native rendering measurement' }, null, 2));
