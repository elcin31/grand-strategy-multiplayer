import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { TREATIES, pairKey, treatyAcceptance, warBetween, type TreatyType } from '../../supabase/functions/_shared/diplomacySystem';
import { styles, type StrategyProps } from './StrategyPanel';
export function DiplomacyPanel({state,playerId,onCommand}:StrategyProps) {
  const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[targetId,setTargetId]=useState('');
  const id=state.players.find(p=>p.id===playerId)?.countryId;
  if(!state.dataset||!id)return null;
  const target=state.countries[targetId],link=target?state.diplomacy?.[pairKey(id,targetId)]:undefined;
  const war=target?warBetween(state,id,targetId):undefined;
  const enabled=['running','paused'].includes(state.phase);
  return <View style={styles.wrap}>
    <Pressable accessibilityRole="button" style={styles.button} onPress={()=>setOpen(!open)}><Text style={styles.title}>Дипломатия {open?'▴':'▾'}</Text></Pressable>
    {open&&<View style={styles.card}>
      <TextInput accessibilityLabel="Поиск страны для дипломатии" placeholder="Название страны" placeholderTextColor="#8290A8" value={query} onChangeText={setQuery} style={[styles.button,styles.title]} />
      <ScrollView horizontal contentContainerStyle={styles.row}>{Object.values(state.countries).filter(c=>c.id!==id&&c.name.toLowerCase().includes(query.toLowerCase())).slice(0,20).map(c=><Pressable accessibilityRole="button" key={c.id} style={styles.option} onPress={()=>setTargetId(c.id)}><Text style={styles.title}>{c.name}{targetId===c.id?' ✓':''}</Text></Pressable>)}</ScrollView>
      {target&&<>
        <Text style={styles.title}>{target.name} · отношения {link?.relation??0}</Text>
        <Text style={styles.text}>Договоры: {link?.treaties.map(t=>TREATIES[t]).join(', ')||'нет'} · перемирие {Math.max(0,(link?.truceUntilTick??0)-state.tick)} мес.</Text>
        <Text style={styles.text}>Гарантии: {link?.guarantors.map(c=>state.countries[c]!.name).join(', ')||'нет'} · соперники: {link?.rivals.map(c=>state.countries[c]!.name).join(', ')||'нет'}</Text>
        <Text style={styles.text}>Ваша агрессивная экспансия: {state.countries[id]!.aggressiveExpansion?.toFixed(1)}. Оценка договора: {treatyAcceptance(state,id,targetId).toFixed(0)} / 20 для NPC.</Text>
        {link?.proposal?.from===targetId&&<View style={styles.row}><Text style={styles.text}>Предложен {TREATIES[link.proposal.type]}</Text>{[true,false].map(accept=><Pressable accessibilityRole="button" key={String(accept)} style={styles.button} onPress={()=>onCommand({type:'RESPOND_TREATY',playerId,targetId,accept})}><Text style={styles.title}>{accept?'Принять':'Отклонить'}</Text></Pressable>)}</View>}
        {link?.proposal?.from===id&&<Text style={styles.text}>Ожидается ответ игрока · {link.proposal.expiresTick-state.tick} мес.</Text>}
        <ScrollView horizontal contentContainerStyle={styles.row}>{(['Improve','Rival','Guarantee','Cancel'] as const).map((action,i)=><Pressable accessibilityRole="button" key={action} disabled={!enabled} style={styles.option} onPress={()=>onCommand({type:'DIPLOMATIC_ACTION',playerId,targetId,action})}><Text style={styles.title}>{['Улучшить · 10 PP','Объявить соперником','Гарантировать · 20 PP','Отменить договоры'][i]}</Text></Pressable>)}</ScrollView>
        <ScrollView horizontal contentContainerStyle={styles.row}>{(Object.keys(TREATIES) as TreatyType[]).map(treaty=><Pressable accessibilityRole="button" key={treaty} disabled={!enabled||!!war||!!link?.proposal||link?.treaties.includes(treaty)} style={styles.option} onPress={()=>onCommand({type:'OFFER_TREATY',playerId,targetId,treaty})}><Text style={styles.title}>Предложить: {TREATIES[treaty]}</Text></Pressable>)}</ScrollView>
        <Pressable accessibilityRole="button" disabled={!enabled||!!war} style={styles.button} onPress={()=>onCommand({type:'DECLARE_WAR',playerId,targetId})}><Text style={styles.title}>{war?'Война идёт':'Объявить войну · 25 PP'}</Text></Pressable>
        <Text style={styles.text}>Союзы, оборонительные пакты и гарантии призывают защитников. После отмены договора действует 6 месяцев перемирия. Одна война на страну одновременно.</Text>
      </>}
    </View>}
  </View>;
}
