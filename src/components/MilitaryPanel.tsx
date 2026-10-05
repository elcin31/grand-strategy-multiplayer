import { Pressable, ScrollView, Text, View } from 'react-native';
import type { Army, Province } from '../types/game';
import { UNITS, UNIT_TYPES } from '../../supabase/functions/_shared/militarySystem';
import { techLevel } from '../../supabase/functions/_shared/technologySystem';
import { styles, type StrategyProps } from './StrategyPanel';
export function MilitaryPanel({state,playerId,onCommand,province,army}: StrategyProps & {province:Province;army:Army|null}) {
  const countryId=state.players.find(p=>p.id===playerId)?.countryId;
  if(!state.dataset || !countryId)return null;
  const c=state.countries[countryId]!;
  const own=!province.rebellion && province.ownerId===countryId && (province.controllerId??province.ownerId)===countryId;
  return <View style={styles.wrap}>
    <Text style={styles.text}>Рельеф: {province.terrain} · {army ? `${UNITS[army.unitType??'Infantry'].name} · мораль ${army.morale?.toFixed(0)} · организация ${army.organization?.toFixed(0)}` : 'Выберите свою армию ниже'}</Text>
    {army&&<Text style={styles.text}>Командир: {army.commanderId?state.commanders?.[army.commanderId]?.name:'Не назначен'} · {army.troops.toLocaleString()} солдат. Приказ: удерживать провинцию. Перемещение в соседнюю провинцию выполняется сразу после подтверждения команды.</Text>}
    {own && <ScrollView horizontal contentContainerStyle={styles.row}>{UNIT_TYPES.map(unitType=>{const u=UNITS[unitType],disabled=techLevel(c,'Military')<u.unlock || c.treasury<u.cost*10 || c.manpower<10000 || state.tick<(c.bankruptcyUntilTick??0);return <Pressable accessibilityRole="button" key={unitType} disabled={disabled} style={[styles.option,disabled&&styles.disabled]} onPress={()=>onCommand({type:'RECRUIT_UNIT',playerId,provinceId:province.id,troops:10000,unitType})}><Text style={styles.title}>{u.name} +10K</Text><Text style={styles.text}>${u.cost*10}M · военная технология {u.unlock}</Text></Pressable>;})}</ScrollView>}
    {army?.ownerId===countryId && <ScrollView horizontal contentContainerStyle={styles.row}>{Object.values(state.commanders??{}).filter(g=>g.countryId===countryId).map(g=>{const disabled=state.armies.some(a=>a.commanderId===g.id);return <Pressable key={g.id} accessibilityRole="button" disabled={disabled} style={[styles.option,disabled&&styles.disabled]} onPress={()=>onCommand({type:'ASSIGN_COMMANDER',playerId,armyId:army.id,commanderId:g.id})}><Text style={styles.title}>{g.name}</Text><Text style={styles.text}>Навык {g.skill} · {army.commanderId===g.id?'Командует':'Назначить'}</Text></Pressable>;})}</ScrollView>}
  </View>;
}
