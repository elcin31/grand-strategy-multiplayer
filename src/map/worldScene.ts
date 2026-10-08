import {recordMetrics} from '../performance/telemetry';
import type { GameState } from '../types/game';
import { worldCountries } from '../world/catalog';
import { cityDefinitions } from '../../supabase/functions/_shared/worldDefinitions';
import { boundsOf, MapFeature, Point, SpatialIndex } from './geometry';
import { buildEdges, features as legacyFeatures, spatialIndex, provinceGeometry, edges } from './scene';
import { mapCities, type MapCity } from './cities';
export interface MapScene {
  features: MapFeature[]; spatialIndex: SpatialIndex; provinceGeometry: Map<string, MapFeature>;
  edges: ReturnType<typeof buildEdges>; cities: MapCity[];
}
const legacy: MapScene = { features: legacyFeatures, spatialIndex, provinceGeometry, edges, cities: mapCities };
let world: MapScene | undefined;
function* buildScene(state: Pick<GameState, 'dataset'>): Generator<void,MapScene> {
  if (!state.dataset) return legacy;
  if (state.dataset !== 'modern-world-v2') throw new Error('Unsupported world dataset');
  if (world) return world;
  const geometry = require('../world/data/geometry.json') as { id: string; anchor: number[]; polygons: number[][][][] }[];
  const owners = new Map(worldCountries.flatMap(c => c.provinceIds.map(id => [id, c.id] as const)));
  const points = require('../world/data/city-points.json') as { id: string; point: number[] }[];
  const cityPoints = new Map(points.map(c => [c.id, { x: c.point[0]!, y: c.point[1]! }]));
  const provinces: MapFeature[] = [];
  for (const [i,g] of geometry.entries()) {
    if(i%64===0)yield;
    const polygons: Point[][][] = g.polygons.map(rings => rings.map(ring => ring.map(p => ({ x: p[0]!, y: p[1]! }))));
    const owner = owners.get(g.id);
    if (!owner) throw new Error('Unknown province geometry');
    provinces.push({ id: g.id, name: g.id, provinceId: g.id, countryId: owner, anchor: { x: g.anchor[0]!, y: g.anchor[1]! }, bounds: boundsOf(polygons.flat(2)), polygons });
  }
  yield;
  const features = [...legacyFeatures.filter(f => !f.provinceId), ...provinces];
  world = { features, spatialIndex: new SpatialIndex(features), provinceGeometry: new Map(provinces.map(f => [f.id, f])), edges: buildEdges(provinces), cities: cityDefinitions.map(c => {
    const point = cityPoints.get(c.id);
    if (!point) throw new Error('Missing city coordinates');
    return { id: c.id, name: c.name, provinceId: c.provinceId, capital: c.isCapital, population: c.population, point };
  }) };
  return world;
}

export function mapSceneFor(state:Pick<GameState,"dataset">):MapScene{const steps=buildScene(state);let step=steps.next();while(!step.done)step=steps.next();return step.value;}
let preparing:Promise<MapScene>|undefined;
export function prepareWorldScene(state:Pick<GameState,"dataset">):Promise<MapScene>{
 if(world||!state.dataset)return Promise.resolve(mapSceneFor(state));
 return preparing??=(async()=>{const started=performance.now();const steps=buildScene(state);let step=steps.next();while(!step.done){await new Promise<void>(resolve=>setTimeout(resolve,0));step=steps.next();}recordMetrics({sceneMs:performance.now()-started});return step.value;})().catch(error=>{preparing=undefined;throw error;});
}
