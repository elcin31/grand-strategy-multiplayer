import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import type { War } from '../../supabase/functions/_shared/diplomacySystem';
import { isWarLeader, opponentSide, peaceCost, scoreFor, warSide, type PeaceKind, type PeaceTerms } from '../../supabase/functions/_shared/warSystem';
import { styles, type StrategyProps } from './StrategyPanel';
const LABELS:Record<PeaceKind,string>={WhitePeace:'Белый мир',Territory:'Передача территории',ReturnTerritory:'Возврат территории',Money:'Репарации',Vassalization:'Вассализация'};
function WarCard({state,playerId,onCommand,war,id}:StrategyProps&{war:War;id:string}) {
  const [kind,setKind]=useState<PeaceKind>('WhitePeace'),[amount,setAmount]=useState('100'),[provinces,setProvinces]=useState<string[]>([]);
  const side=warSide(war,id),enemies=opponentSide(war,id),leader=isWarLeader(war,id);
  const terms:PeaceTerms={kind,amount:kind==='Money'?Number(amount):0,provinceIds:kind==='Territory'||kind==='ReturnTerritory'?provinces:[]};
  let cost:string,error='';try{cost=peaceCost(state,war,id,terms).toFixed(1);}catch(e){error=e instanceof Error?e.message:'Условия недоступны';cost='—';}
  return <View style={styles.card}>
    <Text style={styles.title}>{war.attackers.map(x=>state.countries[x]!.name).join(', ')} ↔ {war.defenders.map(x=>state.countries[x]!.name).join(', ')}</Text>
    <Text style={styles.text}>Ваш военный счёт: {scoreFor(war,id).toFixed(1)} · истощение {state.countries[id]!.warExhaustion?.toFixed(1)} · оккупировано {war.occupiedProvinceIds?.length??0}</Text>
    <Text style={styles.text}>Потери: {Object.entries(war.casualties??{}).map(([c,n])=>`${state.countries[c]!.shortName} ${n}`).join(' · ')||'нет'}</Text>
    {war.peaceOffer&&<><Text style={styles.text}>Мир от {state.countries[war.peaceOffer.from]!.name}: {LABELS[war.peaceOffer.terms.kind]} · провинций {war.peaceOffer.terms.provinceIds.length} · ${war.peaceOffer.terms.amount}M</Text>
      {leader&&enemies.includes(war.peaceOffer.from)&&[true,false].map(accept=><Pressable accessibilityRole="button" key={String(accept)} style={styles.button} onPress={()=>onCommand({type:'RESPOND_PEACE',playerId,warId:war.id,accept})}><Text style={styles.title}>{accept?'Принять мир':'Отклонить мир'}</Text></Pressable>)}
    </>}
    {leader&&!war.peaceOffer&&<>
      <ScrollView horizontal contentContainerStyle={styles.row}>{(Object.keys(LABELS) as PeaceKind[]).map(k=><Pressable accessibilityRole="button" key={k} style={styles.option} onPress={()=>{setKind(k);setProvinces([]);}}><Text style={styles.title}>{LABELS[k]}{kind===k?' ✓':''}</Text></Pressable>)}</ScrollView>
      {kind==='Money'&&<TextInput accessibilityLabel="Репарации в миллионах" keyboardType="numeric" value={amount} onChangeText={setAmount} style={[styles.button,styles.text]} />}
      {(kind==='Territory'||kind==='ReturnTerritory')&&<ScrollView horizontal contentContainerStyle={styles.row}>{state.provinces.filter(p=>enemies.includes(p.ownerId)&&side.includes(p.controllerId??p.ownerId)&&(kind!=='ReturnTerritory'||side.includes(p.originalOwnerId!))).map(p=><Pressable accessibilityRole="button" key={p.id} style={styles.option} onPress={()=>setProvinces(current=>current.includes(p.id)?current.filter(x=>x!==p.id):current.length<50?[...current,p.id]:current)}><Text style={styles.title}>{p.name}{provinces.includes(p.id)?' ✓':''}</Text></Pressable>)}</ScrollView>}
      <Text style={styles.text}>Стоимость условий: {cost}. {error||'Другой игрок решает сам; NPC оценивает счёт и длительность войны.'}</Text>
      <Pressable accessibilityRole="button" disabled={!!error} style={[styles.button,!!error&&styles.disabled]} onPress={()=>onCommand({type:'PROPOSE_PEACE',playerId,warId:war.id,terms})}><Text style={styles.title}>Предложить мир</Text></Pressable>
    </>}
  </View>;
}
export function WarPanel(props:StrategyProps){const [open,setOpen]=useState(props.initialOpen??false),id=props.state.players.find(p=>p.id===props.playerId)?.countryId;if(!props.state.dataset||!id)return null;const wars=props.state.wars?.filter(w=>w.attackers.includes(id)||w.defenders.includes(id))??[];return <View style={styles.wrap}>
  <Pressable accessibilityRole="button" style={styles.button} onPress={()=>setOpen(!open)}><Text style={styles.title}>Войны и мир · {wars.length} {open?'▴':'▾'}</Text></Pressable>
  {open&&<>{wars.length===0&&<Text style={styles.text}>Активных войн нет</Text>}{wars.map(w=><WarCard key={w.id} {...props} war={w} id={id}/>)}<Text style={styles.text}>После мира — 24 месяца перемирия. Вассал платит 10% положительного месячного баланса и участвует в войнах сюзерена.</Text>{props.state.warHistory?.filter(w=>w.attackers.includes(id)||w.defenders.includes(id)).slice(0,5).map(w=><Text style={styles.text} key={w.id}>Мир на ходу {w.endedTick}: {LABELS[w.kind]}</Text>)}</>}
</View>;}
