import {useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import type {GameState} from '../types/game';
import {opponentSide,warMetrics} from '../../supabase/functions/_shared/warSystem';
import {colors} from '../ui/tokens';
export function WarProgressIndicator({state,countryId,onOpen}:{state:GameState;countryId:string;onOpen:(id:string)=>void}){
 const [index,setIndex]=useState(0),wars=state.wars?.filter(w=>w.attackers.includes(countryId)||w.defenders.includes(countryId))??[];
 const war=wars[index%Math.max(1,wars.length)];if(!war)return null;
 const metrics=warMetrics(state,war,countryId),enemy=state.countries[opponentSide(war,countryId)[0]!];
 return <View style={{position:'absolute',right:4,bottom:124,width:218,backgroundColor:'#101d2bf5',borderWidth:1,borderColor:colors.gold,borderRadius:4,flexDirection:'row'}}><Pressable accessibilityRole="button" accessibilityLabel="Открыть мирные переговоры" style={{flex:1,minHeight:56,padding:7,justifyContent:'center'}} onPress={()=>onOpen(war.id)}><Text numberOfLines={1} style={{color:colors.gold,fontSize:10,fontWeight:'700'}}>ВОЙНА · {enemy?.shortName}</Text><Text style={{color:colors.parchment,fontSize:11}}>Оккупация {metrics.occupationPercent.toFixed(0)}% · счёт {metrics.score>=0?'+':''}{metrics.score.toFixed(0)}</Text><Text style={{color:colors.muted,fontSize:9}}>{metrics.score>=99?'Капитуляция возможна':metrics.score>20?'Преимущество вашей стороны':metrics.score< -20?'Требуется перелом на фронте':'Сражения продолжаются'} · Мир →</Text></Pressable>{wars.length>1&&<Pressable accessibilityRole="button" accessibilityLabel="Следующая война" style={{width:44,justifyContent:'center',alignItems:'center'}} onPress={()=>setIndex(v=>v+1)}><Text style={{color:colors.gold}}>›</Text></Pressable>}</View>;
}
