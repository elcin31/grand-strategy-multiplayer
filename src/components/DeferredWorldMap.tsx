import {memo,useEffect,useState,type ComponentProps} from 'react';
import {ActivityIndicator,Text,View} from 'react-native';
import type {WorldMap as MapComponent} from './WorldMap';
type Map=typeof MapComponent;
/** Paint navigation/loading before loading and preparing optional map geometry. */
export const WorldMap=memo(function WorldMap(props:ComponentProps<Map>){
 const [Component,setComponent]=useState<Map|null>(null),[error,setError]=useState('');
 useEffect(()=>{let active=true,second=0;const first=requestAnimationFrame(()=>{second=requestAnimationFrame(()=>{void import('./WorldMap').then(module=>{if(active)setComponent(()=>module.WorldMap);}).catch(e=>{if(active)setError(String(e));});});});return()=>{active=false;cancelAnimationFrame(first);cancelAnimationFrame(second);};},[]);
 if(Component)return <Component {...props}/>;
 return <View style={{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:'#101f2b'}}><ActivityIndicator color="#dbc58a"/><Text style={{color:'#dddcca',padding:12}}>{error?'Не удалось загрузить карту: '+error:'Подготовка карты мира…'}</Text></View>;
});
