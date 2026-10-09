import {colors,tokens} from './src/ui/tokens';
import {traceStartup} from './src/performance/startupTrace';
import {recordMetrics} from './src/performance/telemetry';
import {LaunchAction} from './src/ui/launchAction';
import {LandscapeHUD} from './src/components/LandscapeHUD';
import {SECTIONS,SECTION_LABELS,panelWidth,backAction,type Section} from './src/ui/landscape';
import { campaignStore } from './src/persistence/nativeCampaignStore';
import { useCallback, useMemo, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, BackHandler, Keyboard, LayoutAnimation, useWindowDimensions, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CountryPicker } from './src/components/CountryPicker';
import { CountryPanel } from './src/components/CountryPanel';
import { GamePanel } from './src/components/GamePanel';
import { LobbyPanel } from './src/components/LobbyPanel';
import { WorldMap } from './src/components/DeferredWorldMap';
import { LocalTransport } from './src/multiplayer/localTransport';
import { HttpTransport } from './src/multiplayer/httpTransport';
import type { MultiplayerTransport, TransportSession } from './src/multiplayer/transport';
import { CountryId, GameCommand, GameState, Province } from './src/types/game';

const productionMultiplayerUrl = 'https://dfjsnjxnyjspwugjguhq.supabase.co/functions/v1';
const remoteUrl = process.env.EXPO_PUBLIC_MULTIPLAYER_URL?.trim() || productionMultiplayerUrl;


import type {MenuIntent} from './src/ui/menuIntent';
import {LoadingScreen} from './src/components/HistoricalArt';

export default function CampaignScreen({intent,onExit,onError}:{intent:MenuIntent;onExit:()=>void;onError:(message:string)=>void}) {return <GameApp intent={intent} onExit={onExit} onError={onError}/>;}

function GameApp({intent,onExit,onError}:{intent:MenuIntent;onExit:()=>void;onError:(message:string)=>void}) {
  const {width}=useWindowDimensions();
  const [launchBusy,setLaunchBusy]=useState(false);
  const launchTapAt=useRef(0);
  const launch=useRef<LaunchAction|null>(null);
  if(!launch.current)launch.current=new LaunchAction(busy=>{if(busy){launchTapAt.current=performance.now();traceStartup("tap");}setLaunchBusy(busy);},()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))),ms=>{traceStartup("loading painted / handler starts");recordMetrics({tapToActionMs:ms});});
  const [section,setSection]=useState<Section>('Country');
  const [mapMenuOpen,setMapMenuOpen]=useState(false);
  const [saveStatus,setSaveStatus]=useState('');
  const latestState=useRef<GameState|null>(null);
  const [connectionStatus,setConnectionStatus]=useState('');

  const [transport, setTransport] = useState<MultiplayerTransport>(() => new HttpTransport(remoteUrl));
  const [state, setState] = useState<GameState | null>(null);
  latestState.current=state;
  useEffect(()=>{if(state&&launchTapAt.current){traceStartup("campaign screen committed");recordMetrics({tapToScreenMs:performance.now()-launchTapAt.current});launchTapAt.current=0;}},[state?.id,state?.phase]);
  useEffect(()=>{if(!(transport instanceof LocalTransport)||!state)return;let busy=false,pending=false,lastSaved:GameState|null=null;const save=()=>{const current=latestState.current;if(!current||current.id!==state.id||current===lastSaved)return;if(busy){pending=true;return;}busy=true;void campaignStore.save(current).then(()=>{lastSaved=current;setSaveStatus('Автосохранено');}).catch(e=>setSaveStatus(e.message)).finally(()=>{busy=false;if(pending){pending=false;save();}});};const timer=setInterval(save,10000);const sub=AppState.addEventListener('change',status=>{if(status!=='active')save();});return()=>{clearInterval(timer);sub.remove();};},[state?.id,transport]);
  const [previewCountryId, setPreviewCountryId] = useState<CountryId | null>(null);
  const [selectedArmyId,setSelectedArmyId]=useState<string|null>(null);
  const [selectedCityId,setSelectedCityId]=useState<string|null>(null);
  const [selectedProvinceId, setSelectedProvinceId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [focusCountryId, setFocusCountryId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const unsubscribeRef = useRef<null | (() => void)>(null);

  useEffect(() => () => unsubscribeRef.current?.(), []);

  const attach = (session: TransportSession, source: MultiplayerTransport = transport) => {
    setTransport(source);
    unsubscribeRef.current?.();
    setPlayerId(session.playerId);
    setState(session.state);
    setSelectedProvinceId(null);
    setSelectedArmyId(null);setSelectedCityId(null);setMapMenuOpen(false);
    setPreviewCountryId(null);
    setFocusCountryId(null);
    setPanelOpen(true);
    setSection('Country');
    setConnectionStatus('');
    unsubscribeRef.current = source.subscribe(session.state.id, setState, setConnectionStatus);
  };

  const selectedCountryId = previewCountryId ?? state?.selectedCountryId ?? null;
  const selectedCountry = state && selectedCountryId ? state.countries[selectedCountryId] ?? null : null;
  const selectedProvinces = useMemo(()=>state?.phase==='lobby' && selectedCountryId ? state.provinces.filter((province) => province.ownerId === selectedCountryId) : [],[state?.phase,state?.provinces,selectedCountryId]);

  const safeAction = async (action: () => Promise<void>) => {
    try { await action(); }
    catch (error) { Alert.alert('Действие отклонено', error instanceof Error ? error.message : 'Неизвестная ошибка'); }
  };


  const chooseCountry = () => {
    if (!state || !selectedCountryId || !playerId) return;
    safeAction(() => transport.sendCommand(state.id, { type: 'SELECT_COUNTRY', playerId, countryId: selectedCountryId }));
  };

  const sendCommand = (command: GameCommand) => {
    if (!state) return;
    void safeAction(() => transport.sendCommand(state.id, command));
  };

  const myCountryId = state?.players.find((player) => player.id === playerId)?.countryId ?? null;
  const gameStarted = Boolean(state && (state.phase === 'running' || state.phase === 'paused' || state.phase === 'finished'));

  const selectProvince = useCallback((province: Province) => {
    const current=latestState.current;const army=current?.armies.find(a=>a.id===selectedArmyId);
    if(gameStarted&&army&&army.ownerId===myCountryId&&playerId&&current){
      void safeAction(()=>transport.sendCommand(current.id,{type:'ORDER_ARMY',playerId,armyId:army.id,provinceId:province.id}));return;
    }
    setSelectedArmyId(null);setSelectedCityId(null);
    if (gameStarted) { setSelectedProvinceId(province.id); setSection('Context'); setPanelOpen(true); }
    else setPreviewCountryId(province.ownerId);
  },[gameStarted,selectedArmyId,myCountryId,playerId,transport]);
  const selectArmy=useCallback((id:string,province:string)=>{setSelectedArmyId(id);setSelectedCityId(null);setSelectedProvinceId(province);setSection('Context');setPanelOpen(true);},[]);
  const selectCity=useCallback((id:string,province:string)=>{setSelectedCityId(id);setSelectedArmyId(null);setSelectedProvinceId(province);setSection('Context');setPanelOpen(true);},[]);

  useEffect(() => { if (gameStarted) setPanelOpen(false); }, [gameStarted]);
  const exitCampaign=()=>void safeAction(async()=>{if(!state)return;if(transport instanceof LocalTransport)await campaignStore.save(state);await transport.leave(state.id);unsubscribeRef.current?.();setState(null);setPlayerId(null);setSelectedProvinceId(null);setPreviewCountryId(null);onExit();});
  const confirmExit=()=>Alert.alert('Выйти из кампании?',transport instanceof LocalTransport?'Прогресс будет сохранён.':'К кампании можно вернуться через список сохранённых сессий.',[{text:'Остаться',style:'cancel'},{text:'Выйти',onPress:exitCampaign}]);
  useEffect(()=>{const handler=BackHandler.addEventListener('hardwareBackPress',()=>{const action=backAction({keyboard:Keyboard.isVisible(),modal:mapMenuOpen,context:!!selectedProvinceId&&panelOpen,panel:panelOpen,campaign:!!state});if(action==='keyboard')Keyboard.dismiss();else if(action==='modal')setMapMenuOpen(false);else if(action==='context'){setSelectedProvinceId(null);setSection('Country');setPanelOpen(false);}else if(action==='panel')setPanelOpen(false);else if(action==='confirm')confirmExit();else return false;return true;});return()=>handler.remove();},[mapMenuOpen,panelOpen,state,selectedProvinceId,transport]);

  useEffect(() => {
    if (transport instanceof HttpTransport || !state || !playerId || state.phase !== 'running' || state.speed === 0) return;
    const me = state.players.find((player) => player.id === playerId);
    if (!me?.isHost) return;

    let disposed = false;
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const delay = Math.max(650, 2600 / state.speed);
    const advance = async () => {
      if (disposed || inFlight) return;
      inFlight = true;
      try { await transport.sendCommand(state.id, { type: 'ADVANCE_TICK' }); }
      catch { /* A transient authoritative conflict must not create a request pile-up. */ }
      finally {
        inFlight = false;
        if (!disposed) timer = setTimeout(() => { void advance(); }, delay);
      }
    };
    timer = setTimeout(() => { void advance(); }, delay);
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
    };
  }, [state?.id, state?.phase, state?.speed, playerId, transport]);

  useEffect(()=>{const a=state?.armies.find(a=>a.id===selectedArmyId);if(a)setSelectedProvinceId(a.provinceId);},[state?.armies,selectedArmyId]);

  const initialized=useRef(false);
  useEffect(()=>{if(initialized.current)return;initialized.current=true;
    void launch.current!.run(async()=>{
      try {
        if(intent.type==='offline'){const local=new LocalTransport();attach(await local.createRoom('Игрок 1'),local);}
        else if(intent.type==='load'){const local=new LocalTransport();attach(await local.restore(await campaignStore.load(intent.id)),local);}
        else {const remote=new HttpTransport(remoteUrl);const session=intent.type==='reconnect'?await remote.reconnect(intent.id):intent.type==='create'?await remote.createRoom(intent.name):await remote.joinRoom(intent.code,intent.name);attach(session,remote);}
      } catch(error){onError(error instanceof Error?error.message:String(error));}
    });
  },[]);
  if(!state)return <LoadingScreen message="Загрузка кампании…"/>;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.content}>
        {launchBusy&&<View accessibilityRole="alert" style={{position:"absolute",top:0,bottom:0,left:0,right:0,zIndex:100,backgroundColor:"#101f2b",justifyContent:"center",alignItems:"center"}}><ActivityIndicator size="large" color={colors.gold}/><Text style={styles.exitText}>Запуск кампании…</Text></View>}
        <View style={styles.topbar}>
          <View style={{maxWidth:gameStarted?115:220}}>
            <Text style={[styles.brand,gameStarted&&{fontSize:15}]}>DOMINION</Text>
            <Text style={styles.subbrand}>{gameStarted ? `Ход ${state.tick} · ${state.phase === 'finished' ? 'КАМПАНИЯ ЗАВЕРШЕНА' : 'КАМПАНИЯ'}` : `Комната ${state.roomCode}`}</Text>
          </View>
          {selectedArmyId&&<Pressable accessibilityRole="button" style={styles.exitButton} onPress={()=>setSelectedArmyId(null)}><Text style={styles.exitText}>СНЯТЬ ВЫБОР АРМИИ</Text></Pressable>}
          {gameStarted&&<LandscapeHUD state={state} playerId={playerId??''} onCommand={sendCommand}/> }
          {!gameStarted && <CountryPicker state={state} onPreview={id => { setPreviewCountryId(id); setFocusCountryId(id); setPanelOpen(true); }} />}
          <Pressable style={styles.exitButton} onPress={() => setPanelOpen(!panelOpen)}><Text style={styles.exitText}>{panelOpen ? "ЗАКРЫТЬ ПАНЕЛЬ" : "УПРАВЛЕНИЕ"}</Text></Pressable>
          {transport instanceof LocalTransport&&<Pressable accessibilityLabel="Сохранить кампанию" style={styles.exitButton} onPress={()=>void safeAction(async()=>{await campaignStore.save(state);setSaveStatus('Сохранено');})}><Text style={styles.exitText}>СОХРАНИТЬ</Text></Pressable>}
          <Pressable style={styles.exitButton} onPress={confirmExit}><Text style={styles.exitText}>ВЫЙТИ</Text></Pressable>
        </View>

        {transport instanceof LocalTransport&&saveStatus!==''&&<Text style={{color:colors.muted,fontSize:10}}>{saveStatus}</Text>}
        {connectionStatus!==''&&<Text style={{color:"#ffcf85",padding:6}}>{connectionStatus}</Text>}
        <View style={styles.mapArea}><WorldMap
          state={state}
          settingsOpen={mapMenuOpen}
          onSettingsChange={setMapMenuOpen}
          focusCountryId={focusCountryId}
          selectedCountryId={gameStarted?myCountryId:selectedCountryId}
          selectedProvinceId={selectedProvinceId}
          selectedArmyId={selectedArmyId} selectedCityId={selectedCityId}
          onSelectArmy={!gameStarted?undefined:selectArmy}
          onSelectCity={!gameStarted?undefined:selectCity}
          onSelectProvince={selectProvince}
          onLongPressProvince={selectProvince}
        /></View>

        {gameStarted&&<ScrollView horizontal style={styles.navigation} contentContainerStyle={{gap:4,flexGrow:1}} showsHorizontalScrollIndicator={false}>{SECTIONS.map(tab=><Pressable key={tab} accessibilityLabel={`Раздел ${SECTION_LABELS[tab]}`} accessibilityRole="button" accessibilityState={{selected:panelOpen&&section===tab}} style={[styles.navButton,panelOpen&&section===tab&&{backgroundColor:colors.burgundy}]} onPress={()=>{LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);setSection(tab);setPanelOpen(true);}}><Text style={styles.exitText}>{SECTION_LABELS[tab]}</Text></Pressable>)}</ScrollView>}
        {panelOpen && <ScrollView key={section} keyboardShouldPersistTaps="handled" style={[styles.panel,{width:panelWidth(width),bottom:gameStarted?54:154}]} contentContainerStyle={styles.panelContent}>

        {!gameStarted && (
          <CountryPanel
            country={selectedCountry}
            leader={selectedCountry?.rulerId ? state.leaders?.[selectedCountry.rulerId] ?? null : null}
            provinces={selectedProvinces}
            locked={Boolean(selectedCountryId && myCountryId === selectedCountryId)}
            onChoose={chooseCountry}
          />
        )}

        {gameStarted && (
          <GamePanel focusedArmyId={selectedArmyId} focusedCityId={selectedCityId} key={section} section={section} onFocusProvince={id=>{setSelectedArmyId(state.armies.find(a=>a.provinceId===id&&a.ownerId===myCountryId)?.id??null);setSelectedProvinceId(id);setSection('Context');setFocusCountryId(myCountryId);}}
            state={state}
            playerId={playerId ?? ''}
            selectedProvinceId={selectedProvinceId}
            onCommand={sendCommand}
          />
        )}
        </ScrollView>}
        {!gameStarted && <View style={styles.lobbyDock}>
          <LobbyPanel
            busy={launchBusy}
            state={state}
            playerId={playerId ?? ''}
            onReady={(ready) => playerId && safeAction(() => transport.sendCommand(state.id, { type: 'SET_READY', playerId, ready }))}
            onStart={() => playerId && safeAction(async () => {await launch.current!.run(()=>transport.sendCommand(state.id, { type: 'START_GAME', playerId }));})}
          />
        </View>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.graphite },
  entryWrap: { flexGrow: 1, justifyContent: 'center', padding: 18, gap: 12, maxWidth: 600, width: '100%', alignSelf: 'center' },
  content: { flex: 1 },
  mapArea: { flex: 1 },
  navigation:{position:'absolute',left:8,right:8,bottom:4,height:46,backgroundColor:'#101B26F5',borderRadius:tokens.radius.panel},
  navButton:{flex:1,minWidth:90,minHeight:44,paddingHorizontal:12,alignItems:'center',justifyContent:'center',borderRadius:9},
  lobbyDock: {position:'absolute',left:8,right:8,bottom:8},
  panel: { position: 'absolute', right: 8, top: 62, bottom: 12, width: '34%', maxWidth: 410, minWidth: 250, backgroundColor: '#17222DF5', borderWidth:1,borderColor:colors.border, borderRadius:tokens.radius.panel },
  panelContent: { padding: 8, gap: 10 },
  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, gap: 8 },
  brand: { fontFamily:tokens.typography.display, color:colors.parchment, fontSize: 22, fontWeight: '900', letterSpacing: 2.2 },
  tagline: { color: '#61718A', fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 5 },
  subbrand: { fontFamily:tokens.typography.display, color:colors.muted, fontSize: 11, marginTop: 2 },
  footer: { color: '#46546A', textAlign: 'center', fontSize: 10, letterSpacing: 0.4 },
  exitButton: { backgroundColor:colors.surface, borderRadius:tokens.radius.panel, paddingHorizontal: 13, paddingVertical: 9, minHeight:44,justifyContent:'center' },
  exitText: { color: colors.muted, fontWeight: '900', fontSize: 10 },
});
