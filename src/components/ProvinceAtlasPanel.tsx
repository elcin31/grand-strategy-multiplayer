import {useState} from 'react';
import {StyleSheet,Text,View} from 'react-native';
import {SvgXml} from 'react-native-svg';
import type {Army,BuildingType,GameCommand,GameState,Province} from '../types/game';
import {getWorldFlag} from '../world/catalog';
import {colors} from '../ui/tokens';
import {PanelTabs} from './PanelTabs';
import {HistoricalIllustration} from './HistoricalIllustration';
import {AtlasArt} from './AtlasArt';
import {BUILDING_ART} from '../ui/artCatalogue';
import {ExpansionArt} from './ExpansionArt';
import {constructionScene} from '../ui/expansionArt';
import {ConstructionPanel} from './ConstructionPanel';
import {MilitaryPanel} from './MilitaryPanel';
import {BattleSiegePanel} from './BattleSiegePanel';
import {AudioPressable as Pressable} from './AudioPressable';
import {provinceResources} from '../map/strategic22';
import {RESOURCES,provinceProduction} from '../../supabase/functions/_shared/resourceSystem';
import {BUILDINGS} from '../../supabase/functions/_shared/buildingSystem';
import {PRODUCTION_RECIPES} from '../../supabase/functions/_shared/productionSystem';
import {supplyAt} from '../../supabase/functions/_shared/supplySystem';
const TABS=['Обзор','Города','Инфраструктура','Ресурсы','Строительство','Военное положение'];
const compact=(n:number)=>n>=1e6?(n/1e6).toFixed(2)+' млн':n>=1e3?(n/1e3).toFixed(1)+' тыс.':n.toFixed(0);
const TERRAIN={plains:'Равнины',forest:'Лес',mountain:'Горы',desert:'Пустыня',urban:'Городская местность'};
export function ProvinceAtlasPanel({state,province,playerId,army,onCommand,onSelectArmy,onFocus,onCreateArmy}:{state:GameState;province:Province;playerId:string;army:Army|null;onCommand:(c:GameCommand)=>void;onSelectArmy?:(id:string,province:string)=>void;onFocus?:(id:string)=>void;onCreateArmy?:()=>void}){
  const [tab,setTab]=useState('Обзор');
  const countryId=state.players.find(p=>p.id===playerId)?.countryId??'',owner=state.countries[province.ownerId]!,controller=state.countries[province.controllerId??province.ownerId]!;
  const cities=(state.cities??[]).filter(c=>c.provinceId===province.id).sort((a,b)=>Number(b.isCapital)-Number(a.isCapital)||b.population-a.population);
  const buildings=(Object.entries(province.buildings??{}) as [BuildingType,number][]).filter(([,n])=>n>0);
  const resources=provinceResources(province),supply=supplyAt(state,controller.id,province.id);
  const garrison=state.sieges?.find(s=>s.provinceId===province.id)?.garrison;
  const formations=state.armies.filter(a=>a.provinceId===province.id);
  const militaryInfo=()=> <><MilitaryPanel state={state} playerId={playerId} onCommand={onCommand} province={province} army={army} onCreateArmy={onCreateArmy}/><BattleSiegePanel state={state} countryId={countryId} provinceId={province.id} playerId={playerId} onCommand={onCommand}/></>;
  const metrics=[['Население',compact(province.population)],['Доход',`$${province.income.toFixed(1)}M / мес.`],['Развитие',`${province.development??40} / 100`],['Снабжение',`${supply.score}%`],['Крепость',`Уровень ${province.buildings?.Fort??0}`],['Гарнизон',garrison===undefined?'Нет осадного гарнизона':compact(garrison)]];
  return <View style={styles.wrap}>
    <View style={styles.header}><SvgXml xml={getWorldFlag(owner.id)??'<svg xmlns="http://www.w3.org/2000/svg"/>'} width={42} height={28}/><View style={{flex:1}}><Text style={styles.title}>{province.name}</Text><Text style={styles.muted}>{owner.name} · {TERRAIN[province.terrain??'plains']}</Text></View><Pressable accessibilityLabel="Приблизить выбранную провинцию" style={styles.focus} onPress={()=>onFocus?.(province.id)}><Text style={styles.gold}>⌖ На карте</Text></Pressable></View>
    {controller.id!==owner.id&&<Text style={styles.occupied}>Оккупация · владелец: {owner.name} · контроль: {controller.name}</Text>}
    <PanelTabs tabs={TABS} value={tab} onChange={setTab}/>
    {tab==='Обзор'&&<>
      <View style={styles.overview}><View style={styles.metrics}>{metrics.map(([label,value])=><View key={label} style={styles.metric}><Text style={styles.muted}>{label}</Text><Text style={styles.value}>{value}</Text></View>)}</View><View style={styles.summary}><HistoricalIllustration id={province.terrain==='mountain'?'f15-watershed':province.buildings?.Port?'e06-harbor':province.buildings?.Factory&&state.year>=1800?'e10-steel':'e01-harvest'} height={90}/><Text style={styles.gold}>Основные ресурсы</Text><Text style={styles.text}>{resources.length?resources.map(r=>RESOURCES[r.type].name).join(' · '):'Нет подтверждённых месторождений'}</Text><Text style={styles.muted}>Города: {cities.length} · Постройки: {buildings.reduce((n,[,l])=>n+l,0)} уровней</Text><Text style={styles.muted}>Игровая местность: {TERRAIN[province.terrain??'plains']}. Она определяет движение и бой.</Text></View></View>
      <View style={styles.progress}><View style={[styles.progressFill,{width:`${supply.score}%`}]}/></View>
      <Text style={styles.muted}>Снабжение · {supply.reason??'Доступен путь к узлу снабжения'}</Text>
      <View style={styles.actions}>{['Города','Инфраструктура','Строительство','Военное положение'].map(t=><Pressable key={t} style={styles.action} onPress={()=>setTab(t)}><Text style={styles.gold}>{t}</Text></Pressable>)}</View>
    </>}
    {tab==='Города'&&<>{cities.length===0&&<Text style={styles.muted}>В этой провинции нет городов в каталоге кампании.</Text>}{cities.map(city=><View key={city.id} style={styles.row}><Text style={styles.value}>{city.isCapital?'★ ':city.isRegionalCapital?'◆ ':'◇ '}{city.name}</Text><Text style={styles.muted}>{city.isCapital?'Столица':city.isRegionalCapital?'Региональный центр':'Город'} · {compact(city.population)} · развитие {city.development}</Text></View>)}</>}
    {tab==='Инфраструктура'&&<><View style={styles.buildings}>{buildings.map(([type,level])=>{const art=constructionScene(type);return <View key={type} style={styles.building}>{art?<ExpansionArt name={art} width={64} height={48} label={BUILDINGS[type].name}/>:<AtlasArt atlas="buildings" index={BUILDING_ART[type]} width={64} height={48} label={BUILDINGS[type].name}/>}<Text style={styles.text}>{BUILDINGS[type].name}</Text><Text style={styles.gold}>Уровень {level}</Text></View>;})}</View>{!buildings.length&&<Text style={styles.muted}>Постройки отсутствуют.</Text>}<Text style={styles.muted}>Повреждения: {((province.buildingDamage??0)*100).toFixed(0)}% · Новые объекты доступны во вкладке строительства.</Text></>}
    {tab==='Ресурсы'&&<>
      {resources.map((r,i)=>{const out=provinceProduction({...province,income:province.income*('weight'in r?Number(r.weight):i===resources.length-1&&province.secondaryDeposit?.type===r.type?.3:1),resourceMix:undefined,resourceDeposit:r},owner);return <View style={styles.row} key={r.type+'-'+i}><Text style={styles.value}>{RESOURCES[r.type].name}</Text><Text style={styles.text}>Богатство {r.richness}/100 · {out.units.toFixed(1)} ед./мес. · ${out.revenue.toFixed(2)}M</Text></View>;})}
      {resources.length===0&&<Text style={styles.muted}>Данные о месторождениях отсутствуют.</Text>}
      <Text style={styles.gold}>Подтверждённый выпуск предприятий</Text>
      {(province.productionResults??[]).map((r,i)=><View key={r.buildingType+i} style={styles.row}><Text style={styles.text}>{BUILDINGS[r.buildingType].name} · {RESOURCES[PRODUCTION_RECIPES[r.recipeId].output].name}: {r.output.toFixed(1)} ед.</Text><Text style={styles.muted}>Эффективность {(r.efficiency*100).toFixed(0)}%{r.reason?' · '+r.reason:''}</Text></View>)}
      {!province.productionResults?.length&&<Text style={styles.muted}>Отчёт о выпуске появится после производственного расчёта.</Text>}
    </>}
    {tab==='Строительство'&&<ConstructionPanel state={state} playerId={playerId} onCommand={onCommand} provinceId={province.id} onFocus={onFocus??(()=>{})}/>}
    {tab==='Военное положение'&&<><View style={styles.row}><Text style={styles.value}>{formations.length} формирований · {compact(formations.reduce((n,a)=>n+a.troops,0))} войск</Text><Text style={styles.muted}>Контроль: {controller.name} · снабжение {supply.score}%</Text></View>{formations.map(a=><Pressable key={a.id} disabled={a.ownerId!==countryId} accessibilityLabel={'Выбрать армию '+(a.name??a.id)} style={styles.action} onPress={()=>onSelectArmy?.(a.id,a.provinceId)}><Text style={styles.text}>{a.name??state.countries[a.ownerId]?.name} · {compact(a.troops)}</Text></Pressable>)}{militaryInfo()}</>}
  </View>;
}
const styles=StyleSheet.create({wrap:{gap:9},header:{flexDirection:'row',gap:12,alignItems:'center',padding:8,borderBottomWidth:1,borderBottomColor:colors.border},title:{fontFamily:'serif',fontSize:21,color:'#ead8ab'},muted:{color:colors.muted,fontSize:11,lineHeight:17},text:{color:colors.parchment,fontSize:12,lineHeight:18},gold:{color:colors.gold,fontSize:12,fontWeight:'600'},focus:{minHeight:44,paddingHorizontal:10,justifyContent:'center',borderWidth:1,borderColor:colors.border},occupied:{color:'#dfac78',fontSize:12,padding:8,backgroundColor:'#522e2844'},overview:{flexDirection:'row',gap:14},metrics:{flex:1,flexDirection:'row',flexWrap:'wrap'},metric:{width:'50%',padding:10,borderBottomWidth:1,borderBottomColor:'#61563e55'},value:{fontSize:14,color:colors.parchment,fontWeight:'700',fontVariant:['tabular-nums'],lineHeight:22},summary:{flex:1,gap:6,padding:6},progress:{height:5,backgroundColor:'#21352f'},progressFill:{height:5,backgroundColor:'#6ca38a'},actions:{flexDirection:'row',flexWrap:'wrap',gap:6},action:{minHeight:44,padding:10,justifyContent:'center',backgroundColor:'#162632',borderWidth:1,borderColor:'#61563e77',borderRadius:3},row:{padding:10,borderBottomWidth:1,borderBottomColor:'#61563e66',gap:4},buildings:{flexDirection:'row',flexWrap:'wrap',gap:8},building:{width:118,padding:8,alignItems:'center',gap:5,borderWidth:1,borderColor:colors.border,backgroundColor:colors.inset}});
