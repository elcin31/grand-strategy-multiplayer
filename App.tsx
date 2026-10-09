import {useRef,useState} from 'react';
import type {ComponentType} from 'react';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {MainMenu} from './src/components/MainMenu';
import {LoadingScreen} from './src/components/HistoricalArt';
import {LaunchAction} from './src/ui/launchAction';
import type {MenuIntent} from './src/ui/menuIntent';
type CampaignProps={intent:MenuIntent;onExit:()=>void;onError:(message:string)=>void};
export default function App(){
 const [Component,setComponent]=useState<ComponentType<CampaignProps>|null>(null);
 const [intent,setIntent]=useState<MenuIntent|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const latch=useRef<LaunchAction|null>(null);
 if(!latch.current)latch.current=new LaunchAction(setBusy,()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
 const start=(next:MenuIntent)=>{void latch.current!.run(async()=>{setError('');try{const module=await import('./CampaignScreen');setIntent(next);setComponent(()=>module.default);}catch(e){setError(e instanceof Error?e.message:String(e));}});};
 const exit=()=>{setIntent(null);setComponent(null);};
 return <GestureHandlerRootView style={{flex:1}}><SafeAreaProvider>{Component&&intent?<Component intent={intent} onExit={exit} onError={message=>{exit();setError(message);}}/>:busy?<LoadingScreen message="Загрузка кампании…"/>:<MainMenu onStart={start} error={error}/>}</SafeAreaProvider></GestureHandlerRootView>;
}
