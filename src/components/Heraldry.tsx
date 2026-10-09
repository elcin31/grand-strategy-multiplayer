import {memo} from 'react';
import {AtlasArt} from './AtlasArt';
import Svg,{Path} from 'react-native-svg';
import {colors} from '../ui/tokens';
/** Original painted fictional portraits, deterministic across saves/reconnect. */
export const LeaderPortrait=memo(function LeaderPortrait({seed,size=48}:{seed:number;size?:number}){
 return <AtlasArt atlas="rulers" index={seed} width={size} height={size*1.25} label="Портрет вымышленного правителя"/>;
});
export function Crest({color=colors.burgundy,size=28}:{color?:string;size?:number}){return <Svg width={size} height={size} viewBox="0 0 32 32"><Path d="M5 3L27 3L26 19Q24 26 16 30Q8 26 6 19Z" fill={color} stroke={colors.gold}/><Path d="M10 12L22 12M16 7L16 23M10 19L22 8M10 8L22 19" stroke={colors.parchment} strokeWidth="1.5"/></Svg>;}
