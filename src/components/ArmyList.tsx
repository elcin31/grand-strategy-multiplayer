import {Text,View} from 'react-native';
import {AudioPressable as Pressable} from './AudioPressable';
import type {GameState,GameCommand} from '../types/game';
import {armyETA} from '../../supabase/functions/_shared/military3System';
import {formationDays} from '../../supabase/functions/_shared/armyFormationSystem';
import {compositionTotal} from '../../supabase/functions/_shared/armyComposition';
import {styles} from './strategyStyles';
export function ArmyList({state,owner,playerId,onSelect,onCreate,onCommand}:{state:GameState;owner:string;playerId:string;onSelect?:(id:string,province:string)=>void;onCreate?:()=>void;onCommand:(c:GameCommand)=>void}){
 const armies=state.armies.filter(a=>a.ownerId===owner),provinces=new Map(state.provinces.map(p=>[p.id,p.name]));
 return <View style={styles.card}><Text style={styles.title}>Все армии · {armies.length}</Text><Pressable accessibilityRole="button" style={styles.button} onPress={onCreate}><Text style={styles.title}>Создать новую армию</Text></Pressable>
 {armies.map((a,n)=><Pressable key={a.id} accessibilityRole="button" accessibilityLabel={`Выбрать армию ${n+1}`} style={styles.card} onPress={()=>onSelect?.(a.id,a.provinceId)}><Text style={styles.title}>{a.name??`${n+1}-я армия`} · {a.troops.toLocaleString('ru-RU')}</Text><Text style={styles.text}>{provinces.get(a.provinceId)} · {a.commanderId?state.commanders?.[a.commanderId]?.name:'Без генерала'}</Text><Text style={styles.text}>{a.formationId?'Формируется':a.order?`${a.order.type==='ATTACK'?'Наступление':'Марш'} → ${provinces.get(a.order.targetProvinceId)} · ${armyETA(state,a)} дн.`:a.militaryPlan?.reason??'Удерживает позицию'} · снабжение {(a.supply??100).toFixed(0)}%</Text></Pressable>)}
 {(state.armyFormations??[]).filter(q=>q.ownerId===owner).map(q=><View key={q.id} style={styles.card}><Text style={styles.title}>{q.name} · {compositionTotal(q.formed).toLocaleString()} / {compositionTotal(q.composition).toLocaleString()}</Text><Text style={styles.text}>{provinces.get(q.provinceId)} · {q.status==='Blocked'?'Формирование приостановлено: провинция потеряна':`Идёт подготовка · около ${formationDays(state,owner,q.provinceId,compositionTotal(q.composition)-compositionTotal(q.formed),q.id)} дней`}</Text><Pressable accessibilityRole="button" style={styles.button} onPress={()=>onCommand({type:'CANCEL_ARMY_FORMATION',playerId,formationId:q.id})}><Text style={styles.text}>Прекратить и вернуть неиспользованный резерв</Text></Pressable></View>)}
 </View>;
}
