import {useEffect,useState,type ReactNode} from 'react';
import {Pressable,ScrollView,Text,View,useWindowDimensions} from 'react-native';
import {Gesture,GestureDetector} from 'react-native-gesture-handler';
import Animated,{useAnimatedStyle,useSharedValue} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors} from '../ui/tokens';
/** Only the title owns the pan gesture; content and control buttons do not. */
export function DraggableWindow({title,children,onClose,minimized=false,onRestore,visible=true,scroll=true}:{title:string;children:ReactNode;onClose:()=>void;minimized?:boolean;onRestore?:()=>void;visible?:boolean;scroll?:boolean}){
 const screen=useWindowDimensions(),insets=useSafeAreaInsets(),width=screen.width-insets.left-insets.right,height=screen.height-insets.top-insets.bottom;const [expanded,setExpanded]=useState(false),[compact,setCompact]=useState(false);
 const area={left:56,top:52,right:width-8,bottom:height-8};
 const w=Math.max(200,Math.min(expanded?width-72:720,width-72)),h=compact||minimized?44:Math.max(140,(height-68)*(expanded?1:.86));
 const x=useSharedValue(area.left+(area.right-area.left-w)/2),y=useSharedValue(area.top+(area.bottom-area.top-h)/2),startX=useSharedValue(0),startY=useSharedValue(0);
 useEffect(()=>{x.value=Math.max(area.left,Math.min(area.right-w,x.value));y.value=Math.max(area.top,Math.min(area.bottom-h,y.value));},[width,height,w,h]);
 const pan=Gesture.Pan().minDistance(5).onBegin(()=>{startX.value=x.value;startY.value=y.value;}).onUpdate(e=>{x.value=Math.max(area.left,Math.min(area.right-w,startX.value+e.translationX));y.value=Math.max(area.top,Math.min(area.bottom-h,startY.value+e.translationY));});
 const style=useAnimatedStyle(()=>({transform:[{translateX:x.value},{translateY:y.value}]}));
 const control=(label:string,text:string,action:()=>void)=><Pressable accessibilityRole="button" accessibilityLabel={label} style={{width:44,height:44,alignItems:'center',justifyContent:'center'}} onPress={action}><Text style={{color:colors.gold,fontSize:18}}>{text}</Text></Pressable>;
 return <Animated.View pointerEvents={visible?'auto':'none'} style={[{display:visible?'flex':'none',position:'absolute',left:0,top:0,width:w,height:h,zIndex:25,backgroundColor:'#101d2bFA',borderWidth:1,borderColor:colors.gold,borderRadius:6,overflow:'hidden',elevation:8},style]}>
  <View style={{height:44,flexDirection:'row',alignItems:'center',backgroundColor:colors.surface,borderBottomWidth:1,borderBottomColor:colors.border}}>
   <GestureDetector gesture={pan}><View style={{flex:1,height:44,justifyContent:'center',paddingHorizontal:12}}><Text numberOfLines={1} style={{color:colors.parchment,fontSize:14,fontWeight:'700'}}>⠿ {title}</Text></View></GestureDetector>
   {minimized?control('Вернуться к окну','↗',()=>onRestore?.()):control(compact?'Развернуть окно':'Свернуть окно',compact?'▾':'−',()=>setCompact(v=>!v))}
   {control(expanded?'Обычный размер окна':'Увеличить окно','□',()=>{setCompact(false);setExpanded(v=>!v);})}
   {control('Закрыть окно','×',onClose)}
  </View>
  <View style={{flex:1,display:compact||minimized?'none':'flex'}}>{scroll?<ScrollView nestedScrollEnabled keyboardShouldPersistTaps="always" contentContainerStyle={{padding:8,gap:8}}>{children}</ScrollView>:children}</View>
 </Animated.View>;
}
