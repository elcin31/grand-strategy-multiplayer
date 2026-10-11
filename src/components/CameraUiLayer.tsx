import {memo,useSyncExternalStore} from 'react';
import {Platform,ScrollView,View,type ScrollViewProps,type ViewProps} from 'react-native';
import {getMetrics,subscribeMetrics} from '../performance/telemetry';

const activeCameraLayer=()=>Platform.OS==='android'&&getMetrics().cameraUpdates>0;
const inactiveServerLayer=()=>false;

/** Cache fixed UI chrome only while the existing one-second camera sample
 * reports motion. Native content updates still invalidate its texture normally.
 * Leaf subscriptions keep camera metrics out of campaign/panel render state;
 * the original host View/ScrollView, layout, touches and accessibility remain.
 * Disable the hardware layer after motion so idle GPU memory is released. */
export const CameraLayerView=memo(function CameraLayerView(props:ViewProps){
  const active=useSyncExternalStore(subscribeMetrics,activeCameraLayer,inactiveServerLayer);
  return <View {...props} renderToHardwareTextureAndroid={active}/>;
});

export const CameraLayerScrollView=memo(function CameraLayerScrollView(props:ScrollViewProps){
  const active=useSyncExternalStore(subscribeMetrics,activeCameraLayer,inactiveServerLayer);
  return <ScrollView {...props} renderToHardwareTextureAndroid={active}/>;
});
