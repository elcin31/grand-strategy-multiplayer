import {Pressable,ScrollView,Text} from 'react-native';
import {colors} from '../ui/tokens';
export function PanelTabs({tabs,value,onChange}:{tabs:readonly string[];value:string;onChange:(v:string)=>void}){
 return <ScrollView horizontal nestedScrollEnabled keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:4,paddingVertical:2}}>{tabs.map(tab=><Pressable key={tab} accessibilityRole="tab" accessibilityState={{selected:value===tab}} onPress={()=>onChange(tab)} style={{minHeight:44,minWidth:56,paddingHorizontal:10,justifyContent:'center',borderRadius:4,backgroundColor:value===tab?'#534936':colors.inset,borderBottomWidth:2,borderBottomColor:value===tab?colors.gold:'transparent'}}><Text style={{color:value===tab?colors.parchment:colors.muted,fontSize:12,fontWeight:'600'}}>{tab}</Text></Pressable>)}</ScrollView>;
}
