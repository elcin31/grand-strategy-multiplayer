import {LandscapeHUD} from './src/components/LandscapeHUD';
import {SECTIONS,SECTION_LABELS,panelWidth,backAction,type Section} from './src/ui/landscape';
import { campaignStore } from './src/persistence/nativeCampaignStore';
import type { CampaignEntry } from './src/persistence/campaignStore';
import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, BackHandler, Keyboard, LayoutAnimation, useWindowDimensions, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { CountryPicker } from './src/components/CountryPicker';
import { CountryPanel } from './src/components/CountryPanel';
import { GamePanel } from './src/components/GamePanel';
import { EntryPanel, LobbyPanel } from './src/components/LobbyPanel';
import { WorldMap } from './src/components/WorldMap';
import { LocalTransport } from './src/multiplayer/localTransport';
import { HttpTransport, type RemoteSession } from './src/multiplayer/httpTransport';
import type { MultiplayerTransport, TransportSession } from './src/multiplayer/transport';
import { CountryId, GameCommand, GameState, Province } from './src/types/game';

const productionMultiplayerUrl = 'https://dfjsnjxnyjspwugjguhq.supabase.co/functions/v1';
const remoteUrl = process.env.EXPO_PUBLIC_MULTIPLAYER_URL?.trim() || productionMultiplayerUrl;


export default function App() {
  return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider><GameApp /></SafeAreaProvider></GestureHandlerRootView>;
}

function GameApp() {
  const {width}=useWindowDimensions();
  const [section,setSection]=useState<Section>('Country');
  const [mapMenuOpen,setMapMenuOpen]=useState(false);
  const [savedCampaigns,setSavedCampaigns]=useState<CampaignEntry[]>([]);
  const [saveStatus,setSaveStatus]=useState('');
  const latestState=useRef<GameState|null>(null);
  const [savedRooms,setSavedRooms]=useState<RemoteSession[]>([]);
  const [connectionStatus,setConnectionStatus]=useState('');

  const [transport, setTransport] = useState<MultiplayerTransport>(() => new HttpTransport(remoteUrl));
  const [state, setState] = useState<GameState | null>(null);
  latestState.current=state;
  useEffect(()=>{if(!state)void campaignStore.list().then(setSavedCampaigns).catch(()=>setSaveStatus('Ошибка чтения списка кампаний'));},[state?.id]);
  useEffect(()=>{if(!(transport instanceof LocalTransport)||!state)return;const save=()=>{const current=latestState.current;if(current)void campaignStore.save(current).then(()=>setSaveStatus('Автосохранено')).catch(e=>setSaveStatus(e.message));};const timer=setInterval(save,10000);const sub=AppState.addEventListener('change',status=>{if(status!=='active')save();});return()=>{clearInterval(timer);sub.remove();};},[state?.id,transport]);
  useEffect(()=>{if(!state)void new HttpTransport(remoteUrl).savedSessions().then(setSavedRooms).catch(()=>setConnectionStatus('Не удалось прочитать сохранённые сессии'));},[state?.id]);
  const [previewCountryId, setPreviewCountryId] = useState<CountryId | null>(null);
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
    setPreviewCountryId(null);
    setFocusCountryId(null);
    setPanelOpen(true);
    setSection('Country');
    setConnectionStatus('');
    unsubscribeRef.current = source.subscribe(session.state.id, setState, setConnectionStatus);
  };

  const selectedCountryId = previewCountryId ?? state?.selectedCountryId ?? null;
  const selectedCountry = state && selectedCountryId ? state.countries[selectedCountryId] ?? null : null;
  const selectedProvinces = state && selectedCountryId ? state.provinces.filter((province) => province.ownerId === selectedCountryId) : [];

  const safeAction = async (action: () => Promise<void>) => {
    try { await action(); }
    catch (error) { Alert.alert('Действие отклонено', error instanceof Error ? error.message : 'Неизвестная ошибка'); }
  };

  const createRoom = (name: string) => safeAction(async () => { const remote = new HttpTransport(remoteUrl); attach(await remote.createRoom(name), remote); });
  const createOffline = () => safeAction(async () => { const local = new LocalTransport(); attach(await local.createRoom('Игрок 1'), local); });
  const joinRoom = (room: string, name: string) => safeAction(async () => { const remote = new HttpTransport(remoteUrl); attach(await remote.joinRoom(room, name), remote); });

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

  const selectProvince = (province: Province) => {
    if (gameStarted) { setSelectedProvinceId(province.id); setSection('Context'); setPanelOpen(true); }
    else setPreviewCountryId(province.ownerId);
  };

  useEffect(() => { if (gameStarted) setPanelOpen(false); }, [gameStarted]);
  const exitCampaign=()=>void safeAction(async()=>{if(!state)return;if(transport instanceof LocalTransport)await campaignStore.save(state);await transport.leave(state.id);unsubscribeRef.current?.();setState(null);setPlayerId(null);setSelectedProvinceId(null);setPreviewCountryId(null);});
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

  if (!state) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" />
        <ScrollView contentContainerStyle={styles.entryWrap} keyboardShouldPersistTaps="handled">
          <Text style={styles.brand}>DOMINION</Text>
          <Text style={styles.tagline}>MULTIPLAYER GRAND STRATEGY</Text>
          <Text style={styles.exitText}>НОВАЯ КАМПАНИЯ</Text>
          <EntryPanel onCreate={createRoom} onJoin={joinRoom} />
          {savedCampaigns.length>0&&<Text style={styles.exitText}>ЗАГРУЗИТЬ КАМПАНИЮ</Text>}
          {savedCampaigns.map(item=><View key={item.id} style={{gap:6}}><Pressable accessibilityLabel="Продолжить кампанию" style={styles.exitButton} onPress={()=>void safeAction(async()=>{const local=new LocalTransport();attach(await local.restore(await campaignStore.load(item.id)),local);})}><Text style={styles.exitText}>{item.metadata?.name??item.id} · {item.error??`${item.metadata?.month}/${item.metadata?.year} · ход ${item.metadata?.tick}`}</Text></Pressable><Pressable style={styles.exitButton} onPress={()=>Alert.alert('Удалить сохранение?','Это действие нельзя отменить',[{text:'Отмена'},{text:'Удалить',style:'destructive',onPress:()=>void safeAction(async()=>{await campaignStore.delete(item.id);setSavedCampaigns(await campaignStore.list());})}])}><Text style={styles.exitText}>Удалить</Text></Pressable></View>)}
          <Text style={styles.exitText}>{saveStatus}</Text>
          {savedRooms.map(room=><Pressable key={room.gameId} style={styles.exitButton} onPress={()=>void safeAction(async()=>{const remote=new HttpTransport(remoteUrl);attach(await remote.reconnect(room.gameId),remote);})}><Text style={styles.exitText}>ПРОДОЛЖИТЬ ONLINE · {room.roomCode} · {room.countryId??"Лобби"}</Text></Pressable>)}
          <Pressable accessibilityLabel="Одиночная игра" style={styles.exitButton} onPress={createOffline}><Text style={styles.exitText}>ОДИНОЧНАЯ ИГРА</Text></Pressable>
          <Text style={styles.footer}>DOMINION · ONLINE CAMPAIGNS</Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.content}>
        <View style={styles.topbar}>
          <View style={{maxWidth:gameStarted?115:220}}>
            <Text style={[styles.brand,gameStarted&&{fontSize:15}]}>DOMINION</Text>
            <Text style={styles.subbrand}>{gameStarted ? `Ход ${state.tick} · ${state.phase === 'finished' ? 'КАМПАНИЯ ЗАВЕРШЕНА' : 'КАМПАНИЯ'}` : `Комната ${state.roomCode}`}</Text>
          </View>
          {gameStarted&&<LandscapeHUD state={state} playerId={playerId??''} onCommand={sendCommand}/> }
          {!gameStarted && <CountryPicker state={state} onPreview={id => { setPreviewCountryId(id); setFocusCountryId(id); setPanelOpen(true); }} />}
          <Pressable style={styles.exitButton} onPress={() => setPanelOpen(!panelOpen)}><Text style={styles.exitText}>{panelOpen ? "ЗАКРЫТЬ ПАНЕЛЬ" : "УПРАВЛЕНИЕ"}</Text></Pressable>
          {transport instanceof LocalTransport&&<Pressable accessibilityLabel="Сохранить кампанию" style={styles.exitButton} onPress={()=>void safeAction(async()=>{await campaignStore.save(state);setSaveStatus('Сохранено');})}><Text style={styles.exitText}>СОХРАНИТЬ</Text></Pressable>}
          <Pressable style={styles.exitButton} onPress={confirmExit}><Text style={styles.exitText}>ВЫЙТИ</Text></Pressable>
        </View>

        {transport instanceof LocalTransport&&saveStatus!==''&&<Text style={{color:"#9BABBF",fontSize:10}}>{saveStatus}</Text>}
        {connectionStatus!==''&&<Text style={{color:"#ffcf85",padding:6}}>{connectionStatus}</Text>}
        <View style={styles.mapArea}><WorldMap
          state={state}
          settingsOpen={mapMenuOpen}
          onSettingsChange={setMapMenuOpen}
          focusCountryId={focusCountryId}
          selectedCountryId={selectedCountryId}
          selectedProvinceId={selectedProvinceId}
          onSelectProvince={selectProvince}
          onLongPressProvince={selectProvince}
        /></View>

        {gameStarted&&<ScrollView horizontal style={styles.navigation} contentContainerStyle={{gap:4,flexGrow:1}} showsHorizontalScrollIndicator={false}>{SECTIONS.map(tab=><Pressable key={tab} accessibilityLabel={`Раздел ${SECTION_LABELS[tab]}`} accessibilityRole="button" accessibilityState={{selected:panelOpen&&section===tab}} style={[styles.navButton,panelOpen&&section===tab&&{backgroundColor:'#2a405e'}]} onPress={()=>{LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);setSection(tab);setPanelOpen(true);}}><Text style={styles.exitText}>{SECTION_LABELS[tab]}</Text></Pressable>)}</ScrollView>}
        {panelOpen && <ScrollView key={section} keyboardShouldPersistTaps="handled" style={[styles.panel,{width:panelWidth(width),bottom:gameStarted?54:12}]} contentContainerStyle={styles.panelContent}>

        {!gameStarted && (
          <CountryPanel
            country={selectedCountry}
            leader={selectedCountry?.rulerId ? state.leaders?.[selectedCountry.rulerId] ?? null : null}
            provinces={selectedProvinces}
            locked={Boolean(selectedCountryId && myCountryId === selectedCountryId)}
            onChoose={chooseCountry}
          />
        )}

        {!gameStarted ? (
          <LobbyPanel
            state={state}
            playerId={playerId ?? ''}
            onReady={(ready) => playerId && safeAction(() => transport.sendCommand(state.id, { type: 'SET_READY', playerId, ready }))}
            onStart={() => playerId && safeAction(() => transport.sendCommand(state.id, { type: 'START_GAME', playerId }))}
          />
        ) : (
          <GamePanel key={section} section={section} onFocusProvince={id=>{setSelectedProvinceId(id);setSection('Context');setFocusCountryId(myCountryId);}}
            state={state}
            playerId={playerId ?? ''}
            selectedProvinceId={selectedProvinceId}
            onCommand={sendCommand}
          />
        )}
        </ScrollView>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#070C15' },
  entryWrap: { flexGrow: 1, justifyContent: 'center', padding: 18, gap: 12, maxWidth: 600, width: '100%', alignSelf: 'center' },
  content: { flex: 1 },
  mapArea: { flex: 1 },
  navigation:{position:'absolute',left:8,right:8,bottom:4,height:46,backgroundColor:'#101a2af5',borderRadius:12},
  navButton:{flex:1,minWidth:90,minHeight:44,paddingHorizontal:12,alignItems:'center',justifyContent:'center',borderRadius:9},
  panel: { position: 'absolute', right: 8, top: 62, bottom: 12, width: '34%', maxWidth: 410, minWidth: 250, backgroundColor: '#111A2Af5', borderRadius: 12 },
  panelContent: { padding: 8, gap: 10 },
  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, gap: 8 },
  brand: { color: '#F4F7FC', fontSize: 22, fontWeight: '900', letterSpacing: 2.2 },
  tagline: { color: '#61718A', fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 5 },
  subbrand: { color: '#6F7F99', fontSize: 11, marginTop: 2 },
  footer: { color: '#46546A', textAlign: 'center', fontSize: 10, letterSpacing: 0.4 },
  exitButton: { backgroundColor: '#151F30', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 9, minHeight:44,justifyContent:'center' },
  exitText: { color: '#9BABBF', fontWeight: '900', fontSize: 10 },
});
