import {type CountryGlyph} from '../map/countryTargets';
import {withNativeRecordingObjects} from '../map/nativeRecording';
import {memo,useMemo} from 'react';
import {Group,Picture,Skia,PaintStyle,type SkFont} from '@shopify/react-native-skia';
import type {GameState} from '../types/game';
import {TILT} from '../map/camera';
import type {MapFeature} from '../map/geometry';
import type {MapCity} from '../map/cities';
import type {DisplayArmy} from '../map/markerBudget';
import type {CityLabelPlacement,CountryLabel} from '../map/scene';
import {constructionProgress} from '../map/overlays';
import {GRAPHICS,type GraphicsPreset} from '../map/settings';
import {mapSymbol} from './MapEconomyLayer';
import {SEA_LABELS} from '../map/atlas22';
import {project} from '../map/geometry';
const compact=(value:number)=>value>=1e6?(value/1e6).toFixed(1)+'M':Math.round(value/1e3)+'K';
interface Props {state:GameState;zoom:number;preset:GraphicsPreset;labels:CountryLabel[];countryGlyphs:CountryGlyph[];cities:MapCity[];cityLabels:Map<string,CityLabelPlacement>;counters:DisplayArmy[];countryId:string|null;armyId?:string|null;cityId?:string|null;provinceId:string|null;geometry:ReadonlyMap<string,MapFeature>;visible:ReadonlySet<string>;font:SkFont;counterFont:SkFont;nationFont:SkFont;labelBudget:number}
/** One retained native display node replaces hundreds of animated inverse-scale
 * groups. Pan never records glyphs; zoom changes size smoothly until coverage
 * commits, then exact screen-sized glyphs are recorded at the settled scale. */
export const MapMarkerLayer=memo(function MapMarkerLayer(props:Props){
  const picture=useMemo(()=>withNativeRecordingObjects(own=>{
    const paints=new Map<string,ReturnType<typeof Skia.Paint>>();
    const paint=(color:string,stroke=0)=>{
      const key=color+'|'+stroke;let p=paints.get(key);if(p)return p;
      p=own(Skia.Paint());p.setAntiAlias(true);p.setColor(Skia.Color(color));if(stroke){p.setStyle(PaintStyle.Stroke);p.setStrokeWidth(stroke);}paints.set(key,p);return p;
    };
    const {state,zoom,preset,countryGlyphs,cities,cityLabels,counters,countryId,armyId,cityId,provinceId,geometry,visible,font,counterFont,nationFont,labelBudget}=props;
    const recorder=own(Skia.PictureRecorder()),canvas=recorder.beginRecording(Skia.XYWHRect(-100,-100,1640,920));
    const anchor=(x:number,y:number)=>{canvas.save();canvas.translate(x,y);canvas.scale(1/zoom,1/(zoom*TILT));};
    let remaining=labelBudget;
    for(const [name,lon,lat]of SEA_LABELS){const q=project(lon,lat);if(zoom<1.7&&!name.includes('ОКЕАН')||zoom>1.7&&name.includes('ОКЕАН'))continue;anchor(q.x,q.y);const w=nationFont.measureText(name).width;canvas.drawText(name,-w/2,0,paint('#729bad'),nationFont);canvas.restore();}
    const selected=provinceId?geometry.get(provinceId):undefined;
    if(selected&&visible.has(provinceId!)){
      const name=state.provinces.find(p=>p.id===provinceId)?.name;
      if(name){anchor(selected.anchor.x,selected.anchor.y);canvas.drawText(name,8,-15,paint('#FFF0AC'),font);canvas.restore();remaining--;}
    }
    for(const glyph of countryGlyphs){
      const {label,name,width,scale}=glyph;
      anchor(label.anchor.x,label.anchor.y);canvas.scale(scale,scale);
      canvas.drawText(name,-width/2+.7,4.7,paint('#0C1721'),nationFont);canvas.drawText(name,-width/2,4,paint('#F1E6CB'),nationFont);
      canvas.restore();remaining--;
    }
    const ordered=[...cities].sort((a,b)=>Number(b.id===cityId)-Number(a.id===cityId)||Number(b.capital)-Number(a.capital)||b.population-a.population);
    for(const city of ordered){
      anchor(city.point.x,city.point.y);
      if(GRAPHICS[preset].shadows&&city.capital)canvas.drawCircle(0,0,7,paint('#ebd6a129'));
      if(city.capital){canvas.drawPath(mapSymbol('star'),paint('#f1dca8'));canvas.drawPath(mapSymbol('star'),paint('#5c4930',.8));}else if(zoom>=7){canvas.save();canvas.scale(.38,.38);canvas.drawPath(mapSymbol('city'),paint('#dec896',2.4));canvas.restore();}else canvas.drawCircle(0,0,city.regionalCapital?2.8:2,paint('#dfd2ad'));
      if(city.id===cityId)canvas.drawCircle(0,0,9,paint('#ffffff',2));

      const placement=cityLabels.get(city.id);if(placement&&remaining>0){canvas.drawText(city.name,placement.dx+.8,placement.dy+.8,paint('#071a24'),font);canvas.drawText(city.name,placement.dx,placement.dy,paint('#fff0d2'),font);remaining--;}
      canvas.restore();
    }
    const moving=new Set(state.armies.filter(a=>a.order).map(a=>a.id)),combat=new Set(state.battleLog.filter(b=>state.tick-b.tick<=1).map(b=>b.provinceId));
    const shield=own(Skia.Path.MakeFromSVGString('M-29,-6L-16,-6L-17,3L-23,8L-28,3Z')!),swords=own(Skia.Path.MakeFromSVGString('M-27,-2L-19,4M-19,-2L-27,4')!),arrow=own(Skia.Path.MakeFromSVGString('M25,-5L31,-2L25,1Z')!);
    for(const counter of counters){
      const selected=counter.ids.includes(armyId??''),mixed=counter.ownerIds.length>1;
      anchor(counter.x,counter.y);
      if(counter.stack)canvas.drawRect(Skia.XYWHRect(-31,-13,68,23),paint('#37424A'));
      canvas.drawRect(Skia.XYWHRect(-34,-10,68,23),paint(mixed?'#25313C':counter.ownerId===countryId?'#152A28':'#2B2028'));
      canvas.drawRect(Skia.XYWHRect(-34,-10,68,23),paint(selected?'#FFE1A0':mixed?'#AAB6BC':counter.ownerId===countryId?'#C6A76A':'#976F69',selected?2.5:1));
      canvas.drawPath(shield,paint(mixed?'#778B93':state.countries[counter.ownerId]?.color??'#778B93'));
      canvas.drawPath(swords,paint('#ECE0C7',1));canvas.drawText(compact(counter.troops),-11,6,paint('#F0E5D0'),counterFont);
      if(counter.ids.some(id=>moving.has(id)))canvas.drawPath(arrow,paint('#DCC286'));
      if(combat.has(counter.provinceId))canvas.drawCircle(30,9,2.5,paint('#E3947B'));canvas.restore();
    }
    for(const c of (state.constructions??[]).filter(c=>visible.has(c.provinceId)).slice(0,zoom<4?8:20)){
      const f=geometry.get(c.provinceId);if(!f)continue;anchor(f.anchor.x,f.anchor.y);
      canvas.drawRect(Skia.XYWHRect(-18,16,36,5),paint('#182633'));canvas.drawRect(Skia.XYWHRect(-18,16,36*(constructionProgress(state,c.provinceId)??0),5),paint('#C6A76A'));canvas.restore();
    }
    return recorder.finishRecordingAsPicture();
  }),[props]);
  return <Group><Picture picture={picture}/></Group>;
});
