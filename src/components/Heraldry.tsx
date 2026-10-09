import {memo} from 'react';
import Svg,{Circle,Path,Rect} from 'react-native-svg';
import {colors} from '../ui/tokens';
/** Original procedural miniature. Portrait seeds preserve fictional leader identity. */
export const LeaderPortrait=memo(function LeaderPortrait({seed,size=48}:{seed:number;size?:number}){
 const skin=['#BC9071','#8F664D','#D5AE88','#6E5141'][seed%4],hair=['#29282A','#605043','#A8987F','#302722'][Math.floor(seed/4)%4];
 return <Svg width={size} height={size*1.25} viewBox="0 0 48 60" accessibilityLabel="Портрет вымышленного правителя"><Rect width="48" height="60" fill={colors.inset}/><Circle cx="24" cy="23" r="18" fill="#6F624133"/><Path d="M4 60Q4 42 18 40L30 40Q44 42 44 60Z" fill={seed%2?colors.burgundy:colors.raised}/><Path d="M18 35L18 43L24 49L30 43L30 35" fill={skin}/><Path d="M13 21Q13 10 24 10Q35 10 35 21L33 31Q29 39 24 39Q19 39 15 31Z" fill={skin}/><Path d="M12 23L12 14Q15 5 26 8Q37 10 35 24L31 17Q21 19 18 15L15 24Z" fill={hair}/><Path d="M17 23L21 23M27 23L31 23M23 24L22 29L25 29M20 32Q24 34 28 32" fill="none" stroke="#463C34" strokeWidth="1"/><Path d="M17 43L24 49L31 43M24 49L24 60" fill="none" stroke={colors.gold} strokeWidth="1.5"/><Circle cx="24" cy="54" r="1" fill={colors.gold}/><Rect x=".5" y=".5" width="47" height="59" fill="none" stroke={colors.gold}/></Svg>;
});
export function Crest({color=colors.burgundy,size=28}:{color?:string;size?:number}){return <Svg width={size} height={size} viewBox="0 0 32 32"><Path d="M5 3L27 3L26 19Q24 26 16 30Q8 26 6 19Z" fill={color} stroke={colors.gold}/><Path d="M10 12L22 12M16 7L16 23M10 19L22 8M10 8L22 19" stroke={colors.parchment} strokeWidth="1.5"/></Svg>;}
