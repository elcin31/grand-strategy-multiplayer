import {SvgXml} from 'react-native-svg';
import {getWorldFlag} from '../world/catalog';
import {colors} from '../ui/tokens';
import {Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import type {GameCommand,GameState} from '../types/game';
const compact=(n:number)=>Math.abs(n)>=1e6?(n/1e6).toFixed(1)+'M':Math.abs(n)>=1e3?(n/1e3).toFixed(1)+'K':n.toFixed(0);
export function LandscapeHUD({state,playerId,onCommand,onNotifications}:{state:GameState;playerId:string;onCommand:(c:GameCommand)=>void;onNotifications?:()=>void}){
 const me=state.players.find(p=>p.id===playerId),c=state.countries[me?.countryId??''];if(!c)return null;
 const metrics=[['Казна','$'+(Math.abs(c.treasury)>=1000?(c.treasury/1000).toFixed(1)+'B':c.treasury.toFixed(1)+'M')],['Баланс/мес.',(c.economy?.monthlyBalance??0).toFixed(1)+'M'],['Население',compact(c.population)],['Рекруты',compact(c.manpower)],['Стабильность',c.stability.toFixed(0)+'%'],['Полит. власть',(c.politicalPower??0).toFixed(0)],['Наука',c.research?`${Math.min(100,100*c.research.progress/c.research.required).toFixed(0)}%`:'—']];
 const unread=(state.notifications??[]).filter(n=>n.countryId===c.id&&n.id>(c.notificationReadThrough??0)).length;
 return <View style={styles.wrap}>
  <View style={[styles.country,{borderLeftColor:c.color}]}><SvgXml xml={getWorldFlag(c.id)??'<svg xmlns="http://www.w3.org/2000/svg"/>'} width={35} height={23}/><Text numberOfLines={1} style={styles.name}>{c.name}</Text></View>
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>{metrics.map(([label,value])=><View key={label} style={styles.metric}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>)}</ScrollView>
  <Pressable accessibilityLabel={`Уведомления: ${unread}`} accessibilityRole="button" style={styles.control} onPress={onNotifications}><Text style={styles.value}>♧ {unread}</Text></Pressable>
  <View style={styles.clock}><Text style={styles.value}>{`${(state.day??1).toString().padStart(2,'0')}.${String(state.month).padStart(2,'0')}.${state.year}`}</Text><View style={styles.row}>
   <Pressable accessibilityRole="button" accessibilityLabel={state.speed?'Пауза':'Продолжить'} style={styles.control} onPress={()=>onCommand(me?.isHost?{type:'SET_SPEED',playerId,speed:state.speed?0:1}:{type:'REQUEST_PAUSE',playerId})}><Text style={styles.value}>{state.speed?'Ⅱ':'▶'}</Text></Pressable>
   <Pressable accessibilityRole="button" accessibilityLabel="Скорость кампании" disabled={!me?.isHost} style={styles.control} onPress={()=>onCommand({type:'SET_SPEED',playerId,speed:(state.speed>=5?1:state.speed+1) as 1|2|3|4|5})}><Text style={styles.value}>{state.speed||1}× ▸</Text></Pressable>
  </View></View>
 </View>;
}
const styles=StyleSheet.create({wrap:{flex:1,minWidth:0,flexDirection:'row',alignItems:'center',gap:8},row:{gap:8,flexDirection:'row',alignItems:'center'},country:{width:112,borderLeftWidth:3,paddingLeft:7},flag:{fontSize:22,color:colors.gold},name:{fontSize:12,fontWeight:'800',color:colors.parchment},metric:{minWidth:66},label:{fontSize:9,color:colors.muted},value:{fontVariant:['tabular-nums'],fontSize:12,fontWeight:'800',color:colors.parchment},control:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center',backgroundColor:colors.raised,borderRadius:5},clock:{alignItems:'center'}});
