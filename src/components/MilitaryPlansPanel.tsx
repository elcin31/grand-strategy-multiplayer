import {useState} from 'react';
import {Text,TextInput,ScrollView,View} from 'react-native';
import {AudioPressable as Pressable} from './AudioPressable';
import type {Army} from '../types/game';
import type {StrategyProps} from './StrategyPanel';
import type {MilitaryObjective} from '../../supabase/functions/_shared/ai3System';
import {styles} from './strategyStyles';
const objectives:Record<MilitaryObjective,string>={Capture:'Захватить провинцию',Defend:'Защитить регион',Border:'Удерживать границу',Capital:'Защитить столицу',Support:'Поддерживать союзника',Reserve:'Оставаться в резерве'};
export function MilitaryPlansPanel({state,army,playerId,onCommand}:StrategyProps&{army:Army}){
 const [objective,setObjective]=useState<MilitaryObjective>(army.militaryPlan?.objective??'Capture'),[target,setTarget]=useState(army.militaryPlan?.targetProvinceId??army.order?.targetProvinceId??army.provinceId),[search,setSearch]=useState('');
 const c=state.countries[army.ownerId]!,capital=state.cities?.find(c=>c.id===state.countries[army.ownerId]!.capitalCityId)?.provinceId;
 const button=(label:string,action:()=>void,selected=false)=><Pressable accessibilityRole="button" accessibilityState={{selected}} style={styles.button} onPress={action}><Text style={styles.title}>{selected?'✓ ':''}{label}</Text></Pressable>;
 return <View style={styles.card}><Text style={styles.title}>Военный план · {army.militaryPlan?.status??'Не назначен'}</Text><Text style={styles.text}>{army.militaryPlan?.reason??'Выберите цель операции. Генерал ищет доступные маршруты и отказывается от самоубийственных атак.'}{army.militaryPlan?.reinforcementRequested?' · Требуются подкрепления':''}</Text><ScrollView horizontal contentContainerStyle={{gap:5}}>{(Object.keys(objectives) as MilitaryObjective[]).map(key=><View key={key}>{button(objectives[key],()=>{setObjective(key);if(key==='Capital'&&capital)setTarget(capital);},key===objective)}</View>)}</ScrollView>
 <Text style={styles.title}>Цель: {state.provinces.find(p=>p.id===target)?.name??c.name}</Text><TextInput accessibilityLabel="Найти цель военного плана" placeholder="Название провинции" placeholderTextColor="#aaa28e" value={search} onChangeText={setSearch} style={{color:'#eee6cc',minHeight:44,backgroundColor:'#162330',padding:8}}/><ScrollView horizontal nestedScrollEnabled contentContainerStyle={{gap:5}}>{state.provinces.filter(p=>search?p.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()):p.id===target||p.neighbors.includes(army.provinceId)||p.id===capital).slice(0,50).map(p=><View key={p.id}>{button(p.name,()=>setTarget(p.id),p.id===target)}</View>)}</ScrollView>
 <View style={{flexDirection:'row',flexWrap:'wrap',gap:5}}>{[false,true].map(autoCommand=><View key={String(autoCommand)}>{button(autoCommand?'Разрешить генералу выполнять план':'Назначить цель вручную',()=>onCommand({type:'SET_MILITARY_PLAN',playerId,armyId:army.id,provinceId:target,objective,autoCommand}))}</View>)}{army.militaryPlan&&button(army.militaryPlan.autoCommand?'Отключить автоматическое командование':'Включить автоматическое командование',()=>onCommand({type:'SET_AUTO_COMMAND',playerId,armyId:army.id,enabled:!army.militaryPlan!.autoCommand}))}</View><Text style={styles.text}>Ручной марш, остановка или отступление имеют приоритет. Существующий маршрут заканчивается прежде, чем генерал принимает следующий оперативный приказ.</Text>
 </View>;
}
