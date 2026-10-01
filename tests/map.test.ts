import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boundedCamera, screenToWorld, worldToScreen, visibleBounds, zoomAt } from '../src/map/camera';
import { boundsOf, contains, distanceToFeature, featurePath, MapFeature, project, SpatialIndex, tileKeys } from '../src/map/geometry';
import { borderPaths, buildEdges, buildProvinceColors, features, provinceGeometry, spatialIndex, troopsByProvince, visibleCities } from '../src/map/scene';
import { createInitialGame, provinces } from '../src/data/world';
import { mapCities } from '../src/map/cities';
import { AVAILABLE_MODES, GRAPHICS } from '../src/map/settings';
const viewport = { width: 1280, height: 720 };
const ring = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 20 }, { x: 0, y: 0 }];
const square: MapFeature = { id: 'test', name: 'Test', countryId: 'test', provinceId: 'test', polygons: [[ring]], bounds: boundsOf(ring), anchor: { x: 5, y: 5 } };
test('project and camera transforms round trip for all display ratios and zooms', () => {
  for (const width of [1280, 1600, 1920, 2560]) for (const zoom of [0.5, 1, 4, 18]) {
    const c = { x: 812, y: 154, zoom }, v = { width, height: 720 }, p = project(32.1, 48.2);
    const result = screenToWorld(worldToScreen(p, c, v), c, v);
    assert.ok(Math.abs(result.x - p.x) < 1e-8 && Math.abs(result.y - p.y) < 1e-8);
  }
});
test('pinch preserves the focal point and clamps all zooms', () => {
  const c = { x: 810, y: 200, zoom: 2 }, p = { x: 500, y: 320 };
  for (const factor of [0.1, 0.5, 2, 100]) {
    const before = screenToWorld(p, c, viewport), after = zoomAt(c, factor, p, viewport);
    const actual = screenToWorld(p, after, viewport);
    assert.ok(Math.abs(before.x - actual.x) < 1e-8 && Math.abs(before.y - actual.y) < 1e-8);
    assert.ok(after.zoom >= 0.5 && after.zoom <= 18);
  }
});
test('invalid camera values cannot propagate NaN or Infinity', () => {
  assert.deepEqual(boundedCamera({ x: NaN, y: Infinity, zoom: -1 }), { x: 0, y: 0, zoom: 0.5 });
  assert.deepEqual(tileKeys({ left: NaN, top: 0, right: 1, bottom: 1 }), []);
  assert.throws(() => boundsOf([]));
});
test('hit testing handles holes and multiple islands', () => {
  const hole = ring.map(p => ({ x: p.x / 2 + 5, y: p.y / 2 + 5 }));
  const island = ring.map(p => ({ x: p.x + 30, y: p.y }));
  const f = { ...square, polygons: [[ring, hole], [island]], bounds: { left: 0, top: 0, right: 50, bottom: 20 } };
  assert.equal(contains(f, { x: 2, y: 2 }), true);
  assert.equal(contains(f, { x: 10, y: 10 }), false);
  assert.equal(contains(f, { x: 40, y: 10 }), true);
  assert.equal(contains(f, { x: 60, y: 10 }), false);
  assert.equal(new SpatialIndex([f]).hit({ x: 40, y: 10 })?.id, 'test');
});
test('each legacy province has valid geographic geometry and interior anchor', () => {
  assert.equal(provinceGeometry.size, provinces.length);
  for (const p of provinces) {
    const f = provinceGeometry.get(p.id)!;
    assert.ok(f, p.id); assert.ok(contains(f, f.anchor), p.id);
    assert.ok(featurePath(f).startsWith('M'));
    assert.equal(spatialIndex.hit(f.anchor)?.provinceId, p.id);
  }
  assert.equal(new Set(features.map(f => f.id)).size, features.length);
});
test('spatial query returns no duplicate features and agrees with exhaustive lookup', () => {
  for (let i = 0; i < 1000; i++) {
    const bounds = visibleBounds({ x: (i * 79) % 1440, y: (i * 53) % 720, zoom: 12 }, viewport, 0);
    const found = spatialIndex.query(bounds);
    assert.equal(new Set(found.map(f => f.id)).size, found.length);
    for (const f of features.filter(f => f.anchor.x >= bounds.left && f.anchor.x <= bounds.right && f.anchor.y >= bounds.top && f.anchor.y <= bounds.bottom)) assert.ok(found.includes(f));
  }
});
test('shared border changes weight when a province is captured', () => {
  const left = { ...square, provinceId: 'fr-1' };
  const right = { ...square, id: 'right', provinceId: 'fr-2', polygons: [[ring.map(p => ({ x: p.x + 20, y: p.y }))]] };
  const edges = buildEdges([left, right]);
  assert.equal(edges.filter(e => e.provinces.length === 2).length, 1);
  const state = createInitialGame();
  const before = borderPaths(state, new Set(['fr-1','fr-2']));
  assert.ok(before.inner.length > 0);
  state.provinces.find(p => p.id === 'fr-2')!.ownerId = 'germany';
  assert.equal(borderPaths(state, new Set(['fr-1','fr-2'])).inner, '');
});
test('city LOD budget and graphic presets do not mutate campaign state', () => {
  const state = createInitialGame(), original = JSON.stringify(state);
  const bounds = { left: 0, top: 0, right: 1440, bottom: 720 };
  for (const preset of Object.keys(GRAPHICS) as (keyof typeof GRAPHICS)[]) {
    assert.ok(visibleCities(mapCities, bounds, 18, preset).length <= GRAPHICS[preset].cityBudget);
    assert.ok(visibleCities(mapCities, bounds, 1, preset).every(c => c.capital));
    troopsByProvince(state);
  }
  assert.equal(JSON.stringify(state), original);
});
test('scenario city coordinates belong to the assigned province or its generalized coast', () => {
  // 110m coastline generalization may place coastal city points just offshore.
  for (const c of mapCities) assert.ok(distanceToFeature(provinceGeometry.get(c.provinceId)!, c.point) < 1.2, c.name);
});
test('every available mode is derived from campaign values, with no mutation or invalid colors', () => {
  const state = createInitialGame(), original = structuredClone(state);
  for (const mode of AVAILABLE_MODES) {
    const colors = buildProvinceColors(state, mode, troopsByProvince(state));
    assert.equal(colors.size, state.provinces.length);
    assert.ok([...colors.values()].every(c => !c.includes('NaN') && !c.includes('Infinity')));
  }
  assert.deepEqual(state, original);
  const before = buildProvinceColors(state, 'Economy', troopsByProvince(state)).get('fr-1');
  state.provinces.find(p => p.id === 'fr-1')!.income = 2000;
  assert.notEqual(buildProvinceColors(state, 'Economy', troopsByProvince(state)).get('fr-1'), before);
  state.provinces = [];
  assert.equal(buildProvinceColors(state, 'Economy', new Map()).size, 0);
});
