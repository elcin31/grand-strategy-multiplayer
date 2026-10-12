import {useEffect,useRef,useState} from 'react';
import {SvgXml} from 'react-native-svg';
import {getWorldFlag} from '../world/catalog';
import {colors} from '../ui/tokens';
import {Pressable,Text,View,useWindowDimensions} from 'react-native';
import type {GameCommand,GameState,GameSpeed} from '../types/game';
const compact=(n:number)=>Math.abs(n)>=1e6?(n/1e6).toFixed(1)+'M':Math.abs(n)>=1e3?(n/1e3).toFixed(1)+'K':n.toFixed(0);
export function LandscapeHUD({state,playerId,onCommand,onNotifications}:{state:GameState;playerId:string;onCommand:(c:GameCommand)=>void;onNotifications?:()=>void}){
 const {width}=useWindowDimensions(),[details,setDetails]=useState(false),[speeds,setSpeeds]=useState(false),resume=useRef<GameSpeed>(1);
 useEffect(()=>{if(state.speed)resume.current=state.speed;},[state.speed]);
 const me=state.players.find(p=>p.id===playerId),c=state.countries[me?.countryId??''];if(!c)return null;
 const balance=c.economy?.monthlyBalance??0;
 const metrics=[['Казна','$'+(Math.abs(c.treasury)>=1000?(c.treasury/1000).toFixed(1)+'B':c.treasury.toFixed(1)+'M')],['Баланс/мес.',(balance>=0?'+':'')+balance.toFixed(1)+'M'],['Население',compact(c.population)],['Рекруты',compact(c.manpower)],['Стабильность',c.stability.toFixed(0)+'%'],['Полит. власть',(c.politicalPower??0).toFixed(0)]];
 const unread=(state.notifications??[]).filter(n=>n.countryId===c.id&&n.id>(c.notificationReadThrough??0)).length;
 const control={minWidth:44,height:44,alignItems:'center' as const,justifyContent:'center' as const},text={fontVariant:['tabular-nums'] as 'tabular-nums'[],fontSize:11,fontWeight:'700' as const,color:colors.parchment};
 const speed=(value:GameSpeed)=>{onCommand({type:'SET_SPEED',playerId,speed:value});setSpeeds(false);};
 return <View style={{flex:1,minWidth:0,height:44,flexDirection:'row',alignItems:'center',gap:4,zIndex:40}}>
  <Pressable accessibilityLabel="Все показатели страны" accessibilityRole="button" style={{...control,flexDirection:'row',maxWidth:110,gap:5}} onPress={()=>setDetails(v=>!v)}><SvgXml xml={getWorldFlag(c.id)??'<svg xmlns="http://www.w3.org/2000/svg"/>'} width={27} height={18}/><Text numberOfLines={1} style={[text,{flexShrink:1}]}>{c.shortName}</Text><Text style={text}>▾</Text></Pressable>
  <View style={{flex:1,flexDirection:'row',gap:5,justifyContent:'space-around'}}>{metrics.slice(0,width>=1000?6:width>=780?4:2).map(([label,value])=><View key={label}><Text style={{fontSize:8,color:colors.muted}}>{label}</Text><Text style={text}>{value}</Text></View>)}</View>
  <Pressable accessibilityLabel={`Уведомления: ${unread}`} accessibilityRole="button" style={control} onPress={onNotifications}><Text style={text}>♧ {unread}</Text></Pressable>
  <Text style={[text,{fontSize:10}]}>{`${String(state.day??1).padStart(2,'0')}.${String(state.month).padStart(2,'0')}.${state.year}`}</Text>
  <Pressable accessibilityRole="button" accessibilityLabel={state.speed?'Пауза':'Продолжить'} style={control} onPress={()=>me?.isHost?speed(state.speed?0:resume.current):onCommand({type:'REQUEST_PAUSE',playerId})}><Text style={text}>{state.speed?'Ⅱ':'▶'}</Text></Pressable>
  <Pressable accessibilityRole="button" accessibilityLabel="Выбрать скорость кампании" style={control} disabled={!me?.isHost} onPress={()=>setSpeeds(v=>!v)}><Text style={text}>{state.speed||resume.current}× ▾</Text></Pressable>
  {details&&<View style={{position:'absolute',left:0,top:44,backgroundColor:colors.surface,padding:10,borderWidth:1,borderColor:colors.gold,flexDirection:'row',flexWrap:'wrap',gap:14,maxWidth:440}}><Text style={[text,{width:'100%'}]}>{c.name}</Text>{metrics.map(([label,value])=><View key={label}><Text style={{color:colors.muted,fontSize:10}}>{label}</Text><Text style={text}>{value}</Text></View>)}</View>}
  {speeds&&<View style={{position:'absolute',right:0,top:44,flexDirection:'row',backgroundColor:colors.surface,borderWidth:1,borderColor:colors.gold}}>{([1,2,3,4,5] as const).map(v=><Pressable key={v} accessibilityLabel={`Скорость ${v}×`} style={control} onPress={()=>speed(v)}><Text style={text}>{v}×</Text></Pressable>)}</View>}
 </View>;
}
