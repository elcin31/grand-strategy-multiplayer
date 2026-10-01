import { Bounds, Point, WORLD_HEIGHT, WORLD_WIDTH } from './geometry';
export interface Camera { x: number; y: number; zoom: number }
export interface Viewport { width: number; height: number }
export const TILT = 0.92;
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 18;
export function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}
export function boundedCamera(camera: Camera): Camera {
  'worklet';
  return { x: clamp(camera.x, 0, WORLD_WIDTH), y: clamp(camera.y, 0, WORLD_HEIGHT), zoom: clamp(camera.zoom, MIN_ZOOM, MAX_ZOOM) };
}
export function worldToScreen(p: Point, c: Camera, v: Viewport): Point {
  'worklet';
  return { x: (p.x - c.x) * c.zoom + v.width / 2, y: (p.y - c.y) * c.zoom * TILT + v.height / 2 };
}
export function screenToWorld(p: Point, c: Camera, v: Viewport): Point {
  'worklet';
  return { x: (p.x - v.width / 2) / c.zoom + c.x, y: (p.y - v.height / 2) / (c.zoom * TILT) + c.y };
}
export function zoomAt(c: Camera, factor: number, focal: Point, viewport: Viewport): Camera {
  'worklet';
  const world = screenToWorld(focal, c, viewport);
  const zoom = clamp(c.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  return boundedCamera({ x: world.x - (focal.x - viewport.width / 2) / zoom, y: world.y - (focal.y - viewport.height / 2) / (zoom * TILT), zoom });
}
export function visibleBounds(c: Camera, v: Viewport, padding = 120): Bounds {
  const a = screenToWorld({ x: -padding, y: -padding }, c, v);
  const b = screenToWorld({ x: v.width + padding, y: v.height + padding }, c, v);
  return { left: a.x, top: a.y, right: b.x, bottom: b.y };
}
