import {memo,useEffect,useMemo} from 'react';
import {Group,Picture,Skia,PaintStyle,type SkFont} from '@shopify/react-native-skia';
import {useSharedValue,useDerivedValue,withTiming,cancelAnimation,Easing,type SharedValue} from 'react-native-reanimated';
import type {DisplayArmy} from '../map/markerBudget';
import type {Point} from '../map/geometry';
import {TILT} from '../map/camera';
import {countryFlagImage} from '../map/flags22';
import {withNativeRecordingObjects} from '../map/nativeRecording';
export interface MarkerPosition{x:SharedValue<number>;y:SharedValue<number>}
export const AnimatedArmyMarker=memo(function AnimatedArmyMarker({counter,target,duration,paused,zoom,selected,own,color,font,onPosition,status='Hold',supply=100}:{counter:DisplayArmy;target:Point;duration:number;paused:boolean;zoom:number;selected:boolean;own:boolean;color:string;font:SkFont;onPosition:(key:string,position:MarkerPosition|null)=>void;status?:'Hold'|'Battle'|'Siege'|'March'|'Formation';supply?:number}){
 const x=useSharedValue(target.x),y=useSharedValue(target.y);
 useEffect(()=>{if(paused){cancelAnimation(x);cancelAnimation(y);x.value=withTiming(target.x,{duration:120,easing:Easing.linear});y.value=withTiming(target.y,{duration:120,easing:Easing.linear});}else{x.value=withTiming(target.x,{duration,easing:Easing.linear});y.value=withTiming(target.y,{duration,easing:Easing.linear});}},[target.x,target.y,duration,paused]);
 useEffect(()=>{onPosition(counter.key,{x,y});return()=>onPosition(counter.key,null);},[counter.key,onPosition,x,y]);
 const transform=useDerivedValue(()=>[{translateX:x.value},{translateY:y.value},{scaleX:1/zoom},{scaleY:1/(zoom*TILT)}]);
 const picture=useMemo(()=>withNativeRecordingObjects(ownObject=>{
  const mixed=counter.ownerIds.length>1;const recorder=ownObject(Skia.PictureRecorder()),canvas=recorder.beginRecording(Skia.XYWHRect(-40,-18,80,42)),paint=ownObject(Skia.Paint());paint.setAntiAlias(true);if(counter.stack){paint.setColor(Skia.Color('#37424A'));canvas.drawRect(Skia.XYWHRect(-31,-13,68,23),paint);}paint.setColor(Skia.Color(mixed?'#25313C':own?'#152A28':'#2B2028'));canvas.drawRect(Skia.XYWHRect(-34,-10,68,23),paint);
  paint.setColor(Skia.Color(selected?'#FFE1A0':mixed?'#AAB6BC':own?'#C6A76A':'#976F69'));paint.setStyle(PaintStyle.Stroke);paint.setStrokeWidth(selected?2.5:1);canvas.drawRect(Skia.XYWHRect(-34,-10,68,23),paint);
  paint.setStyle(PaintStyle.Fill);paint.setColor(Skia.Color(mixed?'#778B93':color));const flag=!mixed?countryFlagImage(counter.ownerId):null;if(flag)canvas.drawImageRect(flag,Skia.XYWHRect(0,0,60,42),Skia.XYWHRect(-29,-6,18,12),paint);else canvas.drawRect(Skia.XYWHRect(-29,-5,13,12),paint);paint.setColor(Skia.Color('#F0E5D0'));canvas.drawText(counter.troops>=1e6?(counter.troops/1e6).toFixed(1)+'M':Math.round(counter.troops/1e3)+'K',-6,6,paint,font);
  if(counter.moving){const arrow=ownObject(Skia.Path.MakeFromSVGString('M25,-5L31,-2L25,1Z')!);paint.setColor(Skia.Color('#DCC286'));canvas.drawPath(arrow,paint);}
  paint.setColor(Skia.Color('#243c38'));canvas.drawRect(Skia.XYWHRect(-33,11,66,2),paint);paint.setColor(Skia.Color(status==='Battle'?'#d77457':status==='Siege'?'#d0a46a':supply<40?'#c1745b':'#67a696'));canvas.drawRect(Skia.XYWHRect(-33,11,66*Math.max(0,Math.min(1,supply/100)),2),paint);
  if(status==='Battle'||status==='Siege'||status==='Formation'){paint.setColor(Skia.Color('#ead6a6'));canvas.drawText(status==='Battle'?'⚔':status==='Siege'?'◇':'⌂',23,6,paint,font);}
  return recorder.finishRecordingAsPicture();
 }),[counter.troops,counter.stack,counter.moving,counter.ownerIds.join('|'),color,selected,own,font,status,supply]);
 return <Group transform={transform}><Picture picture={picture}/></Group>;
});
