import {Skia,type SkImage} from '@shopify/react-native-skia';
import {getWorldFlag} from '../world/catalog';
// 195 small 60×42 CPU sprites: <2 MB even when the whole catalogue is visited.
const cache=new Map<string,SkImage|null>();
export function countryFlagImage(id:string):SkImage|null {
  if(cache.has(id))return cache.get(id)!;
  const source=getWorldFlag(id),svg=source?Skia.SVG.MakeFromString(source):null,surface=svg?Skia.Surface.Make(60,42):null;
  let image:SkImage|null=null;
  if(surface&&svg){try{const c=surface.getCanvas();c.clear(Skia.Color('transparent'));c.drawSvg(svg,60,42);surface.flush();image=surface.makeImageSnapshot();}finally{surface.dispose();svg.dispose();}}
  cache.set(id,image);return image;
}
