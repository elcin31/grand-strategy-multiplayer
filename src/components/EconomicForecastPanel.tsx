import {memo,useMemo} from 'react';
import {Text,View} from 'react-native';
import {AudioPressable as Pressable} from './AudioPressable';
import {economicForecast} from '../../supabase/functions/_shared/economicForecast';
import {RESOURCES} from '../../supabase/functions/_shared/resourceCatalogue';
import type {StrategyProps} from './StrategyPanel';
import {styles} from './strategyStyles';
export const EconomicForecastPanel=memo(function EconomicForecastPanel({state,playerId,onCommand}:StrategyProps){
 const id=state.players.find(p=>p.id===playerId)?.countryId;
 const forecast=useMemo(()=>id?economicForecast(state,id):null,[state,id]);
 if(!id||!forecast)return null;const c=state.countries[id]!;
 const risks=[...forecast.resources].sort((a,b)=>Number(b.importDependency>0)-Number(a.importDependency>0)||(a.monthsRemaining??Infinity)-(b.monthsRemaining??Infinity)).slice(0,8);
 return <View style={styles.card}>
  <Text style={styles.title}>ПРОГНОЗ · 6 МЕСЯЦЕВ</Text><Text style={styles.text}>Оценка при сохранении текущих условий. Баланс {forecast.monthlyBalance.toFixed(2)} млн/мес.; содержание армии {forecast.armyMaintenance.toFixed(2)} млн/мес.</Text>
  {forecast.timeline.map(row=><Text key={row.month} style={styles.text}>Через {row.month} мес. · казна ≈ {row.treasury.toFixed(1)} млн · баланс ≈ {row.balance.toFixed(1)} млн</Text>)}
  <Text style={styles.text}>Стройки уже оплачены: {forecast.prepaidConstruction.toFixed(1)} млн. Новое содержание добавляется после предполагаемого завершения.</Text>
  {!!risks.length&&<Text style={styles.title}>ЗАПАСЫ И ЗАВИСИМОСТЬ ОТ ПОСТАВОК</Text>}
  {risks.map(row=><Text key={row.resource} style={styles.text}>{RESOURCES[row.resource].name}: {row.reserve.toFixed(1)} · поток {row.net>=0?'+':''}{row.net.toFixed(1)}/мес.{row.monthsRemaining!==null?` · запас ≈ ${row.monthsRemaining.toFixed(1)} мес.`:''}{row.importDependency>0?` · импорт ${(row.importDependency*100).toFixed(0)}%${row.monthsWithoutImports!==null?`, без него ≈ ${row.monthsWithoutImports.toFixed(1)} мес.`:''}`:''}</Text>)}
  <Text style={styles.text}>{forecast.assumptions.join(' ')}</Text>
  <Pressable accessibilityRole="checkbox" accessibilityLabel="Автоматическое строительство" accessibilityState={{checked:!!c.stockpile?.autoBuild}} style={styles.button} onPress={()=>onCommand({type:'SET_CONSTRUCTION_AUTOMATION',playerId,enabled:!c.stockpile?.autoBuild})}><Text style={styles.title}>{c.stockpile?.autoBuild?'☑':'□'} Автоматическое строительство</Text></Pressable>
  <Text style={styles.text}>Не более одного нового проекта за месяц: реальные цены, материалы и запас казны на содержание. Можно отключить в любой момент.</Text>
 </View>;
});
