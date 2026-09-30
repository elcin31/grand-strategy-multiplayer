import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { CountryPanel } from './src/components/CountryPanel';
import { GamePanel } from './src/components/GamePanel';
import { EntryPanel, LobbyPanel } from './src/components/LobbyPanel';
import { WorldMap } from './src/components/WorldMap';
import { HttpTransport } from './src/multiplayer/httpTransport';
import type { MultiplayerTransport, TransportSession } from './src/multiplayer/transport';
import { CountryId, GameCommand, GameState, Province } from './src/types/game';

const productionMultiplayerUrl = 'https://dfjsnjxnyjspwugjguhq.supabase.co/functions/v1';
const remoteUrl = process.env.EXPO_PUBLIC_MULTIPLAYER_URL?.trim() || productionMultiplayerUrl;
const transport: MultiplayerTransport = new HttpTransport(remoteUrl);

export default function App() {
  const [state, setState] = useState<GameState | null>(null);
  const [previewCountryId, setPreviewCountryId] = useState<CountryId | null>(null);
  const [selectedProvinceId, setSelectedProvinceId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const unsubscribeRef = useRef<null | (() => void)>(null);

  useEffect(() => () => unsubscribeRef.current?.(), []);

  const attach = (session: TransportSession) => {
    unsubscribeRef.current?.();
    setPlayerId(session.playerId);
    setState(session.state);
    setSelectedProvinceId(null);
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

  const sendCommand = (command: GameCommand) => {
    if (!state) return;
    void safeAction(() => transport.sendCommand(state.id, command));
  };

  const myCountryId = state?.players.find((player) => player.id === playerId)?.countryId ?? null;
  const gameStarted = Boolean(state && (state.phase === 'running' || state.phase === 'paused' || state.phase === 'finished'));

  const selectProvince = (province: Province) => {
    if (gameStarted) setSelectedProvinceId(province.id);
    else setPreviewCountryId(province.ownerId);
  };

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
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" />
        <View style={styles.entryWrap}>
          <Text style={styles.brand}>DOMINION</Text>
          <Text style={styles.tagline}>MULTIPLAYER GRAND STRATEGY</Text>
          <EntryPanel onCreate={createRoom} onJoin={joinRoom} />
          <Text style={styles.footer}>REMOTE SERVER · SUPABASE · ANDROID FIRST</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topbar}>
          <View>
            <Text style={styles.brand}>DOMINION</Text>
            <Text style={styles.subbrand}>{gameStarted ? `Ход ${state.tick} · ${state.phase === 'finished' ? 'КАМПАНИЯ ЗАВЕРШЕНА' : 'КАМПАНИЯ'}` : `Комната ${state.roomCode}`}</Text>
          </View>
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

        <WorldMap
          state={state}
          selectedCountryId={selectedCountryId}
          selectedProvinceId={selectedProvinceId}
          onSelectProvince={selectProvince}
        />

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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#070C15' },
  entryWrap: { flex: 1, justifyContent: 'center', padding: 18, gap: 12 },
  content: { padding: 14, gap: 12, paddingBottom: 34 },
  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 6 },
  brand: { color: '#F4F7FC', fontSize: 22, fontWeight: '900', letterSpacing: 2.2 },
  tagline: { color: '#61718A', fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 5 },
  subbrand: { color: '#6F7F99', fontSize: 11, marginTop: 2 },
  footer: { color: '#46546A', textAlign: 'center', fontSize: 10, letterSpacing: 0.4 },
  exitButton: { backgroundColor: '#151F30', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 9 },
  exitText: { color: '#9BABBF', fontWeight: '900', fontSize: 10 },
});
