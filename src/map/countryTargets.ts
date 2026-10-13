import type {Country} from '../types/game';
import type {CountryLabel} from './scene';
export interface CountryGlyph {label:CountryLabel;name:string;width:number;scale:number}
export const FLAG_ATLAS_COLUMNS=8,FLAG_ATLAS_CELL_WIDTH=64,FLAG_ATLAS_CELL_HEIGHT=46;
/** Prepared screen coordinates: one inverse camera scale keeps atlas sprites
 * exactly at the existing painted flag and its shared country hit target. */
export function countryFlagBatch(glyphs:readonly CountryGlyph[],zoom:number,tilt:number){
  return glyphs.map((glyph,index)=>{
    const tx=glyph.label.anchor.x*zoom+(-glyph.width/2-25)*glyph.scale;
    const ty=glyph.label.anchor.y*zoom*tilt-8*glyph.scale;
    return {id:glyph.label.countryId,source:{x:index%FLAG_ATLAS_COLUMNS*FLAG_ATLAS_CELL_WIDTH+2,y:Math.floor(index/FLAG_ATLAS_COLUMNS)*FLAG_ATLAS_CELL_HEIGHT+2,width:60,height:42},
      scale:glyph.scale/3,tx,ty,frame:{x:tx-glyph.scale,y:ty-glyph.scale,width:22*glyph.scale,height:16*glyph.scale}};
  });
}
/** Shared paint/hit layout: no invisible country target for a culled label. */
export function countryGlyph(label:CountryLabel,country:Country,zoom:number,measure:(name:string)=>number):CountryGlyph|null {
  if(label.blocked||zoom>=8)return null;
  const name=country.name;
  const width=measure(name),scale=Math.min(1.35,label.width*zoom/(width+12));
  return scale<.55?null:{label,name,width,scale};
}
export function hitCountryGlyph(glyph:CountryGlyph,x:number,y:number,preparedZoom:number,tilt:number):boolean {
  const px=(x-glyph.label.anchor.x)*preparedZoom/glyph.scale,py=(y-glyph.label.anchor.y)*preparedZoom*tilt/glyph.scale;
  return px>=-glyph.width/2-4&&px<=glyph.width/2+4&&Math.abs(py)<=Math.max(14,22/glyph.scale);
}
