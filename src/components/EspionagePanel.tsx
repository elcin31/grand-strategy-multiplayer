import {useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import {ESPIONAGE_MISSIONS,espionageQuote,espionageCapacity,espionageModifiers,type EspionageKind} from '../../supabase/functions/_shared/espionageSystem';
import {DiplomacyButton} from './DiplomacyActions';
import {styles,type StrategyProps} from './StrategyPanel';
export function EspionagePanel({state,playerId,onCommand,from,to}:StrategyProps&{from:string;to?:string}) {
  const [open,setOpen]=useState(false),enabled=['running','paused'].includes(state.phase);
  const missions=state.spyMissions?.filter(m=>m.ownerId===from)??[];
  const targets:{kind:EspionageKind;id:string}[]=[{kind:'Counterintelligence',id:from},...(to&&to!==from?(['IntelligenceGathering','Sabotage','PoliticalIntrigue'] as const).map(kind=>({kind,id:to})):[])];
  const counter=espionageModifiers(state,from).counterintelligence;
  return <View style={styles.wrap}>
    <Pressable accessibilityRole="button" accessibilityState={{expanded:open}} onPress={()=>setOpen(v=>!v)} style={styles.button}><Text style={styles.title}>Разведка и контрразведка {open?'▴':'▾'}</Text></Pressable>
    {open&&<View style={styles.card}>
      <Text style={styles.text}>Группы: {missions.length}/{espionageCapacity(state,from)} · контрразведка {counter?'действует':'не активна'}. Операции завершаются по игровым месяцам. Отзыв сохраняет расходы и cooldown.</Text>
      {targets.map(({kind,id})=>{const rule=ESPIONAGE_MISSIONS[kind],q=espionageQuote(state,from,id,kind);return <View key={kind} style={styles.card}>
        <Text style={styles.title}>{rule.name} · {state.countries[id]!.name}</Text>
        <Text style={styles.text}>{q.cost} млн · {q.pp} PP · {q.months} мес. · cooldown {rule.cooldown} мес.</Text>
        <Text style={styles.text}>{rule.description}</Text>
        <Text style={styles.text}>Оценка сейчас: успех {q.successChance}%, обнаружение {q.detectionChance}%. Контрразведка и технологии на момент завершения меняют исход. Обнаружение ухудшает отношения, доверие и репутацию даже при успехе.</Text>
        {q.reason&&<Text style={styles.text}>{q.reason}</Text>}
        <DiplomacyButton label={'Начать: '+rule.name} disabled={!enabled||!!q.reason} onPress={()=>onCommand({type:'START_ESPIONAGE',playerId,targetId:id,kind})}/>
      </View>;})}
      {!to&&<Text style={styles.text}>Выберите государство выше для внешних операций.</Text>}
      {missions.map(m=><View key={m.id} style={styles.card}><Text style={styles.text}>{ESPIONAGE_MISSIONS[m.kind].name} · {state.countries[m.targetId]!.name} · {Math.min(m.completeTick-m.startedTick,state.tick-m.startedTick)}/{m.completeTick-m.startedTick} мес.</Text><DiplomacyButton label="Отозвать разведывательную группу" disabled={!enabled} onPress={()=>onCommand({type:'CANCEL_ESPIONAGE',playerId,missionId:m.id})}/></View>)}
      <Text style={styles.title}>Действующие результаты</Text>
      {(state.spyEffects??[]).filter(e=>e.untilTick>state.tick&&(e.ownerId===from||e.targetId===from&&e.kind==='Sabotage')).map(e=><Text key={e.id} style={styles.text}>{e.kind==='Intel'?'Разведывательное преимущество':e.kind==='Sabotage'?'Саботаж':'Контрразведка'} · {state.countries[e.targetId]!.name} · ещё {e.untilTick-state.tick} мес.</Text>)}
      <Text style={styles.title}>Донесения</Text>
      {(state.spyReports??[]).filter(r=>r.ownerId===from||r.targetId===from&&r.detected).slice(0,12).map(r=><View key={r.id} style={styles.card}><Text style={styles.title}>Ход {r.tick} · {ESPIONAGE_MISSIONS[r.kind].name}</Text><Text style={styles.text}>{r.message}</Text>{r.intelligence&&r.ownerId===from&&<Text style={styles.text}>Снимок на ход {r.tick}: армия {r.intelligence.army.toLocaleString('ru-RU')} · казна {r.intelligence.treasury.toFixed(3)} млн · долг {r.intelligence.debt.toFixed(3)} млн · стабильность {r.intelligence.stability.toFixed(1)} · провинций {r.intelligence.provinceCount} · контрразведка {r.intelligence.counterintelligence?'да':'нет'}</Text>}</View>)}
    </View>}
  </View>;
}
