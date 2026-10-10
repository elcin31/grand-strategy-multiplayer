import {HistoricalArt} from './HistoricalArt';
import {LeaderPortrait} from './Heraldry';
import {portraitSeedFor} from '../ui/artCatalogue';
import {useMemo} from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { Army, Province } from '../types/game';
import { UNITS, UNIT_TYPES } from '../../supabase/functions/_shared/militarySystem';
import { techLevel } from '../../supabase/functions/_shared/technologySystem';
import {armyParts} from '../../supabase/functions/_shared/armyComposition';
import {supplyAt} from '../../supabase/functions/_shared/supplySystem';
import {reinforcementQuote,retreatDestination} from '../../supabase/functions/_shared/militaryLogistics';
import { styles, type StrategyProps } from './StrategyPanel';
export function MilitaryPanel({state,playerId,onCommand,province,army}: StrategyProps & {province:Province;army:Army|null}) {
  const countryId=state.players.find(p=>p.id===playerId)?.countryId;
  const logistics=useMemo(()=>state.dataset&&army&&army.ownerId===countryId?{supply:supplyAt(state,army.ownerId,army.provinceId),reinforcement:reinforcementQuote(state,army),retreat:retreatDestination(state,army)}:null,[state,army,countryId]);
  if(!state.dataset || !countryId)return null;
  const c=state.countries[countryId]!;
  const commander=army?.commanderId?state.commanders?.[army.commanderId]:undefined;
  const own=!province.rebellion && province.ownerId===countryId && (province.controllerId??province.ownerId)===countryId;
  return <View style={styles.wrap}><HistoricalArt name="military"/>
    <Text style={styles.text}>Рельеф: {province.terrain} · {army ? `${UNITS[army.unitType??'Infantry'].name} · мораль ${army.morale?.toFixed(0)} · организация ${army.organization?.toFixed(0)}` : 'Выберите свою армию ниже'}</Text>
    {army&&<View style={{flexDirection:'row',alignItems:'center',gap:10}}>{commander&&<LeaderPortrait seed={portraitSeedFor(commander.id)} size={40} label={'Портрет вымышленного полководца: '+commander.name}/>}<Text style={[styles.text,{flex:1}]}>Командир: {commander?.name??'Не назначен'} · {army.troops.toLocaleString()} солдат. {army.order?`Цель: ${state.provinces.find(p=>p.id===army.order!.targetProvinceId)?.name} · ${army.order.route.length} шагов / мес.`:"Приказ: удерживать позицию. Выберите армию на карте, затем нажмите целевую провинцию."}</Text></View>}
    {army?.order&&<Pressable accessibilityRole="button" style={styles.button} onPress={()=>onCommand({type:"CANCEL_ARMY_ORDER",playerId,armyId:army.id})}><Text style={styles.title}>Отменить приказ</Text></Pressable>}
    {army&&logistics&&<View style={styles.card}>
      <Text style={styles.title}>Состав армии · опыт {(army.experience??0).toFixed(0)}/100</Text>
      <Text style={styles.text}>{UNIT_TYPES.filter(t=>(armyParts(army)[t]??0)>0).map(t=>`${UNITS[t].name}: ${armyParts(army)[t]!.toLocaleString()}`).join(' · ')}</Text>
      <Text style={styles.text}>Снабжение {logistics.supply.score}% · пропускная способность {logistics.supply.capacity.toLocaleString()} · нагрузка {Math.ceil(logistics.supply.load).toLocaleString()}{logistics.supply.sea?' · морской маршрут между портами':''}. {logistics.supply.reason??'Маршрут снабжения открыт.'}</Text>
      <Text style={styles.text}>Деньги и резерв списываются за каждое пополнение. Оно восстанавливает утраченные части по штату; снабжение ниже 40% вызывает потери.</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Пополнить выбранную армию" disabled={!!logistics.reinforcement.reason} style={[styles.button,!!logistics.reinforcement.reason&&styles.disabled]} onPress={()=>onCommand({type:'REINFORCE_ARMY',playerId,armyId:army.id})}><Text style={styles.title}>{logistics.reinforcement.reason??`Пополнить +${logistics.reinforcement.troops.toLocaleString()} · $${logistics.reinforcement.cost}M`}</Text></Pressable>
      <Pressable accessibilityRole="switch" accessibilityLabel="Автоматическое пополнение" accessibilityState={{checked:!!army.reinforcementEnabled}} style={styles.button} onPress={()=>onCommand({type:'SET_REINFORCEMENT',playerId,armyId:army.id,enabled:!army.reinforcementEnabled})}><Text style={styles.title}>Автоматическое пополнение: {army.reinforcementEnabled?'включено':'выключено'}</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Отступить в безопасную провинцию" disabled={!logistics.retreat||state.tick<(army.retreatUntilTick??0)} style={[styles.button,(!logistics.retreat||state.tick<(army.retreatUntilTick??0))&&styles.disabled]} onPress={()=>logistics.retreat&&onCommand({type:'RETREAT_ARMY',playerId,armyId:army.id,provinceId:logistics.retreat.id})}><Text style={styles.title}>{state.tick<(army.retreatUntilTick??0)?'Восстановление после отступления':logistics.retreat?`Отступить: ${logistics.retreat.name}`:'Нет безопасного пути отступления'}</Text></Pressable>
      <ScrollView horizontal contentContainerStyle={styles.row}>{UNIT_TYPES.map(unitType=>{const u=UNITS[unitType],at=state.provinces.find(p=>p.id===army.provinceId),disabled=!at||at.rebellion||at.ownerId!==countryId||(at.controllerId??at.ownerId)!==countryId||techLevel(c,'Military')<u.unlock||state.year<u.era||c.treasury<u.cost||c.manpower<1000||state.tick<(c.bankruptcyUntilTick??0);return <Pressable accessibilityRole="button" accessibilityLabel={`Добавить часть: ${u.name}`} key={unitType} disabled={!!disabled} style={[styles.option,!!disabled&&styles.disabled]} onPress={()=>onCommand({type:'ADD_REGIMENT',playerId,armyId:army.id,troops:1000,unitType})}><Text style={styles.title}>Добавить {u.name} +1K</Text><Text style={styles.text}>${u.cost}M · технология {u.unlock} · с {u.era} г.</Text></Pressable>;})}</ScrollView>
    </View>}
    {own && <ScrollView horizontal contentContainerStyle={styles.row}>{UNIT_TYPES.map(unitType=>{const u=UNITS[unitType],disabled=techLevel(c,'Military')<u.unlock || state.year<u.era || c.treasury<u.cost*10 || c.manpower<10000 || state.tick<(c.bankruptcyUntilTick??0);return <Pressable accessibilityRole="button" key={unitType} disabled={disabled} style={[styles.option,disabled&&styles.disabled]} onPress={()=>onCommand({type:'RECRUIT_UNIT',playerId,provinceId:province.id,troops:10000,unitType})}><Text style={styles.title}>{u.name} +10K</Text><Text style={styles.text}>${u.cost*10}M · военная технология {u.unlock}</Text></Pressable>;})}</ScrollView>}
    {army?.ownerId===countryId && <ScrollView horizontal contentContainerStyle={styles.row}>{Object.values(state.commanders??{}).filter(g=>g.countryId===countryId).map(g=>{const disabled=state.armies.some(a=>a.commanderId===g.id);return <Pressable key={g.id} accessibilityRole="button" accessibilityLabel={'Полководец '+g.name} accessibilityState={{disabled,selected:army.commanderId===g.id}} disabled={disabled} style={[styles.option,disabled&&styles.disabled]} onPress={()=>onCommand({type:'ASSIGN_COMMANDER',playerId,armyId:army.id,commanderId:g.id})}><View style={{flexDirection:'row',alignItems:'center',gap:10}}><LeaderPortrait seed={portraitSeedFor(g.id)} size={36} label={'Портрет вымышленного полководца: '+g.name}/><Text style={[styles.title,{flex:1}]}>{g.name}</Text></View><Text style={styles.text}>Навык {g.skill} · опыт {g.experience??0}/20 · {army.commanderId===g.id?'Командует':'Назначить'}</Text></Pressable>;})}</ScrollView>}
  </View>;
}
