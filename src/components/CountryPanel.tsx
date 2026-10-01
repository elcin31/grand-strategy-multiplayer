import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { getWorldFlag } from '../world/catalog';
import { Country, Province } from '../types/game';

interface CountryPanelProps { country: Country | null; provinces: Province[]; locked: boolean; onChoose: () => void; }
const compact = (value: number) => new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

export function CountryPanel({ country, provinces, locked, onChoose }: CountryPanelProps) {
  if (!country) return <View style={styles.card}><Text style={styles.title}>Государство не выбрано</Text><Text style={styles.muted}>Нажмите на страну на карте.</Text></View>;
  const flag = country.flag ? getWorldFlag(country.id) : null;
  return (
    <View style={styles.card}>
      <View style={styles.row}><View style={[styles.flag, { backgroundColor: country.color }]}>{flag && <SvgXml xml={flag} width={42} height={32} />}</View><View style={styles.grow}><Text style={styles.title}>{country.name}</Text><Text style={styles.muted}>{provinces.length} пров. · Tech {country.technology}</Text></View><Text style={styles.stability}>{country.stability}%</Text></View>
      <View style={styles.metrics}>
        <Metric label="Казна" value={`$${compact(country.treasury)}M`} /><Metric label="Доход" value={`+$${compact(country.income)}M`} /><Metric label="Население" value={compact(country.population)} /><Metric label="Армия" value={compact(country.army)} />
      </View>
      <Pressable onPress={onChoose} disabled={locked} style={({ pressed }) => [styles.button, pressed && !locked && styles.buttonPressed, locked && styles.buttonDisabled]}><Text style={styles.buttonText}>{locked ? 'УЖЕ ВЫБРАНО' : 'ИГРАТЬ ЗА ЭТУ СТРАНУ'}</Text></Pressable>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>; }

const styles = StyleSheet.create({
  card: { backgroundColor: '#111A2A', borderRadius: 22, padding: 16, borderWidth: 1, borderColor: '#202C40', gap: 16 }, row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, grow: { flex: 1 }, flag: { width: 42, height: 42, borderRadius: 12 }, title: { color: '#F7F9FC', fontSize: 18, fontWeight: '800' }, muted: { color: '#8290A8', fontSize: 12, marginTop: 3, lineHeight: 18 }, stability: { color: '#A6D7B9', fontSize: 16, fontWeight: '800' }, metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, metric: { width: '47%', backgroundColor: '#0C1422', borderRadius: 14, padding: 12 }, metricLabel: { color: '#6E7D96', fontSize: 11, fontWeight: '700' }, metricValue: { color: '#F7F9FC', fontSize: 16, fontWeight: '800', marginTop: 4 }, button: { backgroundColor: '#E9EEF8', borderRadius: 14, alignItems: 'center', paddingVertical: 14 }, buttonPressed: { opacity: 0.8 }, buttonDisabled: { backgroundColor: '#283347' }, buttonText: { color: '#0A1020', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
});
