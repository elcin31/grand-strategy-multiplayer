import {useMemo,useState} from 'react';
import {Pressable,ScrollView,Text,View} from 'react-native';
import Svg,{Path} from 'react-native-svg';
import {colors} from '../ui/tokens';
import {BUILDING_ART} from '../ui/artCatalogue';
import {AtlasArt} from './AtlasArt';
import {styles} from './strategyStyles';
import type {StrategyProps} from './StrategyPanel';
import {TECHNOLOGIES,TECHNOLOGY_BRANCHES,techLevel} from '../../supabase/functions/_shared/technologySystem';
import {researchFunding} from '../../supabase/functions/_shared/economy2System';
import {TECHNOLOGY_DIRECTIONS,TECHNOLOGY_IDS,TECHNOLOGY_NODES,hasTechnology,scienceLevel,legacyTechnologyNode,namedResearchQuote,technologyNode,type TechnologyDirection,type TechnologyId} from '../../supabase/functions/_shared/technologyTree';

/** Mounted only inside the open panel; thirty original nodes form a bounded
 * landscape canvas. Camera gestures never update this graph. */
export function TechnologyTreePanel({state,playerId,onCommand}:StrategyProps){
  const [direction,setDirection]=useState<TechnologyDirection>('Economy'),[selected,setSelected]=useState<TechnologyId>('eco-ledger'),[zoom,setZoom]=useState(1);
  const countryId=state.players.find(p=>p.id===playerId)?.countryId,c=countryId?state.countries[countryId]:undefined;
  const nodes=useMemo(()=>TECHNOLOGY_IDS.filter(id=>TECHNOLOGY_NODES[id].direction===direction),[direction]);
  const width=190*zoom,height=150*zoom,cardWidth=164*zoom,cardHeight=132*zoom;
  const positions=useMemo(()=>new Map(nodes.map((id,i)=>[id,{x:(i%5)*width,y:Math.floor(i/5)*height}])),[nodes,width,height]);
  if(!c)return null;
  const selectedNode=technologyNode(selected)!,quote=namedResearchQuote(state,c,selected);
  const go=(id:TechnologyId)=>{setSelected(id);setDirection(TECHNOLOGY_NODES[id].direction);};
  const researchName=c.research?.branch==='Science'?'Наука':c.research?TECHNOLOGIES[c.research.branch].name:'';
  return <View style={styles.card}>
    <AtlasArt atlas="buildings" index={BUILDING_ART.University} height={84} label="Иллюстрация технологий: университет"/>
    <Text accessibilityLiveRegion="polite" style={styles.text}>{c.research?`${researchName}: ${c.research.progress.toFixed(1)} / ${c.research.required} мес. исследования`:'Выберите исследование. Одновременно доступен один проект.'}</Text>
    {c.research?.nodeId&&<Text style={styles.title}>{technologyNode(c.research.nodeId)?.name}</Text>}
    <Text style={styles.text}>Бюджет оплачивает каждый месяц работы. Университеты, научные открытия и правительство ускоряют исследования; банкротство приостанавливает их.</Text>
    <Text style={styles.title}>Наука · {scienceLevel(c)}/5</Text>
    <ScrollView horizontal contentContainerStyle={styles.row}>{TECHNOLOGY_BRANCHES.map(branch=>{const id=legacyTechnologyNode(branch,techLevel(c,branch)+1),q=id?namedResearchQuote(state,c,id):undefined,disabled=!id||!!q?.reason;return <Pressable key={branch} accessibilityRole="button" accessibilityLabel={`Исследовать ${TECHNOLOGIES[branch].name}`} accessibilityState={{disabled}} disabled={disabled} style={[styles.button,disabled&&styles.disabled]} onPress={()=>id&&onCommand({type:'START_TECHNOLOGY',playerId,nodeId:id})}><Text style={styles.title}>{TECHNOLOGIES[branch].name} · {techLevel(c,branch)}/5</Text><Text style={styles.text}>{q?`${q.cost} млн · ${q.months} мес.`:'Открыто полностью'}</Text></Pressable>;})}</ScrollView>
    <View style={[styles.row,{flexDirection:'row',flexWrap:'wrap'}]}>{(Object.keys(TECHNOLOGY_DIRECTIONS) as TechnologyDirection[]).map(d=><Pressable key={d} accessibilityRole="button" accessibilityLabel={'Направление: '+TECHNOLOGY_DIRECTIONS[d]} accessibilityState={{selected:d===direction}} style={styles.button} onPress={()=>go(TECHNOLOGY_IDS.find(id=>TECHNOLOGY_NODES[id].direction===d)!)}><Text style={styles.title}>{TECHNOLOGY_DIRECTIONS[d]}{d===direction?' ✓':''}</Text></Pressable>)}</View>
    <View style={[styles.row,{flexDirection:'row',alignItems:'center'}]}><Pressable accessibilityRole="button" accessibilityLabel="Уменьшить дерево технологий" disabled={zoom<=.85} style={styles.button} onPress={()=>setZoom(.85)}><Text style={styles.title}>−</Text></Pressable><Text style={styles.text}>{Math.round(zoom*100)}% · прокрутите дерево вбок</Text><Pressable accessibilityRole="button" accessibilityLabel="Увеличить дерево технологий" disabled={zoom>=1.15} style={styles.button} onPress={()=>setZoom(1.15)}><Text style={styles.title}>+</Text></Pressable></View>
    <ScrollView horizontal nestedScrollEnabled><View style={{width:width*5,height:height*Math.ceil(nodes.length/5)}}>
      <Svg width={width*5} height={height*Math.ceil(nodes.length/5)} style={{position:'absolute'}} accessible={false}>{nodes.flatMap(id=>TECHNOLOGY_NODES[id].prerequisites.map(p=>{const a=positions.get(p as TechnologyId),b=positions.get(id);return a&&b?<Path key={p+'>'+id} d={`M ${a.x+cardWidth} ${a.y+cardHeight/2} L ${b.x} ${b.y+cardHeight/2}`} stroke={hasTechnology(c,p)?colors.parchment:colors.muted} strokeWidth={2}/>:null;}))}</Svg>
      {nodes.map(id=>{const n=TECHNOLOGY_NODES[id],p=positions.get(id)!,owned=hasTechnology(c,id),active=c.research?.nodeId===id;return <Pressable key={id} accessibilityRole="button" accessibilityLabel={'Технология: '+n.name} accessibilityState={{selected:id===selected}} style={[styles.option,{position:'absolute',left:p.x,top:p.y,width:cardWidth,height:cardHeight,borderWidth:id===selected?2:1,borderColor:id===selected?colors.parchment:colors.raised,padding:8,gap:4}]} onPress={()=>setSelected(id)}><AtlasArt atlas="buildings" index={BUILDING_ART[n.art]} width={40} height={25} label={'Иллюстрация: '+n.name}/><Text numberOfLines={3} style={styles.title}>{n.name}</Text><Text style={styles.text}>{n.year} · {owned?'Открыто':active?'Исследуется':n.level+' уровень'}</Text></Pressable>;})}
    </View></ScrollView>
    <Text style={styles.title}>{selectedNode.name}</Text><Text style={styles.text}>{selectedNode.effect}</Text>
    <Text style={styles.text}>Эпоха: с {selectedNode.year} года · {quote.cost} млн · {quote.months} базовых месяцев · {(selectedNode.legacy?10:15)*selectedNode.level*researchFunding(c)} млн / мес.</Text>
    {selectedNode.prerequisites.map(id=><Pressable key={id} accessibilityRole="button" accessibilityLabel={'Перейти к предшественнику: '+technologyNode(id)!.name} style={styles.button} onPress={()=>go(id as TechnologyId)}><Text style={styles.text}>{hasTechnology(c,id)?'✓':'○'} {technologyNode(id)!.name}</Text></Pressable>)}
    {quote.reason&&<Text style={styles.text}>{quote.reason}</Text>}
    <Pressable accessibilityRole="button" accessibilityLabel={'Исследовать: '+selectedNode.name} accessibilityState={{disabled:!!quote.reason}} disabled={!!quote.reason} style={[styles.button,quote.reason&&styles.disabled]} onPress={()=>onCommand({type:'START_TECHNOLOGY',playerId,nodeId:selected})}><Text style={styles.title}>Начать исследование</Text></Pressable>
  </View>;
}
