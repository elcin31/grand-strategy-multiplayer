import {memo,useMemo,useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import Svg,{Path,Rect} from 'react-native-svg';
import type {GameState} from '../types/game';
import type {MapScene} from '../map/worldScene';
import {featurePath} from '../map/geometry';
import {renderFeaturesFor} from '../map/countryRender';
import {geometryForLod} from '../map/geometryLod';
import type {Camera} from '../map/camera';
import {TILT} from '../map/camera';
import {colors} from '../ui/tokens';
const cachedPaths=new WeakMap<object,string>();
export const MiniMap=memo(function MiniMap({state,scene,camera,viewport,onMove,onWorld,onFocus}:{state:GameState;scene:MapScene;camera:Camera;viewport:{width:number;height:number};onMove:(c:Camera)=>void;onWorld?:()=>void;onFocus?:()=>void}){
 const [open,setOpen]=useState(true);
 const ownershipKey=state.provinces.map(p=>p.ownerId).join('|')+'#'+Object.values(state.countries).map(c=>c.color).join('|');
 const shapes=useMemo(()=>{const owners=new Map(state.provinces.map(p=>[p.id,p.ownerId]));return renderFeaturesFor(scene,owners,true).map(f=>{let path=cachedPaths.get(f);if(!path){path=featurePath(geometryForLod(f,'low'));cachedPaths.set(f,path);}return {id:f.id,path,color:state.countries[owners.get(f.provinceId??'')??f.countryId??'']?.color??'#34484f'};});},[scene,ownershipKey]);
 const w=viewport.width/camera.zoom,h=viewport.height/(camera.zoom*TILT);
 return <View style={{position:'absolute',right:4,bottom:4,backgroundColor:'#101d2bf5',borderWidth:1,borderColor:colors.border,borderRadius:4}}><View style={{flexDirection:'row',justifyContent:'space-between',width:144}}>{[[onWorld,'◎','Обзор мира'],[onFocus,'⌖','К выбранному'],[()=>setOpen(v=>!v),open?'−':'+','Скрыть или показать мини-карту']].map(([action,label,accessibility])=><Pressable key={String(accessibility)} accessibilityRole="button" accessibilityLabel={String(accessibility)} style={{width:48,height:44,justifyContent:'center',alignItems:'center'}} onPress={action as ()=>void}><Text style={{color:colors.gold,fontSize:17}}>{String(label)}</Text></Pressable>)}</View>{open&&<Pressable accessibilityRole="button" accessibilityLabel="Быстрое перемещение по мини-карте" onPress={e=>onMove({x:e.nativeEvent.locationX/144*1440,y:e.nativeEvent.locationY/72*720,zoom:camera.zoom})}><Svg width={144} height={72} viewBox="0 0 1440 720" pointerEvents="none"><Rect width={1440} height={720} fill="#162b37"/>{shapes.map(f=><Path key={f.id} d={f.path} fill={f.color}/>)}<Rect x={camera.x-w/2} y={camera.y-h/2} width={w} height={h} fill="none" stroke="#fff0bc" strokeWidth={8}/></Svg></Pressable>}</View>;
});
