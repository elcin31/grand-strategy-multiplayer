import type {Country} from '../types/game';
import type {CountryLabel} from './scene';
export interface CountryGlyph {label:CountryLabel;name:string;width:number;scale:number}
/** Shared paint/hit layout: no invisible country target for a culled label. */
export function countryGlyph(label:CountryLabel,country:Country,zoom:number,measure:(name:string)=>number):CountryGlyph|null {
  if(label.blocked||zoom>=8)return null;
  const full=measure(country.name),name=label.width*zoom/(full+12)<.8?country.shortName:country.name;
  const width=measure(name),scale=Math.min(1.7,label.width*zoom/(width+38));
  return scale<.55?null:{label,name,width,scale};
}
export function hitCountryGlyph(glyph:CountryGlyph,x:number,y:number,preparedZoom:number,tilt:number):boolean {
  const px=(x-glyph.label.anchor.x)*preparedZoom/glyph.scale,py=(y-glyph.label.anchor.y)*preparedZoom*tilt/glyph.scale;
  return px>=-glyph.width/2-26&&px<=glyph.width/2+4&&Math.abs(py)<=Math.max(14,22/glyph.scale);
}
