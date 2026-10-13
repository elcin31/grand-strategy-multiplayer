import {memo,useMemo} from 'react';
import {Picture,Skia,PaintStyle,ClipOp,type SkFont} from '@shopify/react-native-skia';
import type {GameState} from '../types/game';
import type {MapScene} from '../map/worldScene';
import type {MapFeature,Point} from '../map/geometry';
import {featurePath} from '../map/geometry';
import {mapOrders} from '../map/strategic22';
import {mapSymbol} from './MapEconomyLayer';
import {withNativeRecordingObjects} from '../map/nativeRecording';
import {GRAPHICS,type GraphicsPreset} from '../map/settings';
import {TILT} from '../map/camera';
import {countryFlagImage} from '../map/flags22';
export const MapOperationsLayer=memo(function MapOperationsLayer({state,scene,visible,zoom,preset,military,armyId,countryId,occupations,font}:{state:GameState;scene:MapScene;visible:ReadonlySet<string>;zoom:number;preset:GraphicsPreset;military:boolean;armyId?:string|null;countryId?:string|null;occupations:MapFeature[];font:SkFont}){
  const picture=useMemo(()=>withNativeRecordingObjects(own=>{
    const r=own(Skia.PictureRecorder()),c=r.beginRecording(Skia.XYWHRect(0,0,1440,720)),p=own(Skia.Paint());p.setAntiAlias(true);
    for(const f of occupations){
      const mask=own(Skia.Path.MakeFromSVGString(featurePath(f))??Skia.Path.Make());mask.setFillType(1);
      c.save();c.clipPath(mask,ClipOp.Intersect,true);p.setStyle(PaintStyle.Stroke);p.setColor(Skia.Color('#b26a53'));p.setAlphaf(.48);p.setStrokeWidth(2.4/zoom);
      const hatch=own(Skia.Path.Make()),b=f.bounds,step=10/zoom;
      for(let x=b.left-(b.bottom-b.top);x<b.right;x+=step)hatch.moveTo(x,b.bottom).lineTo(x+b.bottom-b.top,b.top);
      c.drawPath(hatch,p);c.restore();
    }
    p.setAlphaf(1);
    const orders=mapOrders(state,scene,visible,armyId,countryId,GRAPHICS[preset].routeBudget).filter(o=>military||o.selected);
    for(const order of orders){
      const path=own(Skia.Path.Make());order.points.forEach((q,i)=>i?path.lineTo(q.x,q.y):path.moveTo(q.x,q.y));
      const color=order.selected?'#ffe2a0':order.attack?'#e07059':order.redeploy?'#c2b1e1':'#66bfd9';
      p.setStyle(PaintStyle.Stroke);p.setStrokeWidth((order.selected?4:3)/zoom);p.setColor(Skia.Color('#09212dd9'));c.drawPath(path,p);
      p.setStrokeWidth((order.selected?2:1.4)/zoom);p.setColor(Skia.Color(color));if(order.redeploy)p.setPathEffect(Skia.PathEffect.MakeDash([6/zoom,4/zoom],0));c.drawPath(path,p);p.setPathEffect(null);
      const a=order.points.at(-2)!,b=order.target,angle=Math.atan2((b.y-a.y)*TILT,b.x-a.x),size=9/zoom;
      const arrow=own(Skia.Path.Make());arrow.moveTo(b.x,b.y).lineTo(b.x-Math.cos(angle-.42)*size,b.y-Math.sin(angle-.42)*size/TILT).lineTo(b.x-Math.cos(angle+.42)*size,b.y-Math.sin(angle+.42)*size/TILT).close();p.setStyle(PaintStyle.Fill);c.drawPath(arrow,p);
      c.drawCircle(b.x,b.y,3.5/zoom,p);
      if(order.selected){c.save();c.translate(b.x,b.y);c.scale(1/zoom,1/(zoom*TILT));p.setColor(Skia.Color('#091e2aed'));c.drawRect(Skia.XYWHRect(7,-17,68,16),p);p.setColor(Skia.Color('#ffe2a0'));c.drawText(`ETA ${order.eta} дн.`,10,-5,p,font);c.restore();}
    }
    const anchor=(q:Point)=>{c.save();c.translate(q.x,q.y);c.scale(1/zoom,1/(zoom*TILT));};
    const flag=(id:string,x:number)=>{const flag=countryFlagImage(id);if(flag)c.drawImageRect(flag,Skia.XYWHRect(0,0,60,42),Skia.XYWHRect(x,-21,15,10),p);};
    for(const battle of (state.activeBattles??[]).filter(b=>visible.has(b.provinceId)).slice(0,12)){
      const q=scene.provinceGeometry.get(battle.provinceId)?.anchor;if(!q)continue;anchor(q);p.setStyle(PaintStyle.Fill);p.setColor(Skia.Color('#13202de8'));c.drawCircle(0,-22,13,p);
      c.save();c.translate(0,-22);p.setStyle(PaintStyle.Stroke);p.setColor(Skia.Color('#f2ba78'));p.setStrokeWidth(1.6);c.drawPath(mapSymbol('arms'),p);c.restore();
      p.setStyle(PaintStyle.Fill);flag(battle.attackerId,-34);flag(battle.defenderId,19);
      const attacker=Math.max(0,battle.attackerInitial-battle.attackerLosses),defender=Math.max(0,battle.defenderInitial-battle.defenderLosses),share=attacker/Math.max(1,attacker+defender);
      p.setColor(Skia.Color('#a8584c'));c.drawRect(Skia.XYWHRect(-22,-8,44,3),p);p.setColor(Skia.Color('#78b6c6'));c.drawRect(Skia.XYWHRect(-22,-8,44*share,3),p);c.restore();
    }
    for(const siege of (state.sieges??[]).filter(b=>visible.has(b.provinceId)).slice(0,12)){
      const q=scene.provinceGeometry.get(siege.provinceId)?.anchor;if(!q)continue;anchor(q);p.setStyle(PaintStyle.Fill);p.setColor(Skia.Color('#18212eed'));c.drawRect(Skia.XYWHRect(-26,-39,52,23),p);
      c.save();c.translate(-15,-27);c.scale(.6,.6);p.setStyle(PaintStyle.Stroke);p.setColor(Skia.Color('#e9ae6c'));p.setStrokeWidth(2);c.drawPath(mapSymbol('fort'),p);c.restore();p.setStyle(PaintStyle.Fill);
      p.setColor(Skia.Color('#edcd95'));c.drawText(`${siege.progress.toFixed(0)}%`,-3,-24,p,font);
      p.setColor(Skia.Color('#3c3029'));c.drawRect(Skia.XYWHRect(-25,-18,50,3),p);p.setColor(Skia.Color('#d1a667'));c.drawRect(Skia.XYWHRect(-25,-18,50*siege.progress/100,3),p);c.restore();
    }
    return r.finishRecordingAsPicture();
  }),[state,scene,visible,zoom,preset,military,armyId,countryId,occupations,font]);
  return <Picture picture={picture}/>;
});
