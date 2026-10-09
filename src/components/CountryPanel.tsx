import {LeaderPortrait,Crest} from './Heraldry';
import {colors,tokens} from '../ui/tokens';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { getWorldFlag } from '../world/catalog';
import type { Country, Leader, Province } from '../types/game';

interface CountryPanelProps { country: Country | null; leader?: Leader | null; provinces: Province[]; locked: boolean; onChoose: () => void; }
const compact = (value: number) => new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

export function CountryPanel({ country, leader, provinces, locked, onChoose }: CountryPanelProps) {
  if (!country) return <View style={styles.card}><Text style={styles.title}>Государство не выбрано</Text><Text style={styles.muted}>Нажмите на страну на карте.</Text></View>;
  const flag = country.flag ? getWorldFlag(country.id) : null;
  return (
    <View style={styles.card}>
      <View style={styles.row}><View style={[styles.flag, { backgroundColor: country.color }]}>{flag && <SvgXml xml={flag} width={42} height={32} />}</View><View style={styles.grow}><Text style={styles.title}>{country.name}</Text><Text style={styles.muted}>{provinces.length} пров. · Tech {country.technology}</Text></View><Crest color={country.color}/><Text style={styles.stability}>{country.stability}%</Text></View>
      {leader && <View style={styles.leaderRow}><LeaderPortrait seed={leader.portraitSeed}/><View style={styles.grow}><Text style={styles.leaderLabel}>ГЛАВА ГОСУДАРСТВА · ВЫМЫШЛЕННЫЙ ПЕРСОНАЖ</Text><Text style={styles.leaderName}>{leader.name} · {leader.age}</Text><Text style={styles.muted}>{leader.ideology} · {leader.traits.join(' · ')}</Text></View></View>}
      <View style={styles.metrics}>
        <Metric label="Казна" value={`$${compact(country.treasury)}M`} /><Metric label="Доход" value={`+$${compact(country.income)}M`} /><Metric label="Население" value={compact(country.population)} /><Metric label="Армия" value={compact(country.army)} />
      </View>
      <Pressable onPress={onChoose} disabled={locked} style={({ pressed }) => [styles.button, pressed && !locked && styles.buttonPressed, locked && styles.buttonDisabled]}><Text style={styles.buttonText}>{locked ? 'УЖЕ ВЫБРАНО' : 'ИГРАТЬ ЗА ЭТУ СТРАНУ'}</Text></Pressable>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>; }

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius:tokens.radius.panel, padding: 16, borderWidth: 1, borderColor: colors.raised, gap: 16 }, row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, leaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: colors.inset, borderRadius:tokens.radius.panel }, portrait: { width: 44, height: 44, borderRadius:tokens.radius.panel, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FFFFFF30' }, portraitInitials: { color: colors.parchment, fontSize: 15, fontWeight: '900' }, leaderLabel: { color: colors.muted, fontSize: 8, fontWeight: '800', letterSpacing: 0.4 }, leaderName: { color: colors.parchment, fontSize: 14, fontWeight: '800', marginTop: 3 }, grow: { flex: 1 }, flag: { width: 42, height: 42, borderRadius:tokens.radius.panel }, title: { fontFamily:tokens.typography.display, color: colors.parchment, fontSize: 18, fontWeight: '800' }, muted: { color: colors.muted, fontSize: 12, marginTop: 3, lineHeight: 18 }, stability: { color: '#A6D7B9', fontSize: 16, fontWeight: '800' }, metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, metric: { width: '47%', backgroundColor: colors.inset, borderRadius:tokens.radius.panel, padding: 12 }, metricLabel: { color: colors.muted, fontSize: 11, fontWeight: '700' }, metricValue: { fontVariant:['tabular-nums'], color: colors.parchment, fontSize: 16, fontWeight: '800', marginTop: 4 }, button: { backgroundColor: colors.parchment, borderRadius:tokens.radius.panel, alignItems: 'center', paddingVertical: 14 }, buttonPressed: { opacity: 0.8 }, buttonDisabled: { backgroundColor: '#283347' }, buttonText: { color: colors.graphite, fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
});
