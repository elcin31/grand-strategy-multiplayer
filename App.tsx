import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { CountryPanel } from './src/components/CountryPanel';
import { EntryPanel, LobbyPanel } from './src/components/LobbyPanel';
import { WorldMap } from './src/components/WorldMap';
import { HttpTransport } from './src/multiplayer/httpTransport';
import type { MultiplayerTransport, TransportSession } from './src/multiplayer/transport';
import { CountryId, GameState } from './src/types/game';

const productionMultiplayerUrl = 'https://dfjsnjxnyjspwugjguhq.supabase.co/functions/v1';
const remoteUrl = process.env.EXPO_PUBLIC_MULTIPLAYER_URL?.trim() || productionMultiplayerUrl;
const transport: MultiplayerTransport = new HttpTransport(remoteUrl);

export default function App() {
  const [state, setState] = useState<GameState | null>(null);
  const [previewCountryId, setPreviewCountryId] = useState<CountryId | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const unsubscribeRef = useRef<null | (() => void)>(null);

  useEffect(() => () => unsubscribeRef.current?.(), []);

  const attach = (session: TransportSession) => {
    unsubscribeRef.current?.();
    setPlayerId(session.playerId);
    setState(session.state);
    unsubscribeRef.current = transport.subscribe(session.state.id, setState);
  };

  const selectedCountryId = previewCountryId ?? state?.selectedCountryId ?? null;
  const selectedCountry = state && selectedCountryId ? state.countries[selectedCountryId] : null;
  const selectedProvinces = state && selectedCountryId ? state.provinces.filter((province) => province.ownerId === selectedCountryId) : [];

  const safeAction = async (action: () => Promise<void>) => {
    try { await action(); }
    catch (error) { Alert.alert('Действие отклонено', error instanceof Error ? error.message : 'Неизвестная ошибка'); }
  };

  const createRoom = (name: string) => safeAction(async () => attach(await transport.createRoom(name)));
  const joinRoom = (room: string, name: string) => safeAction(async () => attach(await transport.joinRoom(room, name)));

  const chooseCountry = () => {
    if (!state || !selectedCountryId || !playerId) return;
    safeAction(() => transport.sendCommand(state.id, { type: 'SELECT_COUNTRY', playerId, countryId: selectedCountryId }));
  };

  const myCountryId = state?.players.find((player) => player.id === playerId)?.countryId ?? null;
  const gameRunning = state?.phase === 'running' || state?.phase === 'paused';

  useEffect(() => {
    if (!state || !playerId || state.phase !== 'running' || state.speed === 0) return;
    const me = state.players.find((player) => player.id === playerId);
    if (!me?.isHost) return;
    const interval = setInterval(() => {
      transport.sendCommand(state.id, { type: 'ADVANCE_TICK' }).catch(() => undefined);
    }, Math.max(650, 2600 / state.speed));
    return () => clearInterval(interval);
  }, [state?.id, state?.phase, state?.speed, playerId]);

  if (!state) {
    return <SafeAreaView style={styles.safe}><StatusBar barStyle="light-content" /><View style={styles.entryWrap}><Text style={styles.brand}>DOMINION</Text><EntryPanel onCreate={createRoom} onJoin={joinRoom} /><Text style={styles.footer}>REMOTE SERVER · SUPABASE</Text></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topbar}><View><Text style={styles.brand}>DOMINION</Text><Text style={styles.subbrand}>{gameRunning ? `Ход ${state.tick}` : 'Подготовка кампании'}</Text></View><Pressable style={styles.exitButton} onPress={() => { transport.leave(state.id).catch(() => undefined); unsubscribeRef.current?.(); setState(null); setPlayerId(null); }}><Text style={styles.exitText}>ВЫЙТИ</Text></Pressable></View>
        <WorldMap state={state} selectedCountryId={selectedCountryId} onSelectCountry={setPreviewCountryId} />
        {!gameRunning && <CountryPanel country={selectedCountry} provinces={selectedProvinces} locked={Boolean(selectedCountryId && myCountryId === selectedCountryId)} onChoose={chooseCountry} />}
        {!gameRunning ? <LobbyPanel state={state} playerId={playerId ?? ''} onReady={(ready) => playerId && safeAction(() => transport.sendCommand(state.id, { type: 'SET_READY', playerId, ready }))} onStart={() => playerId && safeAction(() => transport.sendCommand(state.id, { type: 'START_GAME', playerId }))} /> : <GameHUD state={state} myCountryId={myCountryId} playerId={playerId ?? ''} />}
      </ScrollView>
    </SafeAreaView>
  );
}

function GameHUD({ state, myCountryId, playerId }: { state: GameState; myCountryId: CountryId | null; playerId: string }) {
  const country = myCountryId ? state.countries[myCountryId] : null;
  if (!country) return null;
  return <View style={styles.hud}><Text style={styles.hudTitle}>{country.name}</Text><View style={styles.hudMetrics}><HudMetric label="Казна" value={`$${country.treasury}M`} /><HudMetric label="Доход" value={`+$${country.income}M`} /><HudMetric label="Армия" value={country.army.toLocaleString('ru-RU')} /><HudMetric label="Manpower" value={country.manpower.toLocaleString('ru-RU')} /></View><View style={styles.speedRow}>{[0,1,2,3,4].map((speed) => <Pressable key={speed} style={[styles.speedButton, state.speed === speed && styles.speedActive]} onPress={() => transport.sendCommand(state.id, { type: 'SET_SPEED', playerId, speed: speed as 0|1|2|3|4 }).catch(() => undefined)}><Text style={styles.speedText}>{speed === 0 ? 'Ⅱ' : `${speed}×`}</Text></Pressable>)}</View></View>;
}

function HudMetric({ label, value }: { label: string; value: string }) { return <View style={styles.hudMetric}><Text style={styles.hudLabel}>{label}</Text><Text style={styles.hudValue}>{value}</Text></View>; }

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#070C15' }, entryWrap: { flex: 1, justifyContent: 'center', padding: 18, gap: 18 }, content: { padding: 14, gap: 12, paddingBottom: 30 }, topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 6 }, brand: { color: '#F4F7FC', fontSize: 22, fontWeight: '900', letterSpacing: 2.2 }, subbrand: { color: '#6F7F99', fontSize: 11, marginTop: 2 }, footer: { color: '#46546A', textAlign: 'center', fontSize: 10, letterSpacing: 0.4 }, exitButton: { backgroundColor: '#151F30', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 9 }, exitText: { color: '#9BABBF', fontWeight: '900', fontSize: 10 }, hud: { backgroundColor: '#111A2A', borderRadius: 22, padding: 16, borderWidth: 1, borderColor: '#202C40', gap: 14 }, hudTitle: { color: '#F7F9FC', fontSize: 20, fontWeight: '900' }, hudMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, hudMetric: { width: '47%', backgroundColor: '#0C1422', borderRadius: 14, padding: 12 }, hudLabel: { color: '#718199', fontSize: 10, fontWeight: '800' }, hudValue: { color: '#F7F9FC', fontSize: 15, fontWeight: '900', marginTop: 4 }, speedRow: { flexDirection: 'row', gap: 7 }, speedButton: { flex: 1, alignItems: 'center', paddingVertical: 11, backgroundColor: '#1B2739', borderRadius: 12 }, speedActive: { backgroundColor: '#E8EEF8' }, speedText: { color: '#8191A8', fontWeight: '900' } });
