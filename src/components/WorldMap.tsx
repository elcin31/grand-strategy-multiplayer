import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { G, Rect, Text as SvgText } from 'react-native-svg';
import { CountryId, GameState, Province } from '../types/game';

interface WorldMapProps { state: GameState; selectedCountryId: CountryId | null; onSelectCountry: (countryId: CountryId) => void; }
const MAP_WIDTH = 720;
const MAP_HEIGHT = 340;

function ProvinceShape({ province, state, selected, onPress }: { province: Province; state: GameState; selected: boolean; onPress: () => void }) {
  const country = state.countries[province.ownerId];
  return (
    <G onPress={onPress}>
      <Rect x={province.x} y={province.y} width={province.width} height={province.height} rx={8} fill={country.color} opacity={selected ? 1 : 0.82} stroke={selected ? '#FFFFFF' : '#141C2D'} strokeWidth={selected ? 3 : 1.5} />
      <SvgText x={province.x + province.width / 2} y={province.y + province.height / 2 + 3} fontSize={11} fontWeight="700" fill="#F7F9FC" textAnchor="middle">{country.shortName}</SvgText>
    </G>
  );
}

export function WorldMap({ state, selectedCountryId, onSelectCountry }: WorldMapProps) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View><Text style={styles.eyebrow}>ЕВРОПА · ПРОТОТИП КАРТЫ</Text><Text style={styles.title}>Выберите государство</Text></View>
        <Text style={styles.date}>{state.month.toString().padStart(2, '0')}/{state.year}</Text>
      </View>
      <View style={styles.mapFrame}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}>
          <Rect x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT} fill="#0B1422" rx="20" />
          {state.provinces.map((province) => <ProvinceShape key={province.id} province={province} state={state} selected={selectedCountryId === province.ownerId} onPress={() => onSelectCountry(province.ownerId)} />)}
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#111A2A', borderRadius: 22, padding: 16, borderWidth: 1, borderColor: '#202C40' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  eyebrow: { color: '#7E8DA7', fontSize: 10, letterSpacing: 1.1, fontWeight: '800' },
  title: { color: '#F7F9FC', fontSize: 20, fontWeight: '800', marginTop: 4 },
  date: { color: '#AFC2E5', fontWeight: '700' },
  mapFrame: { height: 260, overflow: 'hidden', borderRadius: 18 },
});
