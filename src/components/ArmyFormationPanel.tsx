import {useMemo,useState} from 'react';
import {ScrollView,Text,TextInput,View} from 'react-native';
import {AudioPressable as Pressable} from './AudioPressable';
import type {GameCommand,GameState} from '../types/game';
import {armyTemplates,templateComposition,formationQuote,unitAvailable,MAX_FORMATION_TROOPS} from '../../supabase/functions/_shared/armyFormationSystem';
import {UNIT_TYPES,UNITS} from '../../supabase/functions/_shared/unitCatalogue';
import {compositionTotal,type Composition} from '../../supabase/functions/_shared/armyComposition';
import {dateAfterDays} from '../../supabase/functions/_shared/calendarSystem';
import {colors} from '../ui/tokens';
import {styles} from './strategyStyles';
const input={color:colors.parchment,backgroundColor:colors.inset,borderWidth:1,borderColor:colors.border,borderRadius:4,minHeight:44,padding:8};
export function ArmyFormationPanel({state,playerId,initialProvince,onSubmit,onCommand}:{state:GameState;playerId:string;initialProvince?:string|null;onSubmit:(c:GameCommand)=>Promise<void>;onCommand:(c:GameCommand)=>void}){
 const owner=state.players.find(p=>p.id===playerId)?.countryId??'',c=state.countries[owner];
 const provinces=useMemo(()=>state.provinces.filter(p=>p.ownerId===owner&&(p.controllerId??p.ownerId)===owner&&!p.rebellion),[state.provinces,owner]);
 const [name,setName]=useState(`${state.armies.filter(a=>a.ownerId===owner).length+1}-я армия`),[province,setProvince]=useState(provinces.some(p=>p.id===initialProvince)?initialProvince!:provinces[0]?.id??'');
 const [troops,setTroops]=useState('10000'),[template,setTemplate]=useState('balanced'),[custom,setCustom]=useState<Composition|null>(null),[commander,setCommander]=useState<string|null>(null),[search,setSearch]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 if(!c)return null;const templates=armyTemplates(state,c),chosen=templates.find(t=>t.id===template)??templates[0]!,number=Number(troops),parts=custom??templateComposition(chosen,Number.isSafeInteger(number)?number:0),quote=formationQuote(state,owner,province,parts,commander),total=compositionTotal(parts);
 const button=(label:string,action:()=>void,disabled=false,selected=false)=><Pressable accessibilityRole="button" accessibilityState={{disabled,selected}} disabled={disabled} style={[styles.button,selected&&{borderWidth:1,borderColor:colors.gold},disabled&&styles.disabled]} onPress={action}><Text style={styles.title}>{label}</Text></Pressable>;
 const start=async()=>{if(busy||quote.reason)return;setBusy(true);setError('');try{await onSubmit({type:'CREATE_NEW_ARMY',playerId,name,provinceId:province,composition:parts,commanderId:commander});}catch(e){setError(e instanceof Error?e.message:'Не удалось начать формирование');}finally{setBusy(false);}};
 return <View style={styles.wrap}>
  <Text style={styles.title}>Название армии</Text><TextInput accessibilityLabel="Название новой армии" value={name} onChangeText={setName} maxLength={48} style={input}/>
  <Text style={styles.title}>Провинция формирования · {provinces.find(p=>p.id===province)?.name??'Выберите'}</Text><TextInput accessibilityLabel="Найти провинцию формирования" placeholder="Поиск провинции" placeholderTextColor={colors.muted} value={search} onChangeText={setSearch} style={input}/>
  <ScrollView horizontal nestedScrollEnabled contentContainerStyle={{gap:5}}>{provinces.filter(p=>p.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(p=><View key={p.id}>{button(p.name,()=>setProvince(p.id),false,province===p.id)}</View>)}</ScrollView>
  <Text style={styles.title}>Численность · резерв {c.manpower.toLocaleString('ru-RU')} · предел {MAX_FORMATION_TROOPS.toLocaleString('ru-RU')}</Text><TextInput accessibilityLabel="Численность новой армии" keyboardType="number-pad" value={troops} onChangeText={v=>{setTroops(v.replace(/\D/g,''));setCustom(null);}} maxLength={7} style={input}/>
  <Text style={styles.title}>Шаблон</Text><ScrollView horizontal nestedScrollEnabled contentContainerStyle={{gap:5}}>{templates.map(t=><View key={t.id}>{button(t.name,()=>{setTemplate(t.id);setCustom(null);},false,template===t.id)}</View>)}</ScrollView>
  <Text style={styles.title}>Состав · всего {total.toLocaleString('ru-RU')}</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{UNIT_TYPES.filter(t=>unitAvailable(state,c,t)).map(t=><View key={t} style={{width:180}}><Text style={styles.text}>{UNITS[t].name}</Text><TextInput accessibilityLabel={`Солдаты: ${UNITS[t].name}`} keyboardType="number-pad" value={String(parts[t]??0)} maxLength={7} onChangeText={v=>{const updated={...parts},count=Number(v.replace(/\D/g,''));if(count)updated[t]=count;else delete updated[t];setCustom(updated);}} style={input}/></View>)}</View>
  {button('Сохранить состав как собственный шаблон',()=>onCommand({type:'SAVE_ARMY_TEMPLATE',playerId,templateId:'custom-'+Date.now().toString(36),name:name.trim()||'Мой шаблон',weights:Object.fromEntries(Object.entries(parts).map(([t,n])=>[t,Math.max(1,Math.round(n!/Math.max(1,total)*1000))]))}),total<1000)}
  <Text style={styles.title}>Командир</Text><ScrollView horizontal nestedScrollEnabled contentContainerStyle={{gap:5}}><View>{button('Без генерала',()=>setCommander(null),false,commander===null)}</View>{Object.values(state.commanders??{}).filter(g=>g.countryId===owner&&!state.armies.some(a=>a.commanderId===g.id)&&!state.armyFormations?.some(q=>q.commanderId===g.id)).map(g=><View key={g.id}>{button(g.name,()=>setCommander(g.id),false,commander===g.id)}</View>)}</ScrollView>
  <View style={styles.card}><Text style={styles.title}>Стоимость ${quote.cost.toLocaleString('ru-RU')}M · {quote.days} игровых дней · до {dateAfterDays(state,quote.days)}</Text><Text style={styles.text}>Вооружение {quote.materials.weapons??0} · боеприпасы {quote.materials.ammunition??0} · топливо {quote.materials.fuel??0}. Деньги и резерв списываются один раз. При нескольких формированиях в одной провинции учебная мощность делится между ними.</Text>{quote.reason&&<Text style={{color:colors.gold}}>{quote.reason}</Text>}</View>
  {error!==''&&<Text accessibilityRole="alert" style={{color:colors.gold}}>{error}</Text>}{button(busy?'Сервер подтверждает…':'Начать формирование',()=>{void start();},busy||!!quote.reason||!name.trim())}
 </View>;
}
