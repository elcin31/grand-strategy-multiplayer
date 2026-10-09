import {LoadingScreen} from './HistoricalArt';
import {traceStartup} from '../performance/startupTrace';
import {memo,useEffect,useState,type ComponentProps} from 'react';
import type {WorldMap as MapComponent} from './WorldMap';
type Map=typeof MapComponent;
/** Paint navigation/loading before loading and preparing optional map geometry. */
export const WorldMap=memo(function WorldMap(props:ComponentProps<Map>){
 const [Component,setComponent]=useState<Map|null>(null),[error,setError]=useState('');
 useEffect(()=>{let active=true,second=0;const first=requestAnimationFrame(()=>{second=requestAnimationFrame(()=>{void import('../map/worldScene').then(async scene=>{traceStartup("map preparation starts");await scene.prepareWorldScene(props.state);traceStartup("map geometry ready");return import('./WorldMap');}).then(module=>{if(active)setComponent(()=>module.WorldMap);}).catch(e=>{if(active)setError(String(e));});});});return()=>{active=false;cancelAnimationFrame(first);cancelAnimationFrame(second);};},[]);
 if(Component)return <Component {...props}/>;
 return <LoadingScreen message={error?'Не удалось загрузить карту: '+error:'Подготовка карты мира…'}/>;
});
