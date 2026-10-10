import {useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import type {GameCommand,GameState} from '../types/game';
import {styles} from './strategyStyles';
import {TechnologyTreePanel} from './TechnologyTreePanel';
export {styles} from './strategyStyles';
export interface StrategyProps {initialOpen?:boolean;state:GameState;playerId:string;onCommand:(command:GameCommand)=>void}
export function StrategyPanel(props:StrategyProps){
  const [open,setOpen]=useState(props.initialOpen??false);
  const countryId=props.state.players.find(p=>p.id===props.playerId)?.countryId;
  if(!props.state.dataset||!countryId)return null;
  return <View style={styles.wrap}><Pressable accessibilityRole="button" accessibilityState={{expanded:open}} style={styles.button} onPress={()=>setOpen(!open)}><Text style={styles.title}>Технологии {open?'▴':'▾'}</Text></Pressable>{open&&<TechnologyTreePanel {...props}/>}</View>;
}
