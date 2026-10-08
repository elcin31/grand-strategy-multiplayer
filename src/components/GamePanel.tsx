import type {Section} from '../ui/landscape';
import { StabilityPanel } from './StabilityPanel';
import { WarPanel } from './WarPanel';
import { DiplomacyPanel } from './DiplomacyPanel';
import { MilitaryPanel } from './MilitaryPanel';
import { StrategyPanel } from './StrategyPanel';
import { BUILDINGS, BUILDING_TYPES, buildingQuote } from '../../supabase/functions/_shared/buildingSystem';
import { RESOURCES, provinceProduction, resourceReport } from '../../supabase/functions/_shared/resourceSystem';
import { useState } from 'react';
import { MIN_TAX_RATE, MAX_TAX_RATE, money } from '../../supabase/functions/_shared/economySystem';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { countryFor, GameCommand, GameState } from '../types/game';
import { RELIGIONS, RELIGION_IDS, RELIGION_CHANGE_COST, RELIGION_STABILITY_COST, RELIGION_COOLDOWN_TICKS } from '../../supabase/functions/_shared/religionSystem';
import { GOVERNMENT_CHANGE_COST, GOVERNMENT_COOLDOWN_TICKS, GOVERNMENT_STABILITY_COST, GOVERNMENT_TYPES, governmentModifiers } from '../../supabase/functions/_shared/governmentSystem';

interface GamePanelProps {
  focusedArmyId?:string|null;
  focusedCityId?:string|null;
  section?:Section;
  onFocusProvince?:(id:string)=>void;
  state: GameState;
  playerId: string;
  selectedProvinceId: string | null;
  onCommand: (command: GameCommand) => void;
}

const compact = (value: number) => value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M` : value >= 1_000 ? `${Math.round(value / 1_000)}K` : String(value);
const currency = (value: number) => `${value < 0 ? '−' : ''}$${Math.abs(value) >= 1000 ? (Math.abs(value)/1000).toFixed(1)+'B' : Math.abs(value).toFixed(3).replace(/\.?0+$/, '')+'M'}`;

export function GamePanel({ focusedArmyId,focusedCityId,state, playerId, selectedProvinceId, onCommand, section='Country', onFocusProvince }: GamePanelProps) {
  const [buildOpen,setBuildOpen]=useState(false);
  const [selectedArmyId, setSelectedArmyId] = useState<string | null>(null);
  const [religionOpen, setReligionOpen] = useState(section==='Religion');
  const [governmentOpen, setGovernmentOpen] = useState(section==='Government');
  const [economyOpen, setEconomyOpen] = useState(section==='Economy');
  const me = state.players.find((player) => player.id === playerId);
  const countryId = me?.countryId ?? null;
  if (!countryId) return null;
  const nation = countryFor(state, countryId);
  const ruler = nation.rulerId ? state.leaders?.[nation.rulerId] : undefined;
  const selected = state.provinces.find((province) => province.id === selectedProvinceId) ?? null;
  const ownArmies = selected ? state.armies.filter((army) => army.provinceId === selected.id && army.ownerId === countryId).sort((a, b) => b.troops - a.troops) : [];
  const primaryArmy = ownArmies.find(a => a.id === (selectedArmyId??focusedArmyId)) ?? ownArmies[0] ?? null;
  const neighbors = selected ? selected.neighbors.map((id) => state.provinces.find((province) => province.id === id)).filter(Boolean) : [];
  const selectedCities = selected ? (state.cities ?? []).filter(c => c.provinceId === selected.id).sort((a,b) => Number(b.id===focusedCityId)-Number(a.id===focusedCityId) || Number(b.isCapital)-Number(a.isCapital) || b.population-a.population).slice(0,3) : [];
  const selectedConstruction = selected ? state.constructions?.find(item => item.provinceId === selected.id) ?? null : null;
  const completedBuildings = selected ? BUILDING_TYPES.filter(type => (selected.buildings?.[type] ?? 0) > 0) : [];
  const isOwnProvince = selected?.ownerId === countryId && (selected.controllerId ?? selected.ownerId) === countryId;
  const cooldown = Math.max(0, (nation.governmentCooldownUntilTick ?? 0) - state.tick);
  const religionCooldown = Math.max(0, (nation.religionCooldownUntilTick ?? 0) - state.tick);
  const politicalPower = nation.politicalPower ?? 0;
  const signed = (value: number) => `${value >= 0 ? '+' : ''}${value}`;
  const budget = nation.economy;
  const resources = economyOpen && state.dataset ? resourceReport(state, countryId) : [];
  const production = selected?.resourceDeposit ? provinceProduction(selected, countryFor(state, selected.ownerId)) : null;
  const availableCredit = budget ? money(Math.max(0, budget.creditLimit - (nation.debt ?? 0))) : 0;
  const loanQuote = money(Math.min(100, availableCredit));
  const repayQuote = money(Math.min(100, nation.debt ?? 0, nation.treasury));
  const bankruptcyMonths = Math.max(0, (nation.bankruptcyUntilTick ?? 0) - state.tick);
  const economicActionsEnabled = state.phase === 'running' || state.phase === 'paused';

  return (
    <View style={styles.wrap}>
      {section==='Country'&&<View style={styles.card}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>ТВОЁ ГОСУДАРСТВО</Text>
            <Text style={styles.title}>{nation.name}</Text>
          </View>
          <View style={styles.dateBadge}><Text style={styles.dateText}>{String(state.month).padStart(2, '0')}/{state.year}</Text></View>
        </View>
        {ruler && <View style={styles.rulerRow}><View style={[styles.rulerPortrait,{backgroundColor:['#526E75','#765F70','#6E7455','#756448','#516481','#7A6252'][ruler.portraitSeed%6]}]}><Text style={styles.rulerInitials}>{ruler.name.split(/\s+/).map(part=>part[0]).slice(0,2).join('')}</Text></View><View style={{flex:1,minWidth:0}}><Text style={styles.rulerLabel}>ВЫМЫШЛЕННЫЙ ПРАВИТЕЛЬ · {ruler.age}</Text><Text style={styles.rulerName}>{ruler.name}</Text><Text style={styles.rulerDetails}>{ruler.ideology} · {ruler.aiPersonality} · дипломатия {ruler.diplomaticSkill}</Text></View></View>}
        <View style={styles.metrics}>
          <Metric label="Казна" value={state.dataset ? currency(nation.treasury) : `$${compact(nation.treasury)}M`} />
          <Metric label={budget ? 'Баланс / мес.' : 'Доход'} value={budget ? (budget.monthlyBalance >= 0 ? '+' : '')+currency(budget.monthlyBalance) : `+$${compact(nation.income)}M`} />
          <Metric label="Армия" value={compact(nation.army)} />
          <Metric label="Manpower" value={compact(nation.manpower)} />
        </View>
        {state.dataset && <Text style={styles.hint}>Население: {compact(nation.population)} · рост за месяц +{compact(nation.monthlyPopulationGrowth ?? 0)}</Text>}
        <View style={styles.speedRow}>
          <Text style={styles.speedLabel}>{me?.isHost ? 'СКОРОСТЬ' : `СКОРОСТЬ · ${state.speed}×`}</Text>
          {me?.isHost && [0, 1, 2, 3, 4].map((speed) => (
            <Pressable key={speed} accessibilityRole="button" accessibilityLabel={speed === 0 ? 'Пауза' : `Скорость ${speed}×`} accessibilityState={{ selected: state.speed === speed }} style={[styles.speedButton, state.speed === speed && styles.speedActive]} onPress={() => onCommand({ type: 'SET_SPEED', playerId, speed: speed as 0 | 1 | 2 | 3 | 4 })}>
              <Text style={[styles.speedText, state.speed === speed && styles.speedTextActive]}>{speed === 0 ? 'Ⅱ' : `${speed}×`}</Text>
            </Pressable>
          ))}
        </View>
      </View>}

      {section==='Economy'&&budget && <Pressable accessibilityRole="button" onPress={() => { setEconomyOpen(!economyOpen); setGovernmentOpen(false); setReligionOpen(false); }} style={styles.secondaryButton}><Text style={styles.secondaryText}>Экономика {economyOpen ? '▴' : '▾'}</Text></Pressable>}
      {economyOpen && budget && <View style={styles.card}>
        <Text style={styles.eyebrow}>МЕСЯЧНЫЙ БЮДЖЕТ</Text>
        <Text style={styles.hint}>Налоги: {nation.taxRate}% · {currency(budget.taxIncome)}</Text>
        <Text style={styles.hint}>Производство зданий: {currency(budget.productionIncome)}</Text>
        <Text style={styles.hint}>Управление: {currency(budget.administrationMaintenance)}</Text>
        <Text style={styles.hint}>Торговля: {currency(budget.tradeIncome)}</Text>
        {state.provinces.some(p => p.resourceDeposit) && <>
          <Text style={styles.hint}>Ресурсы: {currency(budget.resourceIncome)} / мес.</Text>
          {resources.filter(r => r.units > 0).map(r => <Text key={r.type} style={styles.owner}>{RESOURCES[r.type].name}: {r.units.toFixed(1)} ед. · {currency(r.revenue)}/мес.</Text>)}
          <Text style={styles.hint}>Игровые месторождения. Выпуск автоматически продаётся по фиксированным игровым ценам; это не реальные запасы или рыночные котировки.</Text>
        </>}
        <Text style={styles.hint}>Содержание армии: {currency(budget.armyMaintenance)}</Text>
        <Text style={styles.hint}>Содержание зданий: {currency(budget.buildingMaintenance)}</Text>
        <Text style={styles.hint}>Проценты: {currency(budget.interest)} · 0.5% долга / мес.</Text>
        <Text style={styles.hint}>Баланс: {currency(budget.monthlyBalance)} / мес.</Text>
        <View style={styles.recruitRow}>
          {[Math.max(MIN_TAX_RATE, (nation.taxRate ?? 30)-5), Math.min(MAX_TAX_RATE, (nation.taxRate ?? 30)+5)].map((rate,i)=><Pressable accessibilityRole="button" key={i} disabled={!economicActionsEnabled || rate===nation.taxRate} style={[styles.secondaryButton, rate===nation.taxRate && styles.disabled]} onPress={()=>onCommand({type:'SET_TAX_RATE',playerId,taxRate:rate})}><Text style={styles.secondaryText}>Налоги {i===0?'−5':'+5'}%</Text></Pressable>)}
        </View>
        <Text style={styles.hint}>Высокие налоги снижают стабильность и повышают unrest ежемесячно.</Text>
        <Text style={styles.hint}>Долг: {currency(nation.debt ?? 0)} · лимит {currency(budget.creditLimit)}</Text>
        <Text style={styles.hint}>Свободный кредит: {currency(availableCredit)}</Text>
        {bankruptcyMonths>0 && <Text style={styles.hint}>После банкротства: кредит и набор заблокированы ещё {bankruptcyMonths} мес.</Text>}
        <View style={styles.recruitRow}>
          <Pressable accessibilityRole="button" disabled={!economicActionsEnabled || loanQuote<=0 || bankruptcyMonths>0} style={[styles.secondaryButton,(loanQuote<=0 || bankruptcyMonths>0) && styles.disabled]} onPress={()=>onCommand({type:'BORROW',playerId,amount:loanQuote})}><Text style={styles.secondaryText}>Кредит {currency(loanQuote)}</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={!economicActionsEnabled || repayQuote<=0} style={[styles.secondaryButton,repayQuote<=0 && styles.disabled]} onPress={()=>onCommand({type:'REPAY_DEBT',playerId,amount:repayQuote})}><Text style={styles.secondaryText}>Погасить {currency(repayQuote)}</Text></Pressable>
        </View>
        <Text style={styles.hint}>Дефицит использует кредитный лимит. Неплатёжеспособность списывает долг, снижает стабильность и репутацию, вызывает unrest и сокращает армию до доступного бюджета.</Text>
      </View>}

      {section==='Government'&&state.dataset && <Pressable accessibilityRole="button" onPress={() => { setGovernmentOpen(!governmentOpen); setReligionOpen(false); setEconomyOpen(false); }} style={styles.secondaryButton}><Text style={styles.secondaryText}>Правительство {governmentOpen ? '▴' : '▾'}</Text></Pressable>}
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

      {section==='Religion'&&state.dataset && <Pressable accessibilityRole="button" onPress={() => { setReligionOpen(!religionOpen); setGovernmentOpen(false); setEconomyOpen(false); }} style={styles.secondaryButton}><Text style={styles.secondaryText}>Религия {religionOpen ? '▴' : '▾'}</Text></Pressable>}
      {religionOpen && state.dataset && <View style={styles.card}>
        <Text style={styles.eyebrow}>ГОСУДАРСТВЕННАЯ РЕЛИГИЯ · {Math.floor(politicalPower)} PP</Text>
        <Text style={styles.govCurrent}>{RELIGIONS[nation.religion ?? 'secular']?.name}</Text>
        <Text style={styles.hint}>Religious Unity: {nation.religiousUnity?.toFixed(1)}% · unrest {nation.unrest?.toFixed(1)}</Text>
        <Text style={styles.hint}>Смена: {RELIGION_CHANGE_COST} PP, −{RELIGION_STABILITY_COST} стабильности, unrest в провинциях другой веры; cooldown {RELIGION_COOLDOWN_TICKS} мес.</Text>
        {religionCooldown > 0 && <Text style={styles.hint}>Следующая смена религии через {religionCooldown} мес.</Text>}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.routes}>
          {RELIGION_IDS.map(religionId => {
            const active = religionId === nation.religion;
            const disabled = active || religionCooldown > 0 || politicalPower < RELIGION_CHANGE_COST;
            return <Pressable accessibilityRole="button" accessibilityState={{ disabled, selected: active }} key={religionId} disabled={disabled} style={[styles.govOption, disabled && styles.disabled, active && styles.govSelected]} onPress={() => onCommand({ type: 'CHANGE_RELIGION', playerId, religionId })}>
              <Text style={styles.govName}>{RELIGIONS[religionId]!.name}</Text>
              <Text style={styles.govDetails}>{RELIGIONS[religionId]!.group}</Text>
              <Text style={styles.govDetails}>{active ? 'Действует' : 'Принять · 120 PP'}</Text>
            </Pressable>;
          })}
        </ScrollView>
        <Text style={styles.hint}>Все религии используют одинаковые правила. Низкое единство повышает unrest; смена не обращает население автоматически.</Text>
      </View>}

      {section==='Country'&&<StabilityPanel state={state} playerId={playerId} onCommand={onCommand} />}
      {section==='Diplomacy'&&<WarPanel initialOpen state={state} playerId={playerId} onCommand={onCommand} />}
      {section==='Diplomacy'&&<DiplomacyPanel initialOpen state={state} playerId={playerId} onCommand={onCommand} />}
      {section==='Technology'&&<StrategyPanel initialOpen state={state} playerId={playerId} onCommand={onCommand} />}

      {section==='Military'&&<View style={styles.card}><Text style={styles.eyebrow}>АРМИИ · {compact(nation.army)}</Text>{state.armies.filter(a=>a.ownerId===countryId).map(a=><Pressable key={a.id} style={styles.secondaryButton} onPress={()=>onFocusProvince?.(a.provinceId)}><Text style={styles.secondaryText}>{state.provinces.find(p=>p.id===a.provinceId)?.name} · {compact(a.troops)}</Text><Text style={styles.hint}>Мораль {a.morale?.toFixed(0)} · организация {a.organization?.toFixed(0)}</Text></Pressable>)}</View>}
      {section==='Context'&&<View style={styles.card}>
        <Text style={styles.eyebrow}>КОМАНДОВАНИЕ</Text>
        {!selected ? (
          <Text style={styles.hint}>Нажми на провинцию на карте. Там будут армия, строительство, набор и доступные направления движения.</Text>
        ) : (
          <>
            <View style={styles.provinceTitleRow}>
              <View style={{flex:1,minWidth:0}}>
                <Text style={styles.title}>{selected.name}</Text>
                <Text style={styles.owner}>{countryFor(state, selected.ownerId).name} · доход ${selected.income}M</Text>
                <Text style={styles.owner}>Контроль: {countryFor(state, selected.controllerId ?? selected.ownerId).name}</Text>
                {selected.religion && <Text style={styles.owner}>{RELIGIONS[selected.religion]?.name} · unrest {selected.unrest?.toFixed(1)}</Text>}
              </View>
              <View style={[styles.ownerDot, { backgroundColor: countryFor(state, selected.ownerId).color }]} />
            </View>

            <Text style={styles.hint}>Развитие: {selected.development??40}/100 · Население провинции: {compact(selected.population)} · рост +{compact(selected.monthlyPopulationGrowth ?? 0)}/мес.</Text>
            {selected.resourceDeposit && production && <Text style={styles.hint}>{(selected.resourceMix??[selected.resourceDeposit]).map(r=>RESOURCES[r.type].name).join(", ")} · богатство {selected.resourceDeposit.richness}/100 · выпуск {production.units.toFixed(1)} ед./мес. · {currency(production.revenue)}/мес.</Text>}
            {selectedCities.map(city => <Text key={city.id} style={styles.owner}>{city.isCapital ? '★ Столица · ' : city.isRegionalCapital?'Региональный центр · ':''}{city.name} · {compact(city.population)} · развитие {city.development}</Text>)}

            {state.dataset && <>
              <Text style={styles.sectionTitle}>ЗДАНИЯ</Text>
              {isOwnProvince&&<Pressable accessibilityRole="button" accessibilityLabel="Строить" style={styles.secondaryButton} onPress={()=>setBuildOpen(!buildOpen)}><Text style={styles.secondaryText}>СТРОИТЬ {buildOpen?"▴":"▾"}</Text></Pressable>}
              {completedBuildings.length === 0 ? <Text style={styles.muted}>Построенных зданий нет</Text> : <View style={styles.buildingList}>{completedBuildings.map(type => <View key={type} style={styles.buildingPill}><Text style={styles.buildingPillText}>{BUILDINGS[type].name} · ур. {selected.buildings?.[type]}</Text></View>)}</View>}
              {selectedConstruction && <Text style={styles.hint}>Строится: {BUILDINGS[selectedConstruction.buildingType].name} ур. {selectedConstruction.targetLevel} · {Math.min(100,Math.round(100*(state.tick-selectedConstruction.startedTick)/(selectedConstruction.completeTick-selectedConstruction.startedTick)))}% · осталось {Math.max(0, selectedConstruction.completeTick-state.tick)} мес.</Text>}
              {isOwnProvince && buildOpen && <View style={{gap:8}}>
                {BUILDING_TYPES.map(type => {
                  const definition = BUILDINGS[type];
                  const currentLevel = selected.buildings?.[type] ?? 0;
                  const quote = currentLevel < definition.maxLevel ? buildingQuote(selected, type) : null;
                  const disabled = !!selected.rebellion || !economicActionsEnabled || Boolean(selectedConstruction) || !quote || nation.treasury < quote.cost;
                  return <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Построить ${definition.name}`}
                    accessibilityState={{ disabled }}
                    key={type}
                    disabled={disabled}
                    style={[styles.buildOption, disabled && styles.disabled]}
                    onPress={() => onCommand({ type: 'BUILD', playerId, provinceId: selected.id, buildingType: type })}
                  >
                    <Text style={styles.govName}>{definition.name}</Text>
                    <Text style={styles.govDetails}>Уровень {currentLevel}/{definition.maxLevel}</Text>
                    <Text style={styles.govDetails}>{Object.entries(definition.modifiers).map(([key,value])=>`${({taxPercent:"Налоги, %",tradePercent:"Торговля, %",resourcePercent:"Добыча, %",manpowerPercent:"Резерв, %",researchPercent:"Исследования, %",defensePercent:"Защита, %",populationGrowthPercent:"Рост населения, %",stabilityPerYear:"Стабильность / год",unrestPerYear:"Беспорядки / год"} as Record<string,string>)[key]??key}: ${value!>0?"+":""}${value}`).join(" · ")}</Text>
                    <Text style={styles.govDetails}>Содержание {currency(definition.maintenance)}/мес.</Text>
                    {(type==="Farm"||type==="Factory")&&<Text style={styles.govDetails}>Выпуск +{currency((type==="Farm"?3:12)*(.5+(selected.development??40)/100))}/мес. до содержания</Text>}
                    <Text style={styles.routeAction}>{quote ? `${currency(quote.cost)} · ${quote.buildTime} мес.` : 'МАКСИМУМ'}</Text>
                  </Pressable>;
                })}
              </View>}
            </>}

            {state.dataset && <MilitaryPanel state={state} playerId={playerId} onCommand={onCommand} province={selected} army={state.armies.find(a=>a.id===focusedArmyId&&a.provinceId===selected.id)??primaryArmy} />}
            {isOwnProvince && !selected.rebellion && (
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
              <Pressable accessibilityRole="button" accessibilityState={{selected:primaryArmy?.id===army.id}} disabled={army.ownerId!==countryId} onPress={()=>setSelectedArmyId(army.id)} key={army.id} style={[styles.armyRow, primaryArmy?.id===army.id && styles.govSelected]}>
                <Text style={styles.armyOwner}>{countryFor(state, army.ownerId).shortName}</Text>
                <Text style={styles.armyTroops}>{compact(army.troops)}</Text>
              </Pressable>
            ))}

            {primaryArmy && (
              <>
                <Text style={styles.sectionTitle}>Соседние провинции</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.routes}>
                  {neighbors.map((neighbor) => {
                    if (!neighbor) return null;
                    const enemy = (neighbor.controllerId ?? neighbor.ownerId) !== countryId;
                    return (
                      <Pressable
                        key={neighbor.id}
                        disabled={!primaryArmy}
                        style={[styles.route, enemy && styles.routeEnemy, !primaryArmy && styles.disabled]}
                        onPress={() => primaryArmy && onCommand({ type: 'ORDER_ARMY', playerId, armyId: primaryArmy.id, provinceId: neighbor.id })}
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
      </View>}

      {(section==='Military'||section==='Country')&&<View style={styles.card}>
        <Text style={styles.eyebrow}>ВОЕННАЯ СВОДКА</Text>
        {state.battleLog.length === 0 ? <Text style={styles.hint}>Боёв пока не было.</Text> : state.battleLog.slice(0, 6).map((battle) => (
          <View key={battle.id} style={styles.logRow}>
            <View style={styles.logTop}><Text style={styles.logMessage}>{battle.message}</Text><Text style={styles.logTick}>#{battle.tick}</Text></View>
            <Text style={styles.logLoss}>Потери: {countryFor(state, battle.attackerId).shortName} −{compact(battle.attackerLosses)} · {countryFor(state, battle.defenderId).shortName} −{compact(battle.defenderLosses)}</Text>
          </View>
        ))}
      </View>}
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
  primaryButton: { flex: 1.2, backgroundColor: '#E8EEF8', borderRadius: 13, paddingVertical: 12, minHeight:44, alignItems: 'center' },
  primaryText: { color: '#0D1522', fontWeight: '900', fontSize: 11 },
  secondaryButton: { flex: 1, backgroundColor: '#1B2739', borderRadius: 13, paddingVertical: 12, minHeight:44, alignItems: 'center' },
  secondaryText: { color: '#C2D0E6', fontWeight: '900', fontSize: 11 },
  sectionTitle: { color: '#687991', fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginTop: 2 },
  muted: { color: '#65758B', fontSize: 12 },
  buildingList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  buildingPill: { backgroundColor: '#142237', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6, borderWidth: 1, borderColor: '#263650' },
  buildingPillText: { color: '#B9C9E1', fontSize: 10, fontWeight: '800' },
  buildOption: { width: 150, backgroundColor: '#152136', borderRadius: 13, padding: 11, borderWidth: 1, borderColor: '#263650', gap: 4 },
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
