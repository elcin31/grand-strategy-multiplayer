import {Pressable,type PressableProps} from 'react-native';
import {audioHub} from '../audio/hub';
/** Native Pressable still owns responder, accessibility and disabled behavior. */
export function AudioPressable(props:PressableProps){return <Pressable {...props} onPress={event=>{try{audioHub.play('ui_click');}catch{}props.onPress?.(event);}}/>;}
