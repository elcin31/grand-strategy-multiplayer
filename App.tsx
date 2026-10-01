import React, { useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { CountryPanel } from './src/components/CountryPanel';
import { GamePanel } from './src/components/GamePanel';
import { EntryPanel, LobbyPanel } from './src/components/LobbyPanel';
import { WorldMap } from './src/components/WorldMap';
import { LocalTransport } from './src/multiplayer/localTransport';
import { HttpTransport } from './src/multiplayer/httpTransport';
import type { MultiplayerTransport, TransportSession } from './src/multiplayer/transport';
import { CountryId, GameCommand, GameState, Province } from './src/types/game';

const productionMultiplayerUrl = 'https://dfjsnjxnyjspwugjguhq.supabase.co/functions/v1';
const remoteUrl = process.env.EXPO_PUBLIC_MULTIPLAYER_URL?.trim() || productionMultiplayerUrl;


export default function App() {
  return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider><GameApp /></SafeAreaProvider></GestureHandlerRootView>;
}

function GameApp() {
  const [transport, setTransport] = useState<MultiplayerTransport>(() => new HttpTransport(remoteUrl));
  const [state, setState] = useState<GameState | null>(null);
  const [previewCountryId, setPreviewCountryId] = useState<CountryId | null>(null);
  const [selectedProvinceId, setSelectedProvinceId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const unsubscribeRef = useRef<null | (() => void)>(null);

  useEffect(() => () => unsubscribeRef.current?.(), []);

  const attach = (session: TransportSession, source: MultiplayerTransport = transport) => {
    setTransport(source);
    unsubscribeRef.current?.();
    setPlayerId(session.playerId);
    setState(session.state);
    setSelectedProvinceId(null);
    setPanelOpen(true);
    unsubscribeRef.current = source.subscribe(session.state.id, setState);
  };

  const selectedCountryId = previewCountryId ?? state?.selectedCountryId ?? null;
  const selectedCountry = state && selectedCountryId ? state.countries[selectedCountryId] : null;
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
    if (gameStarted) { setSelectedProvinceId(province.id); setPanelOpen(true); }
    else setPreviewCountryId(province.ownerId);
  };

  useEffect(() => { if (gameStarted) setPanelOpen(false); }, [gameStarted]);
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (panelOpen && state) { setPanelOpen(false); return true; }
      return false;
    });
    return () => handler.remove();
  }, [panelOpen, state?.id]);

  useEffect(() => {
    if (!state || !playerId || state.phase !== 'running' || state.speed === 0) return;
    const me = state.players.find((player) => player.id === playerId);
    if (!me?.isHost) return;
    const interval = setInterval(() => {
      transport.sendCommand(state.id, { type: 'ADVANCE_TICK' }).catch(() => undefined);
    }, Math.max(650, 2600 / state.speed));
    return () => clearInterval(interval);
  }, [state?.id, state?.phase, state?.speed, playerId, transport]);

  if (!state) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" />
        <ScrollView contentContainerStyle={styles.entryWrap} keyboardShouldPersistTaps="handled">
          <Text style={styles.brand}>DOMINION</Text>
          <Text style={styles.tagline}>MULTIPLAYER GRAND STRATEGY</Text>
          <EntryPanel onCreate={createRoom} onJoin={joinRoom} />
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
          <View>
            <Text style={styles.brand}>DOMINION</Text>
            <Text style={styles.subbrand}>{gameStarted ? `Ход ${state.tick} · ${state.phase === 'finished' ? 'КАМПАНИЯ ЗАВЕРШЕНА' : 'КАМПАНИЯ'}` : `Комната ${state.roomCode}`}</Text>
          </View>
          <Pressable style={styles.exitButton} onPress={() => setPanelOpen(!panelOpen)}><Text style={styles.exitText}>{panelOpen ? "ЗАКРЫТЬ ПАНЕЛЬ" : "УПРАВЛЕНИЕ"}</Text></Pressable>
          <Pressable style={styles.exitButton} onPress={() => {
            transport.leave(state.id).catch(() => undefined);
            unsubscribeRef.current?.();
            setState(null);
            setPlayerId(null);
            setSelectedProvinceId(null);
            setPreviewCountryId(null);
          }}>
            <Text style={styles.exitText}>ВЫЙТИ</Text>
          </Pressable>
        </View>

        <View style={styles.mapArea}><WorldMap
          state={state}
          selectedCountryId={selectedCountryId}
          selectedProvinceId={selectedProvinceId}
          onSelectProvince={selectProvince}
          onLongPressProvince={selectProvince}
        /></View>

        {panelOpen && <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>

        {!gameStarted && (
          <CountryPanel
            country={selectedCountry}
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
          <GamePanel
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
  panel: { position: 'absolute', right: 8, top: 62, bottom: 12, width: '34%', maxWidth: 410, minWidth: 250, backgroundColor: '#111A2Af5', borderRadius: 12 },
  panelContent: { padding: 8, gap: 10 },
  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, gap: 8 },
  brand: { color: '#F4F7FC', fontSize: 22, fontWeight: '900', letterSpacing: 2.2 },
  tagline: { color: '#61718A', fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 5 },
  subbrand: { color: '#6F7F99', fontSize: 11, marginTop: 2 },
  footer: { color: '#46546A', textAlign: 'center', fontSize: 10, letterSpacing: 0.4 },
  exitButton: { backgroundColor: '#151F30', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 9 },
  exitText: { color: '#9BABBF', fontWeight: '900', fontSize: 10 },
});
