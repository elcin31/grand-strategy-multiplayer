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
export const MiniMap=memo(function MiniMap({state,scene,camera,viewport,onMove}:{state:GameState;scene:MapScene;camera:Camera;viewport:{width:number;height:number};onMove:(c:Camera)=>void}){
 const [open,setOpen]=useState(true);
 const shapes=useMemo(()=>{const owners=new Map(state.provinces.map(p=>[p.id,p.ownerId]));return renderFeaturesFor(scene,owners,true).map(f=>{let path=cachedPaths.get(f);if(!path){path=featurePath(geometryForLod(f,'low'));cachedPaths.set(f,path);}return {id:f.id,path,color:state.countries[owners.get(f.provinceId??'')??f.countryId??'']?.color??'#34484f'};});},[scene,state.provinces,state.countries]);
 const w=viewport.width/camera.zoom,h=viewport.height/(camera.zoom*TILT);
 return <View style={{position:'absolute',right:8,bottom:8,backgroundColor:'#15242cf5',borderWidth:1,borderColor:colors.border,borderRadius:5}}><Pressable accessibilityRole="button" accessibilityLabel="Скрыть или показать мини-карту" style={{minHeight:32,padding:6}} onPress={()=>setOpen(v=>!v)}><Text style={{color:colors.gold,fontSize:10}}>МИНИ-КАРТА {open?'−':'+'}</Text></Pressable>{open&&<Pressable accessibilityRole="button" accessibilityLabel="Быстрое перемещение по мини-карте" onPress={e=>onMove({x:e.nativeEvent.locationX/180*1440,y:e.nativeEvent.locationY/90*720,zoom:camera.zoom})}><Svg width={180} height={90} viewBox="0 0 1440 720" pointerEvents="none"><Rect width={1440} height={720} fill="#162b37"/>{shapes.map(f=><Path key={f.id} d={f.path} fill={f.color}/>)}<Rect x={camera.x-w/2} y={camera.y-h/2} width={w} height={h} fill="none" stroke="#fff0bc" strokeWidth={8}/></Svg></Pressable>}</View>;
});
