import {CampaignArt} from './CampaignArt';
import {PoliticalDecisionsPanel} from './PoliticalDecisionsPanel';
import {useMemo,useState} from 'react';
import {Pressable,ScrollView,Text,View} from 'react-native';
import Svg,{Path} from 'react-native-svg';
import {colors} from '../ui/tokens';
import {BUILDING_ART} from '../ui/artCatalogue';
import {styles} from './strategyStyles';
import {AtlasArt} from './AtlasArt';
import type {StrategyProps} from './StrategyPanel';
import {FOCUS_BRANCHES,FOCUS_IDS,FOCUS_NODES,focusBelongsTo,focusNode,hasFocus,focusRewardLines,type FocusBranch,type FocusId} from '../../supabase/functions/_shared/focusCatalogue';
import {focusAvailability} from '../../supabase/functions/_shared/focusSystem';
import {technologyNode} from '../../supabase/functions/_shared/technologyTree';
type FocusTab=FocusBranch|'Regional'|'Unique';
export function NationalFocusPanel({state,playerId,onCommand}:StrategyProps){
 const [decisions,setDecisions]=useState(false);
 const [tab,setTab]=useState<FocusTab>('Economic'),[selected,setSelected]=useState<FocusId>('eco-audit');
 const countryId=state.players.find(p=>p.id===playerId)?.countryId,c=countryId?state.countries[countryId]:undefined;
 const nodes=useMemo(()=>c?FOCUS_IDS.filter(id=>focusBelongsTo(c,FOCUS_NODES[id]!)&&(tab==='Regional'||tab==='Unique'?FOCUS_NODES[id]!.category===tab:FOCUS_NODES[id]!.category==='Generic'&&FOCUS_NODES[id]!.branch===tab)):[],[c?.id,c?.region,tab]);
 const positions=useMemo(()=>new Map(nodes.map((id,i)=>[id,{x:(i%5)*190,y:Math.floor(i/5)*150}])),[nodes,tab]);
 if(!c)return null;
 const n=focusNode(selected)!,reason=focusAvailability(state,c.id,selected),project=c.nationalFocus,events=state.focusEvents?.filter(e=>e.countryId===c.id).slice(0,8)??[],enabled=['running','paused'].includes(state.phase);
 const go=(id:FocusId)=>{const node=FOCUS_NODES[id]!;setSelected(id);setTab(node.category==='Generic'?node.branch:node.category);};
 const tabs:FocusTab[]=[...Object.keys(FOCUS_BRANCHES) as FocusBranch[],'Regional',...FOCUS_IDS.some(id=>FOCUS_NODES[id]!.category==='Unique'&&focusBelongsTo(c,FOCUS_NODES[id]!))?['Unique' as const]:[]];
 const label=(value:FocusTab)=>value==='Regional'?'Региональный курс':value==='Unique'?'Особый курс':FOCUS_BRANCHES[value];
 const width=Math.min(5,nodes.length)*190,height=Math.max(150,Math.ceil(nodes.length/5)*150);
 return <View style={styles.card}>
  <Text style={[styles.title,{fontSize:17}]}>DOMINION — НАЦИОНАЛЬНЫЙ КУРС</Text>
  <View style={{flexDirection:'row',gap:6}}><Pressable style={styles.button} onPress={()=>setDecisions(false)}><Text style={styles.title}>Фокусы (120)</Text></Pressable><Pressable style={styles.button} onPress={()=>setDecisions(true)}><Text style={styles.title}>Особенности и решения</Text></Pressable></View>
  {decisions?<PoliticalDecisionsPanel state={state} playerId={playerId} onCommand={onCommand}/>:<>
  <CampaignArt year={state.year} kind="Project"/>
  <Text style={styles.text}>Одна программа одновременно. Цена оплачивается при выборе, результаты действуют после завершения. Альтернативные программы исключают друг друга; прерывание теряет вложения и прогресс.</Text>
  <Text style={styles.title}>Завершено курсов: {c.completedFocuses?.length??0}</Text>
  {project&&<View style={styles.card}><Text accessibilityLiveRegion="polite" style={styles.title}>Национальный курс: {FOCUS_NODES[project.focusId]!.name} · {project.progress}/{FOCUS_NODES[project.focusId]!.duration} мес.</Text>{state.tick<(c.bankruptcyUntilTick??0)&&<Text style={styles.text}>Работа приостановлена до выхода из банкротства.</Text>}<Pressable accessibilityRole="button" accessibilityLabel="Прервать национальный курс" accessibilityState={{disabled:!enabled}} disabled={!enabled} style={styles.button} onPress={()=>onCommand({type:'CANCEL_NATIONAL_FOCUS',playerId})}><Text style={styles.title}>Прервать курс</Text></Pressable></View>}
  <View style={[styles.row,{flexDirection:'row',flexWrap:'wrap'}]}>{tabs.map(t=><Pressable key={t} accessibilityRole="button" accessibilityLabel={'Ветка курса: '+label(t)} accessibilityState={{selected:t===tab}} style={styles.button} onPress={()=>{setTab(t);const first=FOCUS_IDS.find(id=>focusBelongsTo(c,FOCUS_NODES[id]!)&&(t==='Regional'||t==='Unique'?FOCUS_NODES[id]!.category===t:FOCUS_NODES[id]!.category==='Generic'&&FOCUS_NODES[id]!.branch===t));if(first)setSelected(first);}}><Text style={styles.title}>{label(t)}{t===tab?' ✓':''}</Text></Pressable>)}</View>
  <Text style={styles.text}>Пролистайте дерево вбок. Кнопки предшественников ниже переходят к нужной ветке.</Text>
  <ScrollView horizontal nestedScrollEnabled><View style={{width,height}}>
   <Svg width={width} height={height} style={{position:'absolute'}} accessible={false}>{nodes.flatMap(id=>[...FOCUS_NODES[id]!.prerequisites,...FOCUS_NODES[id]!.eitherPrerequisites??[]].map(parent=>{const a=positions.get(parent as FocusId),b=positions.get(id);return a&&b?<Path key={parent+'>'+id} d={`M ${a.x+164} ${a.y+64} L ${b.x} ${b.y+64}`} stroke={hasFocus(c,parent)?colors.parchment:colors.muted} strokeWidth={2}/>:null;}))}</Svg>
   {nodes.map(id=>{const node=FOCUS_NODES[id]!,p=positions.get(id)!,completed=hasFocus(c,id);return <Pressable key={id} accessibilityRole="button" accessibilityLabel={'Курс: '+node.name} accessibilityState={{selected:id===selected}} style={[styles.option,{position:'absolute',left:p.x,top:p.y,width:164,height:132,padding:8,gap:4,borderWidth:id===selected?2:1,borderColor:id===selected?colors.parchment:colors.raised}]} onPress={()=>setSelected(id)}><AtlasArt atlas="buildings" index={BUILDING_ART[node.art]} width={40} height={25} label={'Иллюстрация курса: '+node.name}/><Text numberOfLines={3} style={styles.title}>{node.name}</Text><Text style={styles.text}>{completed?'Завершено':project?.focusId===id?'Выполняется':node.duration+' месяцев'}</Text></Pressable>;})}
  </View></ScrollView>
  <Text style={styles.title}>{n.name}</Text><Text style={styles.text}>{n.cost} млн · {n.pp} PP · {n.duration} месяцев</Text>
  {focusRewardLines(selected).map(line=><Text key={line} style={styles.text}>{line}</Text>)}
  {n.exclusiveGroup&&<Text style={styles.text}>Взаимоисключающий выбор. Альтернатива: {FOCUS_IDS.filter(id=>id!==selected&&FOCUS_NODES[id]!.exclusiveGroup===n.exclusiveGroup).map(id=>FOCUS_NODES[id]!.name).join(', ')}.</Text>}
  {n.eitherPrerequisites&&<Text style={styles.text}>Нужна одна из следующих альтернатив:</Text>}
  {[...n.prerequisites,...n.eitherPrerequisites??[]].map(id=><Pressable key={id} accessibilityRole="button" accessibilityLabel={'Предшественник курса: '+FOCUS_NODES[id as FocusId]!.name} style={styles.button} onPress={()=>go(id as FocusId)}><Text style={styles.text}>{hasFocus(c,id)?'✓':'○'} {FOCUS_NODES[id as FocusId]!.name}</Text></Pressable>)}
  {n.technologies?.map(id=><Text key={id} style={styles.text}>Технология: {technologyNode(id)!.name}</Text>)}
  {reason&&<Text style={styles.text}>{reason}</Text>}
  <Pressable accessibilityRole="button" accessibilityLabel={'Взять курс: '+n.name} accessibilityState={{disabled:!!reason}} disabled={!!reason} style={[styles.button,reason&&styles.disabled]} onPress={()=>onCommand({type:'START_NATIONAL_FOCUS',playerId,focusId:selected})}><Text style={styles.title}>Взять национальный курс</Text></Pressable>
  {!!events.length&&<Text style={styles.title}>События национального курса</Text>}
  {events.map(e=><View key={e.id} style={styles.card}><Text style={styles.title}>{e.kind==='Completed'?'Курс завершён':e.kind==='Started'?'Начало курса':'Программа прервана'} · месяц {e.tick}</Text><Text style={styles.text}>{e.message}</Text></View>)}
 </>}
 </View>;
}
