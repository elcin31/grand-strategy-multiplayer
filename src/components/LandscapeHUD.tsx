import {colors,tokens} from '../ui/tokens';
import {Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import type {GameCommand,GameState} from '../types/game';
const compact=(n:number)=>Math.abs(n)>=1e6?(n/1e6).toFixed(1)+'M':Math.abs(n)>=1e3?(n/1e3).toFixed(1)+'K':n.toFixed(0);
export function LandscapeHUD({state,playerId,onCommand}:{state:GameState;playerId:string;onCommand:(c:GameCommand)=>void}){
 const me=state.players.find(p=>p.id===playerId),c=state.countries[me?.countryId??''];if(!c)return null;
 const metrics=[['Казна','$'+(Math.abs(c.treasury)>=1000?(c.treasury/1000).toFixed(1)+'B':c.treasury.toFixed(1)+'M')],['Баланс/мес.',(c.economy?.monthlyBalance??0).toFixed(1)+'M'],['Резерв',compact(c.manpower)],['Население',compact(c.population)],['Стабильность',c.stability.toFixed(0)+'%'],['Исследование',c.research?`${c.research.progress.toFixed(0)}/${c.research.required}`:'—'],['Дата',`${state.month}/${state.year}`]];
 return <View style={styles.wrap}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>{metrics.map(([label,value])=><View key={label} style={styles.metric}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>)}</ScrollView><Pressable accessibilityLabel="Скорость кампании" disabled={!me?.isHost} style={styles.speed} onPress={()=>onCommand({type:'SET_SPEED',playerId,speed:state.speed===4?0:(state.speed+1) as 1|2|3|4})}><Text style={styles.value}>{state.speed?`${state.speed}×`:'Ⅱ'}</Text></Pressable></View>;
}
const styles=StyleSheet.create({wrap:{flex:1,minWidth:0,flexDirection:'row',alignItems:'center'},row:{gap:12,alignItems:'center'},metric:{minWidth:65},label:{fontSize:10,color:colors.muted},value:{fontVariant:['tabular-nums'],fontSize:13,fontWeight:'800',color:colors.parchment},speed:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center',backgroundColor:colors.burgundy,borderRadius:tokens.radius.control,marginLeft:8}});
