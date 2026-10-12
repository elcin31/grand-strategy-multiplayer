import {HistoricalIllustration} from './HistoricalIllustration';
import {eventScene} from '../art/curation';
import {AudioPressable as Pressable} from './AudioPressable';
import {Text, View} from 'react-native';
import type {GameCommand,GameState} from '../types/game';
import {NOTIFICATION_CATEGORIES,type NotificationCategory} from '../../supabase/functions/_shared/notificationSystem';
import {styles} from './strategyStyles';
export function NotificationFeed({state,playerId,onCommand,onFocus}:{state:GameState;playerId:string;onCommand:(c:GameCommand)=>void;onFocus:(id:string)=>void}){
 const c=state.countries[state.players.find(p=>p.id===playerId)?.countryId??''];if(!c)return null;
 const rows=(state.notifications??[]).filter(n=>n.countryId===c.id);
 return <View style={styles.wrap}><Text style={styles.title}>ДОНЕСЕНИЯ</Text><Pressable accessibilityRole="button" style={styles.button} onPress={()=>onCommand({type:'ACK_NOTIFICATIONS',playerId})}><Text style={styles.text}>Отметить прочитанными</Text></Pressable>
 <Text style={styles.text}>Автопауза при событиях (общая для сетевой комнаты)</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:4}}>{(Object.keys(NOTIFICATION_CATEGORIES) as NotificationCategory[]).map(category=>{const selected=c.autoPause?.includes(category);return <Pressable accessibilityRole="checkbox" accessibilityState={{checked:!!selected}} key={category} style={styles.button} onPress={()=>onCommand({type:'SET_AUTOPAUSE',playerId,categories:selected?(c.autoPause??[]).filter(x=>x!==category):[...c.autoPause??[],category]})}><Text style={styles.text}>{selected?'☑':'□'} {NOTIFICATION_CATEGORIES[category]}</Text></Pressable>;})}</View>
 {!rows.length&&<Text style={styles.text}>Новые события появятся здесь.</Text>}{rows.slice(0,40).map(n=><Pressable key={n.id} style={styles.card} disabled={!n.provinceId} onPress={()=>n.provinceId&&onFocus(n.provinceId)}><HistoricalIllustration id={eventScene(n.category,n.message)} height={58}/><Text style={styles.title}>{n.id>(c.notificationReadThrough??0)?'● ':''}{NOTIFICATION_CATEGORIES[n.category]}</Text><Text style={styles.text}>{n.message}</Text></Pressable>)}</View>;
}
