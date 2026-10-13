import {memo,useMemo} from 'react';
import {Picture,Skia,PaintStyle,type SkFont} from '@shopify/react-native-skia';
import type {GameState} from '../types/game';
import type {Bounds} from '../map/geometry';
import type {MapScene} from '../map/worldScene';
import {provinceInstallations,tradeLinks,localInfrastructure,type EconomicFilter} from '../map/strategic22';
import {smoothDetail} from '../map/atlas22';
import {SYMBOLS} from '../map/symbols22';
import {TILT} from '../map/camera';
import {withNativeRecordingObjects} from '../map/nativeRecording';
import type {GraphicsPreset,MapMode} from '../map/settings';
const paths=new Map<string,ReturnType<typeof Skia.Path.Make>>();
export function mapSymbol(kind:string){let p=paths.get(kind);if(!p){p=Skia.Path.MakeFromSVGString(SYMBOLS[kind]??SYMBOLS.ore!)??Skia.Path.Make();paths.set(kind,p);}return p;}
export const MapEconomyLayer=memo(function MapEconomyLayer({state,scene,visible,bounds,zoom,preset,mode,filter,selected,font}:{state:GameState;scene:MapScene;visible:ReadonlySet<string>;bounds:Bounds;zoom:number;preset:GraphicsPreset;mode:MapMode;filter:EconomicFilter;selected?:string|null;font:SkFont}){
  const picture=useMemo(()=>withNativeRecordingObjects(own=>{
    const recorder=own(Skia.PictureRecorder()),c=recorder.beginRecording(Skia.XYWHRect(0,0,1440,720)),p=own(Skia.Paint());p.setAntiAlias(true);
    const active=mode==='Economy'?filter:mode==='Resources'?'Resources':'Province';
    if(!['Economy','Resources','Province'].includes(mode)&&zoom<8)return recorder.finishRecordingAsPicture();
    if(active==='Province'||active==='Infrastructure')for(const link of localInfrastructure(state,scene,visible,zoom)){
      const path=own(Skia.Path.Make());path.moveTo(link.from.x,link.from.y).lineTo(link.to.x,link.to.y);
      p.setStyle(PaintStyle.Stroke);p.setStrokeWidth(2.7/zoom);p.setColor(Skia.Color('#243130'));c.drawPath(path,p);
      p.setStrokeWidth(1.05/zoom);p.setColor(Skia.Color(link.rail?'#cad1c6':'#c3a275'));c.drawPath(path,p);
      if(link.rail){p.setPathEffect(Skia.PathEffect.MakeDash([2/zoom,3/zoom],0));p.setStrokeWidth(3.3/zoom);c.drawPath(path,p);p.setPathEffect(null);}
    }
    if(active==='Trade')for(const link of tradeLinks(state,scene,bounds)){
      const {from:a,to:b}=link,curve=own(Skia.Path.Make());const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2-Math.min(35,Math.abs(a.x-b.x)*.12)};
      curve.moveTo(a.x,a.y).quadTo(mid.x,mid.y,b.x,b.y);
      p.setStyle(PaintStyle.Stroke);p.setColor(Skia.Color(link.fulfilled>0?'#79c9d8':'#b89d71'));p.setStrokeWidth(1.25/zoom);p.setPathEffect(Skia.PathEffect.MakeDash([5/zoom,4/zoom],0));c.drawPath(curve,p);p.setPathEffect(null);
      p.setStyle(PaintStyle.Fill);c.drawCircle(a.x,a.y,2.6/zoom,p);c.drawCircle(b.x,b.y,2.6/zoom,p);
      const angle=Math.atan2(b.y-mid.y,b.x-mid.x),arrow=own(Skia.Path.Make());const size=6/zoom;arrow.moveTo(b.x,b.y).lineTo(b.x-Math.cos(angle-.45)*size,b.y-Math.sin(angle-.45)*size).lineTo(b.x-Math.cos(angle+.45)*size,b.y-Math.sin(angle+.45)*size).close();c.drawPath(arrow,p);
    }
    const installations=provinceInstallations(state,scene,visible,zoom,preset,active,selected);
    const occupied:{x:number;y:number}[]=[];
    for(const item of installations){
      const sx=item.point.x*zoom,sy=item.point.y*zoom*TILT;if(occupied.some(q=>Math.abs(q.x-sx)<25&&Math.abs(q.y-sy)<27))continue;occupied.push({x:sx,y:sy});
      c.save();c.translate(item.point.x,item.point.y);c.scale(1/zoom,1/(zoom*TILT));p.setAlphaf(smoothDetail(zoom,1.4,2.8));
      p.setStyle(PaintStyle.Fill);p.setColor(Skia.Color('#081a24df'));c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-15,-16,30,33),3,3),p);
      const path=mapSymbol(item.kind);
      c.save();c.translate(1.5,2);p.setStyle(PaintStyle.Stroke);p.setStrokeWidth(3);p.setColor(Skia.Color('#07161d'));c.drawPath(path,p);c.restore();
      p.setStrokeWidth(1.5);p.setColor(Skia.Color(item.color));c.drawPath(path,p);
      if(['oil','gas','gold','ore','coal','crystal','forest','field'].includes(item.kind)){p.setStyle(PaintStyle.Fill);p.setAlphaf(.38*smoothDetail(zoom,1.4,2.8));c.drawPath(path,p);p.setAlphaf(1);}
      if(!item.resource&&zoom>=7){p.setStyle(PaintStyle.Fill);p.setColor(Skia.Color('#ffe5aa'));c.drawText(String(item.level),9,17,p,font);}
      c.restore();
    }
    return recorder.finishRecordingAsPicture();
  }),[state,scene,visible,bounds,zoom,preset,mode,filter,selected,font]);
  return <Picture picture={picture}/>;
});
