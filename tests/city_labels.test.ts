import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cityLabelPlacements, visibleCities, type LabelBlocker } from '../src/map/scene';
import { createWorldState } from '../supabase/functions/_shared/worldState';
import { mapSceneFor } from '../src/map/worldScene';
import { visibleBounds, TILT } from '../src/map/camera';

const overlap = (a: LabelBlocker, b: LabelBlocker) => Math.abs(a.x - b.x) < a.halfWidth! + b.halfWidth! && Math.abs(a.y - b.y) < a.halfHeight! + b.halfHeight!;
const width = (name: string) => name.length * 7;

test('dense city labels remain deterministic, prioritize capitals and avoid counters and other labels', () => {
  const capital = { id: 'capital', name: 'Capital', capital: true, population: 100, point: { x: 100, y: 100 } };
  const cities = [capital, ...Array.from({ length: 60 }, (_, i) => ({ id: 'city-'+i, name: 'Regional Center '+i, capital: false, population: 1000-i, point: { x: 90 + i % 10 * 2, y: 90 + Math.floor(i / 10) * 2 } }))];
  const original = structuredClone(cities);
  const blocker = { x: 100, y: 100, halfWidth: 27 / 5, halfHeight: 12 / (5 * TILT) };
  const labels = cityLabelPlacements(cities, 5, TILT, width, [blocker]);
  assert.ok(labels.has(capital.id));
  assert.ok(labels.size < cities.length && labels.size > 1);
  assert.deepEqual(labels, cityLabelPlacements([...cities].reverse(), 5, TILT, width, [blocker]));
  for (const a of labels.values()) {
    assert.ok(!overlap(a.box, blocker));
    for (const b of labels.values()) if (a !== b) assert.ok(!overlap(a.box, b.box));
  }
  assert.deepEqual(cities, original);
  assert.equal(cityLabelPlacements(cities, 3, TILT, width).size, 0);
  assert.equal(cityLabelPlacements(cities, NaN, TILT, width).size, 0);
  assert.equal(cityLabelPlacements(cities, 5, 0, width).size, 0);
  assert.equal(cityLabelPlacements([capital], 5, TILT, () => NaN).size, 0);
});

test('real European High/Ultra city labels fit the viewport without overlapping military counters', () => {
  const state = createWorldState('labels', 'LABELS', 'host', 'Test');
  const scene = mapSceneFor(state);
  const berlin = scene.cities.find(c => c.id === state.countries.germany!.capitalCityId)!;
  for (const preset of ['High', 'Ultra'] as const) for (const viewport of [{ width: 1280, height: 580 }, { width: 1600, height: 580 }, { width: 1920, height: 940 }]) {
    const camera = { ...berlin.point, zoom: 5 }, bounds = visibleBounds(camera, viewport, 0);
    const cities = visibleCities(scene.cities, bounds, camera.zoom, preset);
    const blockers = state.armies.map(a => scene.provinceGeometry.get(a.provinceId)!).map(f => ({ ...f.anchor, halfWidth: 27 / camera.zoom, halfHeight: 12 / (camera.zoom * TILT) }));
    const labels = cityLabelPlacements(cities, camera.zoom, TILT, width, blockers, bounds);
    assert.ok(labels.size > 5 && labels.size < cities.length);
    for (const a of labels.values()) {
      assert.ok(a.box.x - a.box.halfWidth! >= bounds.left && a.box.x + a.box.halfWidth! <= bounds.right);
      assert.ok(a.box.y - a.box.halfHeight! >= bounds.top && a.box.y + a.box.halfHeight! <= bounds.bottom);
      assert.ok(blockers.every(b => !overlap(a.box, b)));
      for (const b of labels.values()) if (a !== b) assert.ok(!overlap(a.box, b.box));
    }
  }
});
