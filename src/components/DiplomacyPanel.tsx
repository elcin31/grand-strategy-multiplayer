import {colors} from '../ui/tokens';
import {useEffect,useState} from 'react';
import {Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import {HistoricalArt} from './HistoricalArt';
import {TREATIES,pairKey,warBetween} from '../../supabase/functions/_shared/diplomacySystem';
import {diplomaticTermsLabel,diplomacyResponseAvailability} from '../../supabase/functions/_shared/diplomacy2System';
import {DiplomacyActions,DiplomacyButton} from './DiplomacyActions';
import {styles,type StrategyProps} from './StrategyPanel';
export function DiplomacyPanel({state,playerId,onCommand,initialOpen,initialTargetId}:StrategyProps&{initialTargetId?:string}) {
  const [open,setOpen]=useState(initialOpen??false),[query,setQuery]=useState(''),[targetId,setTargetId]=useState(initialTargetId??'');
  useEffect(()=>{if(initialTargetId){setTargetId(initialTargetId);setOpen(true);}},[initialTargetId]);
  const id=state.players.find(p=>p.id===playerId)?.countryId;
  if(!state.dataset||!id)return null;
  const target=state.countries[targetId],link=target?state.diplomacy?.[pairKey(id,targetId)]:undefined,war=target?warBetween(state,id,targetId):undefined;
  const enabled=['running','paused'].includes(state.phase);
  const offers=(state.diplomaticOffers??[]).filter(o=>o.from===id||o.to===id||o.terms.kind==='Summit'&&o.terms.participants.includes(id));
  return <View style={styles.wrap}>
    <Pressable accessibilityRole="button" accessibilityState={{expanded:open}} style={styles.button} onPress={()=>setOpen(previous=>!previous)}><Text style={styles.title}>Дипломатия {open?'▴':'▾'}</Text></Pressable>
    {open&&<View style={styles.card}>
      <HistoricalArt name="diplomacy"/>
      <TextInput accessibilityLabel="Поиск страны для дипломатии" placeholder="Название страны" placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} style={[styles.button,styles.title]}/>
      <ScrollView horizontal contentContainerStyle={styles.row}>{Object.values(state.countries).filter(c=>c.id!==id&&c.provinceIds?.length&&`${c.name} ${c.id} ${c.shortName}`.toLowerCase().includes(query.toLowerCase())).slice(0,20).map(c=><Pressable accessibilityRole="button" accessibilityState={{selected:targetId===c.id}} key={c.id} style={styles.option} onPress={()=>setTargetId(c.id)}><Text style={styles.title}>{c.name}{targetId===c.id?' ✓':''}</Text></Pressable>)}</ScrollView>
      {offers.length>0&&<Text style={styles.title}>Дипломатические предложения</Text>}
      {offers.map(o=>{const canRespond=o.from!==id&&!o.acceptedBy.includes(id),reason=diplomacyResponseAvailability(state,id,o),provinceId=o.terms.kind==='ProvinceTransfer'?o.terms.provinceId:null;return <View key={o.id} style={styles.card}>
        <Text style={styles.title}>{state.countries[o.from]!.name}: {diplomaticTermsLabel(o.terms)}</Text>
        <Text style={styles.text}>Ответ через {Math.max(0,o.expiresTick-state.tick)} мес. · согласны: {o.acceptedBy.map(c=>state.countries[c]!.shortName).join(', ')}</Text>
        {provinceId&&<Text style={styles.text}>{state.provinces.find(p=>p.id===provinceId)?.name}</Text>}
        {canRespond&&<><Text style={styles.text}>{reason??'Все условия будут повторно проверены перед исполнением.'}</Text><DiplomacyButton label="Принять дипломатическое предложение" disabled={!enabled||!!reason} onPress={()=>onCommand({type:'RESPOND_DIPLOMACY',playerId,offerId:o.id,accept:true})}/><DiplomacyButton label="Отклонить дипломатическое предложение" disabled={!enabled||o.expiresTick<=state.tick} onPress={()=>onCommand({type:'RESPOND_DIPLOMACY',playerId,offerId:o.id,accept:false})}/></>}
      </View>;})}
      {target&&targetId!==id?<>
        <Text style={styles.title}>{target.name} · отношения {link?.relation??0} · доверие {(link?.trust??50).toFixed(0)} · {war?'ВОЙНА':'МИР'}</Text>
        <Text style={styles.text}>Договоры: {link?.treaties.map(t=>TREATIES[t]).join(', ')||'нет'} · перемирие {Math.max(0,(link?.truceUntilTick??0)-state.tick)} мес.</Text>
        <Text style={styles.text}>Гарантии: {link?.guarantors.map(c=>`${state.countries[c]!.name} (${Math.max(0,(link.guaranteeUntil?.[c]??state.tick)-state.tick)} мес.)`).join(', ')||'нет'} · соперники: {link?.rivals.map(c=>state.countries[c]!.name).join(', ')||'нет'}</Text>
        {link?.reasons?.filter(r=>r.value!==0).map(r=><Text style={styles.text} key={r.key}>{r.label}: {r.value>0?'+':''}{r.value}</Text>)}
        <DiplomacyActions key={targetId} state={state} playerId={playerId} onCommand={onCommand} from={id} to={targetId}/>
      </>:<Text style={styles.text}>Выберите действующее государство для дипломатии.</Text>}
      <Text style={styles.title}>Дипломатическая история</Text>
      {(state.diplomaticHistory??[]).filter(e=>e.countries.includes(id)&&(!target||e.countries.includes(targetId))).slice(0,12).map(e=><Text style={styles.text} key={e.id}>Ход {e.tick}: {e.message}</Text>)}
    </View>}
  </View>;
}
