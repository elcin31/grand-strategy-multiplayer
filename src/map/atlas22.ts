import type {Bounds} from './geometry';
import type {GraphicsPreset,MapMode} from './settings';
export type AtlasLevel='world'|'region'|'province';
export interface AtlasTile {key:string;level:AtlasLevel;bounds:Bounds;imageBounds:Bounds;terrain:number;relief:number}
export const smoothDetail=(zoom:number,start:number,end:number)=>{const t=Math.max(0,Math.min(1,(zoom-start)/(end-start)));return t*t*(3-2*t);};
export function atlasLevel(zoom:number,preset:GraphicsPreset):AtlasLevel {
  if(preset==='Performance'||zoom<1.65)return 'world';
  return zoom>=(preset==='Balanced'?8:5.5)?'province':'region';
}
export function stableAtlasLevel(zoom:number,preset:GraphicsPreset,previous:AtlasLevel):AtlasLevel {
  if(preset==='Performance')return 'world';
  const region=previous==='world'?1.85:1.45,province=preset==='Balanced'?8:5.5;
  if(zoom<region)return 'world';
  return zoom>=(previous==='province'?province*.88:province*1.12)?'province':'region';
}
export function atlasSurface(mode:MapMode):'terrain'|'relief'{return mode==='Terrain'||mode==='Province'?'terrain':'relief';}
export const SEA_LABELS=[
  ['АТЛАНТИЧЕСКИЙ ОКЕАН',-35,23],['ТИХИЙ ОКЕАН',-140,1],['ТИХИЙ ОКЕАН',158,0],
  ['ИНДИЙСКИЙ ОКЕАН',78,-22],['СЕВЕРНЫЙ ЛЕДОВИТЫЙ ОКЕАН',50,81],
  ['Средиземное море',18,35],['Чёрное море',34,43],['Каспийское море',51,42],
  ['Балтийское море',19,58],['Северное море',3,56],['Красное море',37,21],
  ['Карибское море',-75,15],['Южно-Китайское море',114,15],['Бенгальский залив',88,13],
  ['Аравийское море',64,16],['Мексиканский залив',-91,24],['Берингово море',-173,57],
  ['Охотское море',150,52],['Коралловое море',154,-18],['Тасманово море',163,-38],
] as const;
