import { Point, project } from './geometry';
export interface TerrainPatch { type: 'mountain' | 'forest' | 'desert'; points: Point[] }
const points = (data: number[][]): Point[] => data.map(p => project(p[0]!, p[1]!));
// Hand-authored, stylized geographic bands; not a real elevation model.
export const terrainPatches: TerrainPatch[] = [
  { type: 'mountain', points: points([[6,45],[8,46],[10,47],[12,47],[14,46],[16,47]]) },
  { type: 'mountain', points: points([[-1,43],[0,42.7],[1,42.6],[2,42.6]]) },
  { type: 'mountain', points: points([[9,44],[11,43],[13,42],[15,40],[16,39]]) },
  { type: 'mountain', points: points([[40,43],[42,43],[44,42],[46,42]]) },
  { type: 'mountain', points: points([[59,54],[60,56],[60,58],[59,60],[59,62],[58,64]]) },
  { type: 'forest', points: points([[6,48],[7,49],[8,49],[9,50],[10,51]]) },
  { type: 'forest', points: points([[23,54],[26,55],[29,56],[34,56],[38,57],[43,57],[48,58],[55,59]]) },
  { type: 'desert', points: points([[31,37],[33,38],[35,38],[37,38]]) },
  { type: 'desert', points: points([[70,44],[74,43],[78,42],[82,42]]) },
];
export const rivers: Point[][] = [
  points([[8.7,47.6],[7.6,48.5],[8.2,49],[7.6,50.4],[6.8,51.4],[5,51.9],[4.1,51.9]]),
  points([[8.2,48],[11,48.7],[13.5,48.6],[16.4,48.2],[19,47.5],[20.5,45.2],[25,43.8],[29.5,45.2]]),
  points([[33,57],[36,56],[42,56],[44,54],[48,52],[49,49],[46,46]]),
];
export const lakes = [ { point: project(9.4,47.6), radius: 0.8 }, { point: project(31.4,60.9), radius: 2.5 }, { point: project(33.3,62), radius: 2 } ];
