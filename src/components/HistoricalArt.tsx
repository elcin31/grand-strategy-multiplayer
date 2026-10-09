import {memo,useEffect,useState} from 'react';
import {ActivityIndicator,Image,StyleSheet,Text,View} from 'react-native';
import {loadPreferences} from '../performance/preferences';
import type {GraphicsPreset} from '../map/settings';
import {colors} from '../ui/tokens';
export type ArtName='main-menu'|'campaign'|'military'|'diplomacy'|'economy'|'loading'|'loading-port';
const art={
 'loading-port':{low:require('../../assets/art/loading-port-low.webp'),high:require('../../assets/art/loading-port-high.webp')},
 'main-menu':{low:require('../../assets/art/main-menu-low.webp'),high:require('../../assets/art/main-menu-high.webp')},
 campaign:{low:require('../../assets/art/campaign-low.webp'),high:require('../../assets/art/campaign-high.webp')},
 military:{low:require('../../assets/art/military-panel.webp')},
 diplomacy:{low:require('../../assets/art/diplomacy-panel.webp')},
 economy:{low:require('../../assets/art/economy-panel.webp')},
 loading:{low:require('../../assets/art/loading-low.webp'),high:require('../../assets/art/loading-high.webp')},
};
export const HistoricalArt=memo(function HistoricalArt({name,full=false,preset='Balanced'}:{name:ArtName;full?:boolean;preset?:GraphicsPreset}){
 const entry=art[name],source=(preset==='High'||preset==='Ultra')&&'high' in entry?entry.high:entry.low;
 return <Image key={String(source)} accessibilityLabel={`Иллюстрация Dominion: ${name}`} source={source} resizeMode="cover" fadeDuration={0} style={full?[StyleSheet.absoluteFill,{width:'100%',height:'100%'}]:{width:'100%',height:84}}/>;
});
export function LoadingScreen({message}:{message:string}){const [name]=useState<ArtName>(()=>Date.now()%2?'loading':'loading-port');return <View style={{flex:1,backgroundColor:colors.graphite,justifyContent:'center',alignItems:'center'}}><HistoricalArt name={name} full/><View style={[StyleSheet.absoluteFill,{backgroundColor:'#0B1118CC'}]}/><Text style={{fontFamily:'serif',fontSize:30,color:colors.parchment,letterSpacing:5}}>DOMINION</Text><ActivityIndicator size="large" color={colors.gold} style={{margin:20}}/><Text accessibilityRole="alert" style={{color:colors.parchment,fontSize:16}}>{message}</Text><Text style={{color:colors.muted,marginTop:10}}>Каждое решение оставляет след в истории.</Text></View>;}
export function useArtPreset(){const [preset,setPreset]=useState<GraphicsPreset>('Balanced');useEffect(()=>{let active=true;void loadPreferences().then(p=>{if(active&&p)setPreset(p.preset);});return()=>{active=false;};},[]);return preset;}
