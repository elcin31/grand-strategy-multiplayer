import {memo} from 'react';
import {Image} from 'react-native';
import {ART_211,type IllustrationId} from '../art/library';
/** Bundled references are cheap; native decoding happens only on mount, at display size. */
export const HistoricalIllustration=memo(function HistoricalIllustration({id,width,height=84,label}:{id:IllustrationId;width?:number;height?:number;label?:string}){return <Image source={ART_211[id]} resizeMode="cover" resizeMethod="resize" fadeDuration={0} accessibilityLabel={label??'Историческая иллюстрация Dominion: '+id} style={{width:width??'100%',height,borderRadius:3}}/>;});
