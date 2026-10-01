import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { countryFor, GameCommand, GameState } from '../types/game';
import { GOVERNMENT_CHANGE_COST, GOVERNMENT_COOLDOWN_TICKS, GOVERNMENT_STABILITY_COST, GOVERNMENT_TYPES, governmentModifiers } from '../../supabase/functions/_shared/governmentSystem';

interface GamePanelProps {
  state: GameState;
  playerId: string;
  selectedProvinceId: string | null;
  onCommand: (command: GameCommand) => void;
}

const compact = (value: number) => value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M` : value >= 1_000 ? `${Math.round(value / 1_000)}K` : String(value);

export function GamePanel({ state, playerId, selectedProvinceId, onCommand }: GamePanelProps) {
  const [governmentOpen, setGovernmentOpen] = useState(false);
  const me = state.players.find((player) => player.id === playerId);
  const countryId = me?.countryId ?? null;
  if (!countryId) return null;
  const nation = countryFor(state, countryId);
  const ruler = nation.rulerId ? state.leaders?.[nation.rulerId] : undefined;
  const selected = state.provinces.find((province) => province.id === selectedProvinceId) ?? null;
  const ownArmies = selected ? state.armies.filter((army) => army.provinceId === selected.id && army.ownerId === countryId).sort((a, b) => b.troops - a.troops) : [];
  const primaryArmy = ownArmies[0] ?? null;
  const neighbors = selected ? selected.neighbors.map((id) => state.provinces.find((province) => province.id === id)).filter(Boolean) : [];
  const isOwnProvince = selected?.ownerId === countryId;
  const cooldown = Math.max(0, (nation.governmentCooldownUntilTick ?? 0) - state.tick);
  const politicalPower = nation.politicalPower ?? 0;
  const signed = (value: number) => `${value >= 0 ? '+' : ''}${value}`;

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>ТВОЁ ГОСУДАРСТВО</Text>
            <Text style={styles.title}>{nation.name}</Text>
          </View>
          <View style={styles.dateBadge}><Text style={styles.dateText}>{String(state.month).padStart(2, '0')}/{state.year}</Text></View>
        </View>
        {ruler && <View style={styles.rulerRow}><View style={[styles.rulerPortrait,{backgroundColor:['#526E75','#765F70','#6E7455','#756448','#516481','#7A6252'][ruler.portraitSeed%6]}]}><Text style={styles.rulerInitials}>{ruler.name.split(/\s+/).map(part=>part[0]).slice(0,2).join('')}</Text></View><View><Text style={styles.rulerLabel}>ВЫМЫШЛЕННЫЙ ПРАВИТЕЛЬ · {ruler.age}</Text><Text style={styles.rulerName}>{ruler.name}</Text><Text style={styles.rulerDetails}>{ruler.ideology} · дипломатия {ruler.diplomaticSkill}</Text></View></View>}
        <View style={styles.metrics}>
          <Metric label="Казна" value={`$${compact(nation.treasury)}M`} />
          <Metric label="Доход" value={`+$${compact(nation.income)}M`} />
          <Metric label="Армия" value={compact(nation.army)} />
          <Metric label="Manpower" value={compact(nation.manpower)} />
        </View>
        <View style={styles.speedRow}>
          <Text style={styles.speedLabel}>{me?.isHost ? 'СКОРОСТЬ' : `СКОРОСТЬ · ${state.speed}×`}</Text>
          {me?.isHost && [0, 1, 2, 3, 4].map((speed) => (
            <Pressable key={speed} style={[styles.speedButton, state.speed === speed && styles.speedActive]} onPress={() => onCommand({ type: 'SET_SPEED', playerId, speed: speed as 0 | 1 | 2 | 3 | 4 })}>
              <Text style={[styles.speedText, state.speed === speed && styles.speedTextActive]}>{speed === 0 ? 'Ⅱ' : `${speed}×`}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {state.dataset && <Pressable accessibilityRole="button" onPress={() => setGovernmentOpen(!governmentOpen)} style={styles.secondaryButton}><Text style={styles.secondaryText}>Правительство {governmentOpen ? '▴' : '▾'}</Text></Pressable>}
      {governmentOpen && state.dataset && <View style={styles.card}>
        <Text style={styles.eyebrow}>ФОРМА ПРАВЛЕНИЯ · {Math.floor(politicalPower)} PP</Text>
        <Text style={styles.govCurrent}>{nation.governmentType}</Text>
        <Text style={styles.hint}>Смена: {GOVERNMENT_CHANGE_COST} PP, −{GOVERNMENT_STABILITY_COST} стабильности; cooldown {GOVERNMENT_COOLDOWN_TICKS} мес.</Text>
        {cooldown > 0 && <Text style={styles.hint}>Следующая смена через {cooldown} мес.</Text>}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.routes}>
          {GOVERNMENT_TYPES.map(governmentType => {
            const modifiers = governmentModifiers(governmentType);
            const active = governmentType === nation.governmentType;
            const disabled = active || cooldown > 0 || politicalPower < GOVERNMENT_CHANGE_COST;
            return <Pressable accessibilityRole="button" accessibilityState={{ disabled, selected: active }} key={governmentType} disabled={disabled} style={[styles.govOption, disabled && styles.disabled, active && styles.govSelected]} onPress={() => onCommand({ type: 'CHANGE_GOVERNMENT', playerId, governmentType })}>
              <Text style={styles.govName}>{governmentType}</Text>
              <Text style={styles.govDetails}>Налоги {signed(modifiers.taxationPercent)}% · Manpower {signed(modifiers.manpowerPercent)}%</Text>
              <Text style={styles.govDetails}>Research {signed(modifiers.researchPercent)}% · Дипломатия {signed(modifiers.diplomacy)}</Text>
              <Text style={styles.govDetails}>Стабильность {signed(modifiers.stabilityPerYear)}/год · Unrest {signed(modifiers.unrestPerYear)}/год</Text>
            </Pressable>;
          })}
        </ScrollView>
        <Text style={styles.hint}>Репутация: {nation.diplomaticReputation?.toFixed(0)} · стабильность {nation.stability.toFixed(1)} · unrest {nation.unrest?.toFixed(1)}</Text>
      </View>}

      <View style={styles.card}>
        <Text style={styles.eyebrow}>КОМАНДОВАНИЕ</Text>
        {!selected ? (
          <Text style={styles.hint}>Нажми на провинцию на карте. Там будут армия, набор и доступные направления движения.</Text>
        ) : (
          <>
            <View style={styles.provinceTitleRow}>
              <View>
                <Text style={styles.title}>{selected.name}</Text>
                <Text style={styles.owner}>{countryFor(state, selected.ownerId).name} · доход ${selected.income}M</Text>
              </View>
              <View style={[styles.ownerDot, { backgroundColor: countryFor(state, selected.ownerId).color }]} />
            </View>

            {isOwnProvince && (
              <View style={styles.recruitRow}>
                <Pressable style={styles.primaryButton} onPress={() => onCommand({ type: 'RECRUIT', playerId, provinceId: selected.id, troops: 10_000 })}>
                  <Text style={styles.primaryText}>+10K войск · $200M</Text>
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={() => onCommand({ type: 'RECRUIT', playerId, provinceId: selected.id, troops: 25_000 })}>
                  <Text style={styles.secondaryText}>+25K · $500M</Text>
                </Pressable>
              </View>
            )}

            <Text style={styles.sectionTitle}>Армии в провинции</Text>
            {state.armies.filter((army) => army.provinceId === selected.id).length === 0 ? <Text style={styles.muted}>Нет армий</Text> : state.armies.filter((army) => army.provinceId === selected.id).map((army) => (
              <View key={army.id} style={styles.armyRow}>
                <Text style={styles.armyOwner}>{countryFor(state, army.ownerId).shortName}</Text>
                <Text style={styles.armyTroops}>{compact(army.troops)}</Text>
              </View>
            ))}

            {isOwnProvince && (
              <>
                <Text style={styles.sectionTitle}>Соседние провинции</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.routes}>
                  {neighbors.map((neighbor) => {
                    if (!neighbor) return null;
                    const enemy = neighbor.ownerId !== countryId;
                    return (
                      <Pressable
                        key={neighbor.id}
                        disabled={!primaryArmy}
                        style={[styles.route, enemy && styles.routeEnemy, !primaryArmy && styles.disabled]}
                        onPress={() => primaryArmy && onCommand({ type: 'MOVE_ARMY', playerId, armyId: primaryArmy.id, provinceId: neighbor.id })}
                      >
                        <Text style={styles.routeName}>{neighbor.name}</Text>
                        <Text style={[styles.routeAction, enemy && styles.attackText]}>{!primaryArmy ? 'НЕТ АРМИИ' : enemy ? 'АТАКОВАТЬ' : 'ПЕРЕМЕСТИТЬ'}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </>
            )}
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>ВОЕННАЯ СВОДКА</Text>
        {state.battleLog.length === 0 ? <Text style={styles.hint}>Боёв пока не было.</Text> : state.battleLog.slice(0, 6).map((battle) => (
          <View key={battle.id} style={styles.logRow}>
            <View style={styles.logTop}><Text style={styles.logMessage}>{battle.message}</Text><Text style={styles.logTick}>#{battle.tick}</Text></View>
            <Text style={styles.logLoss}>Потери: {countryFor(state, battle.attackerId).shortName} −{compact(battle.attackerLosses)} · {countryFor(state, battle.defenderId).shortName} −{compact(battle.defenderLosses)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  govCurrent: { color: '#E5ECF7', fontSize: 14, fontWeight: '800' },
  govOption: { width: 210, backgroundColor: '#152136', borderRadius: 12, padding: 12, gap: 7, borderWidth: 1, borderColor: '#263650' },
  govSelected: { borderColor: '#91B8DE' },
  govName: { color: '#E5ECF7', fontSize: 12, fontWeight: '800' },
  govDetails: { color: '#90A0B8', fontSize: 10, lineHeight: 15 },
  card: { backgroundColor: '#111A2A', borderRadius: 22, padding: 16, borderWidth: 1, borderColor: '#202C40', gap: 13 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rulerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#0C1422', borderRadius: 12, padding: 10 },
  rulerPortrait: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  rulerInitials: { color: '#F7F9FC', fontSize: 13, fontWeight: '900' },
  rulerLabel: { color: '#8290A8', fontSize: 8, fontWeight: '900', letterSpacing: 0.4 },
  rulerName: { color: '#F7F9FC', fontSize: 13, fontWeight: '800', marginTop: 2 },
  rulerDetails: { color: '#8290A8', fontSize: 9, marginTop: 2 },
  eyebrow: { color: '#7E8DA7', fontSize: 10, letterSpacing: 1.1, fontWeight: '900' },
  title: { color: '#F7F9FC', fontSize: 20, fontWeight: '900', marginTop: 4 },
  dateBadge: { backgroundColor: '#18243A', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 12 },
  dateText: { color: '#C7D5ED', fontWeight: '900', fontSize: 11 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: { width: '47%', backgroundColor: '#0C1422', borderRadius: 14, padding: 12 },
  metricLabel: { color: '#718199', fontSize: 10, fontWeight: '800' },
  metricValue: { color: '#F7F9FC', fontSize: 16, fontWeight: '900', marginTop: 4 },
  speedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  speedLabel: { color: '#6F7F99', fontSize: 9, fontWeight: '900', marginRight: 3 },
  speedButton: { flex: 1, alignItems: 'center', paddingVertical: 9, backgroundColor: '#1B2739', borderRadius: 11 },
  speedActive: { backgroundColor: '#E8EEF8' },
  speedText: { color: '#8191A8', fontWeight: '900', fontSize: 11 },
  speedTextActive: { color: '#111827' },
  hint: { color: '#8796AC', fontSize: 13, lineHeight: 19 },
  provinceTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  owner: { color: '#8494AA', fontSize: 11, marginTop: 3 },
  ownerDot: { width: 14, height: 14, borderRadius: 7 },
  recruitRow: { flexDirection: 'row', gap: 8 },
  primaryButton: { flex: 1.2, backgroundColor: '#E8EEF8', borderRadius: 13, paddingVertical: 12, alignItems: 'center' },
  primaryText: { color: '#0D1522', fontWeight: '900', fontSize: 11 },
  secondaryButton: { flex: 1, backgroundColor: '#1B2739', borderRadius: 13, paddingVertical: 12, alignItems: 'center' },
  secondaryText: { color: '#C2D0E6', fontWeight: '900', fontSize: 11 },
  sectionTitle: { color: '#687991', fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginTop: 2 },
  muted: { color: '#65758B', fontSize: 12 },
  armyRow: { backgroundColor: '#0C1422', borderRadius: 12, padding: 11, flexDirection: 'row', justifyContent: 'space-between' },
  armyOwner: { color: '#A9BAD2', fontSize: 11, fontWeight: '900' },
  armyTroops: { color: '#F7F9FC', fontWeight: '900' },
  routes: { gap: 8, paddingRight: 4 },
  route: { width: 145, backgroundColor: '#152136', borderRadius: 13, padding: 11, borderWidth: 1, borderColor: '#263650' },
  routeEnemy: { backgroundColor: '#28171C', borderColor: '#5A2932' },
  disabled: { opacity: 0.45 },
  routeName: { color: '#E5ECF7', fontSize: 11, fontWeight: '800' },
  routeAction: { color: '#8EB7EA', fontSize: 9, fontWeight: '900', marginTop: 6 },
  attackText: { color: '#F39AA7' },
  logRow: { borderTopWidth: 1, borderTopColor: '#1D293C', paddingTop: 10 },
  logTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  logMessage: { color: '#DDE7F6', fontSize: 12, fontWeight: '800', flex: 1 },
  logTick: { color: '#61718A', fontSize: 10 },
  logLoss: { color: '#77879D', fontSize: 10, marginTop: 4 },
});
