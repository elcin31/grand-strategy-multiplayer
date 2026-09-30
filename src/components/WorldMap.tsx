import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { CountryId, GameState, Province } from '../types/game';

interface WorldMapProps {
  state: GameState;
  selectedCountryId: CountryId | null;
  selectedProvinceId: string | null;
  onSelectProvince: (province: Province) => void;
}

const MAP_WIDTH = 720;
const MAP_HEIGHT = 340;
const compact = (value: number) => value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M` : value >= 1_000 ? `${Math.round(value / 1_000)}K` : String(value);

function ProvinceShape({ province, state, selected, onPress }: { province: Province; state: GameState; selected: boolean; onPress: () => void }) {
  const country = state.countries[province.ownerId];
  const troops = state.armies.filter((army) => army.provinceId === province.id).reduce((sum, army) => sum + army.troops, 0);
  const cx = province.x + province.width / 2;
  const cy = province.y + province.height / 2;
  return (
    <G onPress={onPress}>
      <Rect x={province.x} y={province.y} width={province.width} height={province.height} rx={8} fill={country.color} opacity={selected ? 1 : 0.84} stroke={selected ? '#FFFFFF' : '#141C2D'} strokeWidth={selected ? 3 : 1.5} />
      <SvgText x={cx} y={cy - (troops ? 4 : -3)} fontSize={10} fontWeight="800" fill="#F7F9FC" textAnchor="middle">{country.shortName}</SvgText>
      {troops > 0 && (
        <G>
          <Circle cx={cx} cy={cy + 13} r={11} fill="#08101C" opacity={0.9} stroke="#B9C8DD" strokeWidth={0.7} />
          <SvgText x={cx} y={cy + 16} fontSize={7.5} fontWeight="900" fill="#F7F9FC" textAnchor="middle">{compact(troops)}</SvgText>
        </G>
      )}
    </G>
  );
}

export function WorldMap({ state, selectedCountryId, selectedProvinceId, onSelectProvince }: WorldMapProps) {
  const running = state.phase === 'running' || state.phase === 'paused' || state.phase === 'finished';
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>ЕВРОПА · {running ? 'ТЕАТР ВОЕННЫХ ДЕЙСТВИЙ' : 'ВЫБОР СТРАНЫ'}</Text>
          <Text style={styles.title}>{running ? 'Карта кампании' : 'Выберите государство'}</Text>
        </View>
        <Text style={styles.date}>{String(state.month).padStart(2, '0')}/{state.year}</Text>
      </View>
      <View style={styles.mapFrame}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}>
          <Rect x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT} fill="#0B1422" rx="20" />
          {state.provinces.flatMap((province) => province.neighbors.filter((neighborId) => province.id < neighborId).map((neighborId) => {
            const neighbor = state.provinces.find((candidate) => candidate.id === neighborId);
            if (!neighbor) return null;
            return <Line key={`${province.id}-${neighbor.id}`} x1={province.x + province.width / 2} y1={province.y + province.height / 2} x2={neighbor.x + neighbor.width / 2} y2={neighbor.y + neighbor.height / 2} stroke="#26354A" strokeWidth={1.4} strokeDasharray="4 5" />;
          }))}
          {state.provinces.map((province) => (
            <ProvinceShape
              key={province.id}
              province={province}
              state={state}
              selected={running ? selectedProvinceId === province.id : selectedCountryId === province.ownerId}
              onPress={() => onSelectProvince(province)}
            />
          ))}
        </Svg>
      </View>
      <Text style={styles.legend}>{running ? 'Кружок показывает суммарные войска в провинции. Линии показывают разрешённые переходы.' : 'Нажми на территорию страны, затем подтверди выбор ниже.'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#111A2A', borderRadius: 22, padding: 16, borderWidth: 1, borderColor: '#202C40' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  eyebrow: { color: '#7E8DA7', fontSize: 10, letterSpacing: 1.1, fontWeight: '800' },
  title: { color: '#F7F9FC', fontSize: 20, fontWeight: '800', marginTop: 4 },
  date: { color: '#AFC2E5', fontWeight: '700' },
  mapFrame: { height: 280, overflow: 'hidden', borderRadius: 18 },
  legend: { color: '#63738A', fontSize: 10, lineHeight: 15, marginTop: 10 },
});
