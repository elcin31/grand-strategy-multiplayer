import {ArmyFormationPanel} from './src/components/ArmyFormationPanel';
import {useCampaignAudio} from './src/audio/campaignAudio';
import {audioHub} from './src/audio/hub';
import {AudioPressable as Pressable} from './src/components/AudioPressable';
import {WarProgressIndicator} from './src/components/WarProgressIndicator';
import {PeaceNegotiations,EMPTY_PEACE_DRAFT,eligiblePeaceProvinces,draftClauses,type PeaceDraft} from './src/components/WarPanel';
import {makePeaceTerms,peaceCost} from './supabase/functions/_shared/warSystem';
import {ArmyDock} from './src/components/ArmyDock';
import {DraggableWindow} from './src/components/DraggableWindow';
import {StrategyIcon} from './src/components/StrategyIcon';
import {QuickTutorial} from './src/components/QuickTutorial';
import {projectFogOfWar} from './supabase/functions/_shared/strategy3System';
import {dayDelay} from './supabase/functions/_shared/calendarSystem';
import {mapTapIntent} from './src/ui/mapInteraction';
import {CameraWorkGate} from './src/performance/framePacing';
import {colors,tokens} from './src/ui/tokens';
import {traceStartup} from './src/performance/startupTrace';
import {recordMetrics} from './src/performance/telemetry';
import {LaunchAction} from './src/ui/launchAction';
import {LandscapeHUD} from './src/components/LandscapeHUD';
import {SECTIONS,SECTION_LABELS,panelWidth,backAction,type Section} from './src/ui/landscape';
import { campaignStore } from './src/persistence/nativeCampaignStore';
import { useCallback, useMemo, useEffect, useRef, useState } from 'react';
import {ActivityIndicator, Alert, AppState, BackHandler, Keyboard, useWindowDimensions, StatusBar, StyleSheet, Text, View, ScrollView} from 'react-native';
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
  const [diplomacyCountryId,setDiplomacyCountryId]=useState<string|null>(null);
  const [armyFormationOpen,setArmyFormationOpen]=useState(false);
  const [section,setSection]=useState<Section>('Country');
  const [peaceWarId,setPeaceWarId]=useState<string|null>(null),[peacePicking,setPeacePicking]=useState(false),[peaceDrafts,setPeaceDrafts]=useState<Record<string,PeaceDraft>>({});
  const peaceDraft=peaceWarId?peaceDrafts[peaceWarId]??EMPTY_PEACE_DRAFT:EMPTY_PEACE_DRAFT;
  const openPeace=useCallback((id:string)=>{setPeaceWarId(id);setPeacePicking(false);setPanelOpen(false);setSelectedArmyId(null);},[]);
  const changePeaceDraft=useCallback((draft:PeaceDraft)=>{if(peaceWarId)setPeaceDrafts(v=>({...v,[peaceWarId]:draft}));},[peaceWarId]);
  const [navTip,setNavTip]=useState<string|null>(null);
  useEffect(()=>{if(!navTip)return;const timer=setTimeout(()=>setNavTip(null),1800);return()=>clearTimeout(timer);},[navTip]);
  const [mapMenuOpen,setMapMenuOpen]=useState(false);
  const [saveStatus,setSaveStatus]=useState('');
  const latestState=useRef<GameState|null>(null);
  const cameraWork=useRef(new CameraWorkGate());
  const cameraActivity=useCallback((active:boolean)=>cameraWork.current.activity(active),[]);
  const [connectionStatus,setConnectionStatus]=useState('');
  const [lobbyOperation,setLobbyOperation]=useState<'country'|'ready'|'start'|null>(null);
  const lobbyLatch=useRef(false);
  const [lobbyError,setLobbyError]=useState('');
  const [launchSlow,setLaunchSlow]=useState(false);
  useEffect(()=>{if(lobbyOperation!=='start'){setLaunchSlow(false);return;}const timer=setTimeout(()=>setLaunchSlow(true),12000);return()=>clearTimeout(timer);},[lobbyOperation]);

  const [transport, setTransport] = useState<MultiplayerTransport>(() => new HttpTransport(remoteUrl,undefined,'-v211'));
  const [state, setState] = useState<GameState | null>(null);
  latestState.current=state;
  useEffect(()=>{if(state&&launchTapAt.current){traceStartup("campaign screen committed");recordMetrics({tapToScreenMs:performance.now()-launchTapAt.current});launchTapAt.current=0;}},[state?.id,state?.phase]);
  useEffect(()=>{
    if(!(transport instanceof LocalTransport)||!state)return;
    let alive=true,busy=false,pending=false,lastSaved:GameState|null=null;
    const scheduling={beforeWork:async(isUrgent:()=>boolean)=>{
      while(alive&&AppState.currentState==='active'&&!isUrgent()&&cameraWork.current.defer(performance.now(),750))
        await new Promise<void>(resolve=>setTimeout(resolve,100));
    }};
    const save=(urgent=false)=>{
      if(urgent)campaignStore.flushBackgroundWork();
      const current=latestState.current;if(!current||current.id!==state.id||current===lastSaved)return;
      if(busy){pending=true;return;}busy=true;
      void campaignStore.save(current,undefined,urgent?undefined:scheduling).then(()=>{
        lastSaved=current;if(alive)setSaveStatus('Автосохранено');
      }).catch(e=>{if(alive)setSaveStatus(e.message);}).finally(()=>{
        busy=false;if(alive&&pending){pending=false;save(AppState.currentState!=='active');}
      });
    };
    const timer=setInterval(()=>{if(!cameraWork.current.defer(performance.now(),750))save();},10000);
    const sub=AppState.addEventListener('change',status=>{if(status!=='active')save(true);});
    return()=>{alive=false;clearInterval(timer);sub.remove();};
  },[state?.id,transport]);
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


  const lobbyAction = async (kind:'country'|'ready'|'start',command:GameCommand) => {
    if(!state||lobbyLatch.current)return;
    lobbyLatch.current=true;setLobbyOperation(kind);setLobbyError('');
    try{await transport.sendCommand(state.id,command);audioHub.play('confirm');}
    catch(error){
      if(kind==='start'&&transport instanceof HttpTransport){try{const fresh=await transport.synchronize(state.id);if(fresh.phase!=='lobby')return;}catch{}}
      setLobbyError(error instanceof Error?error.message:'Не удалось подтвердить действие');
    }finally{lobbyLatch.current=false;setLobbyOperation(null);}
  };
  const chooseCountry = () => {
    if (!state || !selectedCountryId || !playerId) return;
    void lobbyAction('country',{ type: 'SELECT_COUNTRY', playerId, countryId: selectedCountryId });
  };

  const sendCommand = (command: GameCommand) => {
    if (!state) return;
    void safeAction(async()=>{await transport.sendCommand(state.id,command);audioHub.play(command.type==='PROPOSE_PEACE'?'peace_offer':command.type==='OFFER_TREATY'||command.type==='OFFER_DIPLOMACY'?'alliance':command.type==='ORDER_ARMY'||command.type==='ROUTE_ARMY'?'march':'confirm');});
  };

  const myCountryId = state?.players.find((player) => player.id === playerId)?.countryId ?? null;
  useCampaignAudio(state,myCountryId);
  const gameStarted = Boolean(state && (state.phase === 'running' || state.phase === 'paused' || state.phase === 'finished'));

  const deselectArmy=useCallback(()=>{setSelectedArmyId(null);setSelectedCityId(null);setSelectedProvinceId(null);setPanelOpen(false);},[]);
  const selectCountry=useCallback((id:string)=>{
    setSelectedArmyId(null);setSelectedCityId(null);setSelectedProvinceId(null);
    if(!gameStarted){setPreviewCountryId(id);setPanelOpen(true);return;}
    setDiplomacyCountryId(id===myCountryId?null:id);setSection(id===myCountryId?'Country':'Diplomacy');setPanelOpen(true);
  },[gameStarted,myCountryId]);
  const selectContext=useCallback((province:Province)=>{
    setSelectedArmyId(null);setSelectedCityId(null);setSelectedProvinceId(province.id);setSection('Context');setPanelOpen(true);
  },[]);
  const selectProvince = useCallback((province: Province) => {
    audioHub.play('province');
    if(!gameStarted){setPreviewCountryId(province.ownerId);return;}
    if(peacePicking&&peaceWarId&&myCountryId){if(peaceDraft.provinceIds.includes(province.id)){changePeaceDraft({...peaceDraft,provinceIds:peaceDraft.provinceIds.filter(id=>id!==province.id)});}else if(peaceDraft.provinceIds.length<50&&eligiblePeaceProvinces(latestState.current!,peaceWarId,myCountryId,peaceDraft).includes(province.id)){changePeaceDraft({...peaceDraft,white:false,provinceIds:[...peaceDraft.provinceIds,province.id]});}return;}
    const current=latestState.current,army=current?.armies.find(a=>a.id===selectedArmyId&&a.ownerId===myCountryId);
    const intent=mapTapIntent(army?.id??null,myCountryId,{provinceId:province.id,provinceOwnerId:province.ownerId});
    if(intent.type==='order'&&playerId&&current){void safeAction(async()=>{await transport.sendCommand(current.id,{type:'ORDER_ARMY',playerId,armyId:intent.armyId,provinceId:intent.provinceId});audioHub.play('march');});return;}
    if(intent.type==='diplomacy'){selectCountry(intent.countryId);setSelectedProvinceId(province.id);return;}
    selectContext(province);
  },[gameStarted,peacePicking,peaceWarId,peaceDraft,changePeaceDraft,selectedArmyId,myCountryId,playerId,transport,selectCountry,selectContext]);
  const selectArmy=useCallback((id:string,province:string)=>{
    audioHub.play('army');
    const army=latestState.current?.armies.find(a=>a.id===id);if(!army)return;
    const intent=mapTapIntent(selectedArmyId,myCountryId,{army});
    if(intent.type==='deselect'){deselectArmy();return;}
    if(intent.type==='diplomacy'){selectCountry(intent.countryId);return;}
    setSelectedArmyId(id);setSelectedCityId(null);setSelectedProvinceId(province);setSection('Context');setPanelOpen(false);
  },[selectedArmyId,myCountryId,deselectArmy,selectCountry]);
  const selectCity=useCallback((id:string,province:string)=>{
    const p=latestState.current?.provinces.find(p=>p.id===province);if(!p)return;
    if(p.ownerId!==myCountryId){selectCountry(p.ownerId);setSelectedProvinceId(province);return;}
    setSelectedCityId(id);setSelectedArmyId(null);setSelectedProvinceId(province);setSection('Context');setPanelOpen(true);
  },[myCountryId,selectCountry]);

  useEffect(() => { if (gameStarted) setPanelOpen(false); }, [gameStarted]);
  const exitCampaign=()=>void safeAction(async()=>{if(!state)return;if(transport instanceof LocalTransport)await campaignStore.save(state);await transport.leave(state.id);unsubscribeRef.current?.();setState(null);setPlayerId(null);setSelectedProvinceId(null);setPreviewCountryId(null);onExit();});
  const confirmExit=()=>Alert.alert('Выйти из кампании?',transport instanceof LocalTransport?'Прогресс будет сохранён.':'К кампании можно вернуться через список сохранённых сессий.',[{text:'Остаться',style:'cancel'},{text:'Выйти',onPress:exitCampaign}]);
  useEffect(()=>{const handler=BackHandler.addEventListener('hardwareBackPress',()=>{if(armyFormationOpen){setArmyFormationOpen(false);return true;}if(peacePicking){setPeacePicking(false);return true;}if(peaceWarId){setPeaceWarId(null);return true;}const action=backAction({keyboard:Keyboard.isVisible(),modal:mapMenuOpen,army:!!selectedArmyId,context:!!selectedProvinceId&&panelOpen,panel:panelOpen,campaign:!!state});if(action==='keyboard')Keyboard.dismiss();else if(action==='modal')setMapMenuOpen(false);else if(action==='army')deselectArmy();else if(action==='context'){setSelectedArmyId(null);setSelectedCityId(null);setSelectedProvinceId(null);setSection('Country');setPanelOpen(false);}else if(action==='panel')setPanelOpen(false);else if(action==='confirm')confirmExit();else return false;return true;});return()=>handler.remove();},[armyFormationOpen,peacePicking,peaceWarId,mapMenuOpen,panelOpen,state,selectedProvinceId,selectedArmyId,transport,deselectArmy]);

  useEffect(() => {
    if (transport instanceof HttpTransport || !state || !playerId || state.phase !== 'running' || state.speed === 0) return;
    const me = state.players.find((player) => player.id === playerId);
    if (!me?.isHost) return;

    let disposed = false;
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const delay = dayDelay(state.speed);
    let tickDue=performance.now()+delay;
    const advance = async () => {
      if (disposed || inFlight) return;
      if(latestState.current?.phase!=='running'||latestState.current.speed!==state.speed)return;
      inFlight = true;
      try { await transport.sendCommand(state.id, { type: 'ADVANCE_DAY' }); }
      catch { /* A transient authoritative conflict must not create a request pile-up. */ }
      finally {
        inFlight = false;
        if (!disposed) {tickDue=Math.max(tickDue+delay,performance.now()+16);timer = setTimeout(() => { void advance(); }, Math.max(16,tickDue-performance.now()));}
      }
    };
    timer = setTimeout(() => { void advance(); }, delay);
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
    };
  }, [state?.id, state?.phase, state?.speed, playerId, transport]);

  useEffect(()=>{const a=state?.armies.find(a=>a.id===selectedArmyId);if(a)setSelectedProvinceId(a.provinceId);else if(selectedArmyId)deselectArmy();},[state?.armies,selectedArmyId,deselectArmy]);

  const presentation=useMemo(()=>state&&myCountryId&&!state.fogViewerId?projectFogOfWar(state,myCountryId):state,[state,myCountryId]);
  useEffect(()=>{if(peaceWarId&&!state?.wars?.some(w=>w.id===peaceWarId)){setPeaceWarId(null);setPeacePicking(false);}},[state?.wars,peaceWarId]);
  const peaceEligible=useMemo(()=>peacePicking&&peaceWarId&&state&&myCountryId?eligiblePeaceProvinces(state,peaceWarId,myCountryId,peaceDraft):[],[peacePicking,peaceWarId,state?.provinces,state?.wars,myCountryId,peaceDraft.territoryKind,peaceDraft.targetId]);
  const peaceSelection=useMemo(()=>peacePicking?{eligibleIds:peaceEligible,selectedIds:peaceDraft.provinceIds}:undefined,[peacePicking,peaceEligible,peaceDraft.provinceIds]);
  let selectionPrice='—';try{const war=state?.wars?.find(w=>w.id===peaceWarId);if(war&&state&&myCountryId)selectionPrice=peaceCost(state,war,myCountryId,makePeaceTerms(draftClauses(peaceDraft))).toFixed(1);}catch{}
  const initialized=useRef(false);
  useEffect(()=>{if(initialized.current)return;initialized.current=true;
    void launch.current!.run(async()=>{
      try {
        if(intent.type==='offline'){const local=new LocalTransport();attach(await local.createRoom('Игрок 1'),local);}
        else if(intent.type==='load'){const local=new LocalTransport();attach(await local.restore(await campaignStore.load(intent.id)),local);}
        else {const remote=new HttpTransport(remoteUrl,undefined,'-v211');const session=intent.type==='reconnect'?await remote.reconnect(intent.id):intent.type==='create'?await remote.createRoom(intent.name):await remote.joinRoom(intent.code,intent.name);attach(session,remote);}
      } catch(error){onError(error instanceof Error?error.message:String(error));}
    });
  },[]);
  if(!state)return <LoadingScreen message="Загрузка кампании…"/>;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.content}>
        {launchBusy&&!gameStarted&&<View accessibilityRole="alert" style={{position:"absolute",top:0,bottom:0,left:0,right:0,zIndex:100,backgroundColor:"#101f2b",justifyContent:"center",alignItems:"center"}}><ActivityIndicator size="large" color={colors.gold}/><Text style={styles.exitText}>Подключение к кампании…</Text></View>}
        <View style={styles.topbar}>
          {!gameStarted&&<View style={{maxWidth:220}}>
            <Text style={[styles.brand,gameStarted&&{fontSize:15}]}>DOMINION</Text>
            <Text style={styles.subbrand}>{gameStarted ? `Ход ${state.tick} · ${state.phase === 'finished' ? 'КАМПАНИЯ ЗАВЕРШЕНА' : 'КАМПАНИЯ'}` : `Комната ${state.roomCode}`}</Text>
          </View>}
          {selectedArmyId&&<Pressable accessibilityRole="button" style={styles.exitButton} onPress={deselectArmy}><Text style={styles.exitText}>↙</Text></Pressable>}
          {gameStarted&&<LandscapeHUD state={state} playerId={playerId??''} onCommand={sendCommand} onNotifications={()=>{setSection('Notifications');setPanelOpen(v=>section==='Notifications'?!v:true);}}/> }
          {!gameStarted && <CountryPicker state={state} onPreview={id => { setPreviewCountryId(id); setFocusCountryId(id); setPanelOpen(true); }} />}
          <Pressable style={styles.exitButton} onPress={() => setPanelOpen(!panelOpen)}><Text style={styles.exitText}>{panelOpen ? '✕' : '☰'}</Text></Pressable>
          {transport instanceof LocalTransport&&<Pressable accessibilityLabel="Сохранить кампанию" style={styles.exitButton} onPress={()=>void safeAction(async()=>{await campaignStore.save(state);setSaveStatus('Сохранено');})}><Text style={styles.exitText}>▣</Text></Pressable>}
          {gameStarted&&<Pressable accessibilityRole="button" accessibilityLabel="Настройки звука" style={styles.exitButton} onPress={()=>{setPeaceWarId(null);setPeacePicking(false);setSection('Audio');setPanelOpen(true);}}><Text style={styles.exitText}>♫</Text></Pressable>}
          <Pressable style={styles.exitButton} onPress={confirmExit}><Text style={styles.exitText}>↪</Text></Pressable>
        </View>

        {transport instanceof LocalTransport&&saveStatus!==''&&<Text style={{color:colors.muted,fontSize:10}}>{saveStatus}</Text>}
        {connectionStatus!==''&&<Text style={{color:"#ffcf85",padding:6}}>{connectionStatus}</Text>}
        <View style={styles.mapArea}><WorldMap
          state={state}
          onCameraActivity={cameraActivity}
          settingsOpen={mapMenuOpen}
          onSettingsChange={setMapMenuOpen}
          focusCountryId={focusCountryId}
          selectedCountryId={gameStarted?myCountryId:selectedCountryId}
          selectedProvinceId={selectedProvinceId}
          selectedArmyId={selectedArmyId} selectedCityId={selectedCityId}
          provinceSelection={peaceSelection}
          onSelectArmy={!gameStarted||peacePicking?undefined:selectArmy}
          onSelectCity={!gameStarted||peacePicking?undefined:selectCity}
          onSelectProvince={selectProvince}
          onLongPressProvince={peacePicking?selectProvince:selectContext}
          onSelectCountry={peacePicking?undefined:selectCountry}
          onClearSelection={deselectArmy}
        /></View>

        {gameStarted&&myCountryId&&<WarProgressIndicator state={state} countryId={myCountryId} onOpen={openPeace}/>}
        {gameStarted&&selectedArmyId&&!panelOpen&&<ArmyDock state={state} armyId={selectedArmyId} playerId={playerId??''} width={Math.max(230,Math.min(460,width-(panelOpen?panelWidth(width):190)-100))} onInspect={()=>{setSection('Context');setPanelOpen(true);}} onDeselect={deselectArmy} onCommand={sendCommand}/>}
        {gameStarted&&<QuickTutorial state={state} playerId={playerId??''} onCommand={sendCommand}/>}
        {gameStarted&&<ScrollView style={styles.navigation} contentContainerStyle={{gap:0,flexGrow:1}}>{SECTIONS.map(tab=><Pressable key={tab} accessibilityLabel={`Раздел ${SECTION_LABELS[tab]}`} accessibilityRole="button" accessibilityState={{selected:panelOpen&&section===tab}} style={[styles.navButton,panelOpen&&section===tab&&{backgroundColor:colors.burgundy}]} onLongPress={()=>setNavTip(SECTION_LABELS[tab])} onPress={()=>{setPeaceWarId(null);setPeacePicking(false);setNavTip(null);setSection(tab);setPanelOpen(v=>section===tab?!v:true);}}><StrategyIcon section={tab} size={20}/></Pressable>)}</ScrollView>}
        {navTip&&<View pointerEvents="none" style={{position:'absolute',top:54,left:56,zIndex:45,padding:8,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.gold,borderRadius:4}}><Text style={{color:colors.parchment,fontSize:12}}>{navTip}</Text></View>}
        {panelOpen&&!gameStarted && <View style={[styles.panel,{width:Math.max(250,width-Math.min(390,width*.42)-32),top:56,bottom:8}]}><ScrollView keyboardShouldPersistTaps="always" style={{flex:1}} contentContainerStyle={styles.panelContent}>

        {!gameStarted && (
          <CountryPanel
            showChoose={false}
            country={selectedCountry}
            leader={selectedCountry?.rulerId ? state.leaders?.[selectedCountry.rulerId] ?? null : null}
            provinces={selectedProvinces}
            locked={Boolean(selectedCountryId && myCountryId === selectedCountryId)}
            pending={lobbyOperation==='country'} disabled={lobbyOperation!==null}
            occupied={state.players.some(p=>p.id!==playerId&&p.countryId===selectedCountryId)}
            onChoose={chooseCountry}
          />
        )}

        </ScrollView><Pressable accessibilityRole="button" accessibilityLabel="Играть за эту страну" accessibilityState={{disabled:!selectedCountryId||lobbyOperation!==null||myCountryId===selectedCountryId||state.players.some(p=>p.id!==playerId&&p.countryId===selectedCountryId),busy:lobbyOperation==='country'}} disabled={!selectedCountryId||lobbyOperation!==null||myCountryId===selectedCountryId||state.players.some(p=>p.id!==playerId&&p.countryId===selectedCountryId)} style={{minHeight:48,backgroundColor:colors.gold,alignItems:'center',justifyContent:'center',margin:6,borderRadius:4}} onPress={chooseCountry}><Text style={{fontWeight:'700',fontSize:12,color:colors.graphite}}>{lobbyOperation==='country'?'Подтверждение…':selectedCountryId&&myCountryId===selectedCountryId?'Страна выбрана':selectedCountryId&&state.players.some(p=>p.id!==playerId&&p.countryId===selectedCountryId)?'Страна занята':selectedCountry?'ИГРАТЬ ЗА ЭТУ СТРАНУ':'Выберите страну'}</Text></Pressable></View>}
        {gameStarted&&panelOpen&&<DraggableWindow key={section} title={selectedArmyId&&section==='Context'?'Армия':SECTION_LABELS[section]} onClose={()=>setPanelOpen(false)}>
          <GamePanel onCreateArmy={()=>{setArmyFormationOpen(true);setPanelOpen(false);}} onOpenPeace={openPeace} diplomacyCountryId={diplomacyCountryId} onSelectArmy={selectArmy} onDeselectArmy={deselectArmy} focusedArmyId={selectedArmyId} focusedCityId={selectedCityId} key={section} section={section} onFocusProvince={id=>{setSelectedArmyId(section==='Construction'?null:state.armies.find(a=>a.provinceId===id&&a.ownerId===myCountryId)?.id??null);setSelectedProvinceId(id);if(section!=='Construction')setSection('Context');setFocusCountryId(myCountryId);}}
            state={presentation??state}
            playerId={playerId ?? ''}
            selectedProvinceId={selectedProvinceId}
            onCommand={sendCommand}
          />
        </DraggableWindow>}
        {gameStarted&&armyFormationOpen&&<DraggableWindow title="Создать новую армию" onClose={()=>{setArmyFormationOpen(false);setSection('Military');setPanelOpen(true);}}><ArmyFormationPanel state={presentation??state} playerId={playerId??''} initialProvince={selectedProvinceId} onCommand={sendCommand} onSubmit={async command=>{await transport.sendCommand(state.id,command);setArmyFormationOpen(false);setSection('Military');setPanelOpen(true);audioHub.play('confirm');}}/></DraggableWindow>}
        {gameStarted&&peaceWarId&&<DraggableWindow title="Мирные переговоры" minimized={peacePicking} onRestore={()=>setPeacePicking(false)} onClose={()=>{setPeaceWarId(null);setPeacePicking(false);}}><PeaceNegotiations state={presentation??state} playerId={playerId??''} warId={peaceWarId} draft={peaceDraft} onDraft={changePeaceDraft} onPickMap={()=>{setPeacePicking(true);setPanelOpen(false);}} onSubmit={async command=>{await transport.sendCommand(state.id,command);audioHub.play(command.type==='PROPOSE_PEACE'?'peace_offer':'peace_signed');}}/></DraggableWindow>}
        {peacePicking&&<View style={{position:'absolute',left:56,bottom:5,maxWidth:440,backgroundColor:colors.surface,padding:6,borderWidth:1,borderColor:colors.gold,flexDirection:'row',alignItems:'center',gap:8,zIndex:30}}><Text style={{color:colors.parchment,fontSize:11}}>Территории: {peaceDraft.provinceIds.length} · договор {selectionPrice} счёта</Text><Pressable accessibilityRole="button" style={{minHeight:44,padding:8,justifyContent:'center'}} onPress={()=>setPeacePicking(false)}><Text style={{color:colors.gold}}>Вернуться к договору →</Text></Pressable></View>}
        {!gameStarted && <View style={[styles.lobbyDock,{width:Math.min(390,width*.42)}]}>
          {lobbyError!==''&&<View style={{backgroundColor:colors.surface,padding:8}}><Text accessibilityRole="alert" style={{color:colors.gold,fontSize:12}}>{lobbyError}</Text><Pressable accessibilityRole="button" style={[styles.exitButton,{width:undefined,paddingHorizontal:10}]} onPress={()=>{setLobbyError('');if(transport instanceof HttpTransport)void safeAction(async()=>{await transport.synchronize(state.id);});}}><Text style={styles.exitText}>Синхронизировать эту комнату</Text></Pressable></View>}
          {lobbyOperation==='start'&&<Text style={{color:colors.gold,backgroundColor:colors.surface,padding:8}}>{launchSlow?'Проверяем подтверждение сервера. Комната сохранена; после ошибки запуск можно повторить.':'Сервер подтверждает запуск кампании…'}</Text>}
          <LobbyPanel
            busy={launchBusy||lobbyOperation!==null} pending={lobbyOperation}
            state={presentation??state}
            playerId={playerId ?? ''}
            onReady={(ready) => {if(playerId)void lobbyAction('ready',{type:'SET_READY',playerId,ready});}}
            onStart={() => {if(playerId)void lobbyAction('start',{type:'START_GAME',playerId});}}
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
  mapArea: { flex: 1, marginLeft:52 },
  navigation:{position:'absolute',left:2,top:50,bottom:4,width:48,backgroundColor:'#101B26F5',borderRadius:4},
  navButton:{height:44,width:48,alignItems:'center',justifyContent:'center',borderRadius:4},
  lobbyDock: {position:'absolute',left:8,top:56,bottom:8},
  panel: { position: 'absolute', right: 8, top: 78, bottom: 12, width: '34%', maxWidth: 410, minWidth: 250, backgroundColor: '#17222DF5', borderWidth:1,borderColor:colors.border, borderRadius:tokens.radius.panel },
  panelContent: { padding: 8, gap: 10 },
  topbar: { height:48,zIndex:35,flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, gap: 2 },
  brand: { fontFamily:tokens.typography.display, color:colors.parchment, fontSize: 22, fontWeight: '900', letterSpacing: 2.2 },
  tagline: { color: '#61718A', fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 5 },
  subbrand: { fontFamily:tokens.typography.display, color:colors.muted, fontSize: 11, marginTop: 2 },
  footer: { color: '#46546A', textAlign: 'center', fontSize: 10, letterSpacing: 0.4 },
  exitButton: { backgroundColor:colors.surface, borderRadius:4, width:44,minHeight:44,alignItems:'center',justifyContent:'center' },
  exitText: { color: colors.muted, fontWeight: '900', fontSize: 10 },
});
