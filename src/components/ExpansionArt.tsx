import {memo} from 'react';
import {Image,StyleSheet} from 'react-native';
import {EXPANSION_SCENES,type ExpansionSceneName} from '../ui/expansionArt';
// Static Metro references register packaged bytes, not decoded bitmaps. Only
// the active panel mounts an Image; map/camera modules never import this file.
const sources:Record<ExpansionSceneName,number>={
 'diplomacy-embassy':require('../../assets/art/expansion/diplomacy-embassy.webp'),
 'diplomacy-treaty':require('../../assets/art/expansion/diplomacy-treaty.webp'),
 'diplomacy-peace':require('../../assets/art/expansion/diplomacy-peace.webp'),
 'diplomacy-trade':require('../../assets/art/expansion/diplomacy-trade.webp'),
 'diplomacy-summit':require('../../assets/art/expansion/diplomacy-summit.webp'),
 'military-staff':require('../../assets/art/expansion/military-staff.webp'),
 'military-supply':require('../../assets/art/expansion/military-supply.webp'),
 'military-training':require('../../assets/art/expansion/military-training.webp'),
 'military-fortress':require('../../assets/art/expansion/military-fortress.webp'),
 'construction-farm':require('../../assets/art/expansion/construction-farm.webp'),
 'construction-mine':require('../../assets/art/expansion/construction-mine.webp'),
 'construction-factory':require('../../assets/art/expansion/construction-factory.webp'),
 'construction-infrastructure':require('../../assets/art/expansion/construction-infrastructure.webp'),
 'government-council':require('../../assets/art/expansion/government-council.webp'),
 'government-assembly':require('../../assets/art/expansion/government-assembly.webp'),
 'government-administration':require('../../assets/art/expansion/government-administration.webp'),
 'religion-cathedral':require('../../assets/art/expansion/religion-cathedral.webp'),
 'religion-courtyard':require('../../assets/art/expansion/religion-courtyard.webp'),
 'religion-temple':require('../../assets/art/expansion/religion-temple.webp'),
 'theme-espionage':require('../../assets/art/expansion/theme-espionage.webp'),
 'theme-economy':require('../../assets/art/expansion/theme-economy.webp'),
 'theme-ruler':require('../../assets/art/expansion/theme-ruler.webp'),
 'theme-general':require('../../assets/art/expansion/theme-general.webp'),
 'theme-technology':require('../../assets/art/expansion/theme-technology.webp'),
 'theme-focus':require('../../assets/art/expansion/theme-focus.webp'),
 'theme-event':require('../../assets/art/expansion/theme-event.webp'),
 'theme-loading':require('../../assets/art/expansion/theme-loading.webp'),
};
export const ExpansionArt=memo(function ExpansionArt({name,height=84,width,full=false,label}:{name:ExpansionSceneName;height?:number;width?:number;full?:boolean;label?:string}){
 const source=sources[name];
 return <Image key={String(source)} source={source} accessibilityLabel={label??'Иллюстрация Dominion 2.0: '+EXPANSION_SCENES[name].title} resizeMode="cover" fadeDuration={0} style={full?[StyleSheet.absoluteFill,{width:'100%',height:'100%'}]:{width:width??'100%',height}}/>;
});
