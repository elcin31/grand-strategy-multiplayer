import type {Bounds,Point} from './geometry';
const CELL=60;
const cache=new WeakMap<readonly object[],Map<string,{point:Point}[]>>();
/** Immutable array identity owns one bounded spatial index, reused during camera motion. */
export function pointsInBounds<T extends {point:Point}>(points:readonly T[],bounds:Bounds):T[]{
 let cells=cache.get(points);if(!cells){cells=new Map();for(const point of points){const key=Math.floor(point.point.x/CELL)+','+Math.floor(point.point.y/CELL);const bucket=cells.get(key)??[];bucket.push(point);cells.set(key,bucket);}cache.set(points,cells);}
 const result:T[]=[];
 for(let x=Math.floor(bounds.left/CELL);x<=Math.floor(bounds.right/CELL);x++)for(let y=Math.floor(bounds.top/CELL);y<=Math.floor(bounds.bottom/CELL);y++)for(const p of cells.get(x+','+y)??[])if(p.point.x>=bounds.left&&p.point.x<=bounds.right&&p.point.y>=bounds.top&&p.point.y<=bounds.bottom)result.push(p as T);
 return result;
}
