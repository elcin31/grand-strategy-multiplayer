import {memo} from 'react';
import {Text,View} from 'react-native';
import {AudioPressable as Pressable} from './AudioPressable';
import {HistoricalIllustration} from './HistoricalIllustration';
import type {StrategyProps} from './StrategyPanel';
import type {IllustrationId} from '../art/library';
import {styles} from './strategyStyles';
import {eventDefinition} from '../../supabase/functions/_shared/eventCatalogue';
import {eventEffectDescription,eventOptionReason} from '../../supabase/functions/_shared/eventSystem';
import {RESOURCES} from '../../supabase/functions/_shared/resourceCatalogue';
import type {EventOption} from '../../supabase/functions/_shared/eventTypes';

const scenes:Record<string,IllustrationId>={Economy:'e08-market',Diplomacy:'d01-envoys',Reform:'g03-administration',Recovery:'e18-hospital'};
function costText(option:EventOption):string{
 const values:string[]=[];
 if(option.cost?.treasury)values.push(`${option.cost.treasury} млн`);
 if(option.cost?.politicalPower)values.push(`${option.cost.politicalPower} PP`);
 for(const [id,n] of Object.entries(option.cost?.resources??{}))values.push(`${RESOURCES[id as keyof typeof RESOURCES].name}: ${n}`);
 return values.length?'Затраты: '+values.join(' · '):'';
}
/** Mounted only in an open game window. It has no camera subscription or timer. */
export const GameEventsPanel=memo(function GameEventsPanel({state,playerId,onCommand}:StrategyProps){
 const countryId=state.players.find(p=>p.id===playerId)?.countryId;if(!countryId)return null;
 const pending=state.events?.pending.filter(e=>e.countryId===countryId)??[];
 const history=state.events?.history.filter(e=>e.countryId===countryId).slice(0,8)??[];
 return <View style={styles.card}>
  <Text style={styles.title}>СОБЫТИЯ ГОСУДАРСТВА</Text>
  {!pending.length&&<Text style={styles.text}>Сейчас нет событий, требующих решения. Новые события зависят от состояния государства.</Text>}
  {pending.map(instance=>{const definition=eventDefinition(instance.eventId);if(!definition)return null;
   return <View key={instance.id} style={styles.card}>
    <HistoricalIllustration id={scenes[definition.illustration]!} height={100} label={definition.title}/>
    <Text style={styles.title}>{definition.title}</Text><Text style={styles.text}>{definition.description}</Text>
    {instance.counterpartId&&<Text style={styles.text}>Участник: {state.countries[instance.counterpartId]?.name}</Text>}
    <Text style={styles.text}>Решение в течение {Math.max(0,instance.deadlineTick-state.tick)} мес. Без ответа: {definition.options.find(o=>o.id===definition.fallbackChoiceId)?.title}.</Text>
    {definition.options.map(option=>{const reason=eventOptionReason(state,instance,option.id),cost=costText(option);
     return <View key={option.id} style={styles.card}><Text style={styles.title}>{option.title}</Text><Text style={styles.text}>{option.description}</Text>
      {!!cost&&<Text style={styles.text}>{cost}</Text>}
      <Text style={styles.text}>{option.effects.map(eventEffectDescription).join(' · ')}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={option.title} accessibilityState={{disabled:!!reason}} disabled={!!reason} style={[styles.button,!!reason&&styles.disabled]} onPress={()=>onCommand({type:'RESOLVE_GAME_EVENT',playerId,eventId:instance.id,choiceId:option.id})}><Text style={styles.text}>{reason??'Принять решение'}</Text></Pressable>
     </View>;
    })}
   </View>;
  })}
  {!!history.length&&<Text style={styles.title}>НЕДАВНИЕ РЕШЕНИЯ</Text>}
  {history.map(entry=>{const definition=eventDefinition(entry.eventId);return <Text key={entry.id} style={styles.text}>{definition?.title}: {definition?.options.find(o=>o.id===entry.choiceId)?.title}{entry.automatic?' · решение по расписанию':''}</Text>;})}
 </View>;
});
