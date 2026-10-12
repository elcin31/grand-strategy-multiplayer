import {useEffect} from 'react';
import {View} from 'react-native';
import Animated,{cancelAnimation,useAnimatedStyle,useSharedValue,withTiming} from 'react-native-reanimated';
import type {GameState} from '../types/game';
import {dayDelay} from '../../supabase/functions/_shared/calendarSystem';
import {colors} from '../ui/tokens';
/** A visual day sweep; calendar calculations remain entirely authoritative. */
export function CalendarProgress({state}:{state:GameState}){const progress=useSharedValue(0);useEffect(()=>{cancelAnimation(progress);if(state.phase==='running'&&state.speed){progress.value=0;progress.value=withTiming(1,{duration:dayDelay(state.speed)});}return()=>cancelAnimation(progress);},[state.simulationDay,state.phase,state.speed,progress]);const style=useAnimatedStyle(()=>({width:62*progress.value}));return <View style={{height:2,width:62,marginTop:3,backgroundColor:colors.raised}}><Animated.View style={[{height:2,backgroundColor:colors.gold},style]}/></View>;}
