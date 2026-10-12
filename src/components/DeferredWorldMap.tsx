import {AudioPressable as Pressable} from './AudioPressable';
import {LoadingScreen} from './HistoricalArt';
import {traceStartup} from '../performance/startupTrace';
import {memo,useEffect,useState,type ComponentProps} from 'react';
import {Text, View} from 'react-native';
import type {WorldMap as MapComponent} from './WorldMap';
import {colors} from '../ui/tokens';
type Map=typeof MapComponent;
/** Geometry loading is recoverable without recreating the room or campaign. */
export const WorldMap=memo(function WorldMap(props:ComponentProps<Map>){
 const [Component,setComponent]=useState<Map|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let active=true;setError('');const timeout=setTimeout(()=>{if(active)setError('Подготовка карты заняла больше 30 секунд. Повторите загрузку.');},30000);
  const start=setTimeout(()=>{void import('../map/worldScene').then(async scene=>{traceStartup('map preparation starts');await scene.prepareWorldScene(props.state);traceStartup('map geometry ready');return import('./WorldMap');}).then(module=>{if(active){clearTimeout(timeout);setError('');setComponent(()=>module.WorldMap);}}).catch(e=>{if(active){clearTimeout(timeout);setError(e instanceof Error?e.message:String(e));}});},0);
  return()=>{active=false;clearTimeout(timeout);clearTimeout(start);};
 },[attempt]);
 if(Component)return <Component {...props}/>;
 if(error)return <View style={{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:colors.graphite,padding:20,gap:10}}><Text accessibilityRole="alert" style={{color:colors.parchment}}>{error}</Text><Pressable accessibilityRole="button" style={{minHeight:48,padding:14,backgroundColor:colors.raised}} onPress={()=>setAttempt(v=>v+1)}><Text style={{color:colors.gold}}>Повторить загрузку карты</Text></Pressable></View>;
 return <LoadingScreen message="Подготовка карты мира…"/>;
});
