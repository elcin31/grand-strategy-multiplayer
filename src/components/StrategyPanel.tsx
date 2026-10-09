import {colors,tokens} from '../ui/tokens';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { GameCommand, GameState } from '../types/game';
import { TECHNOLOGIES, TECHNOLOGY_BRANCHES, researchQuote, techLevel } from '../../supabase/functions/_shared/technologySystem';

export interface StrategyProps { initialOpen?:boolean; state: GameState; playerId: string; onCommand: (command: GameCommand) => void }
export function StrategyPanel({ state, playerId, onCommand, initialOpen }: StrategyProps) {
  const [open, setOpen] = useState(initialOpen??false);
  const countryId = state.players.find(p => p.id === playerId)?.countryId;
  if (!state.dataset || !countryId) return null;
  const c = state.countries[countryId]!;
  return <View style={styles.wrap}>
    <Pressable accessibilityRole="button" style={styles.button} onPress={() => setOpen(!open)}><Text style={styles.title}>Технологии {open ? '▴' : '▾'}</Text></Pressable>
    {open && <View style={styles.card}>
      <Text style={styles.text}>{c.research ? `${TECHNOLOGIES[c.research.branch].name}: ${c.research.progress.toFixed(1)} / ${c.research.required} мес. исследования` : 'Выберите исследование. Одновременно доступен один проект.'}</Text>
      <Text style={styles.text}>Университеты и правительство влияют на скорость. При банкротстве работа приостановлена.</Text>
      <ScrollView horizontal contentContainerStyle={styles.row}>
        {TECHNOLOGY_BRANCHES.map(branch => { const q = researchQuote(c, branch); const disabled = !!c.research || q.targetLevel > 5 || c.treasury < q.cost || state.tick < (c.bankruptcyUntilTick ?? 0) || !['running','paused'].includes(state.phase); return <Pressable key={branch} accessibilityRole="button" accessibilityLabel={`Исследовать ${TECHNOLOGIES[branch].name}`} disabled={disabled} style={[styles.option, disabled && styles.disabled]} onPress={() => onCommand({ type: 'START_RESEARCH', playerId, branch })}>
          <Text style={styles.title}>{TECHNOLOGIES[branch].name} · {techLevel(c, branch)}/5</Text><Text style={styles.text}>{TECHNOLOGIES[branch].effect}</Text><Text style={styles.text}>{q.targetLevel > 5 ? 'Максимум' : `$${q.cost}M · ${q.months} базовых мес.`}</Text>
        </Pressable>; })}
      </ScrollView>
    </View>}
  </View>;
}
export const styles = StyleSheet.create({wrap:{gap:8}, card:{backgroundColor:colors.surface,borderRadius:tokens.radius.panel,padding:14,gap:10},button:{backgroundColor:colors.raised,borderRadius:tokens.radius.panel,padding:13,minHeight:44,alignItems:'center'},row:{gap:8},option:{backgroundColor:colors.raised,padding:12,borderRadius:tokens.radius.panel,width:200,flexShrink:0,gap:8},title: { fontFamily:tokens.typography.display,color:colors.parchment,fontSize:12,fontWeight:'800'},text:{color:colors.muted,fontSize:12,lineHeight:18},disabled:{opacity:.4}});
