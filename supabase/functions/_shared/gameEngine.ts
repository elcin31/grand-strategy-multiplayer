import {setArmyOrder,advanceArmyOrders} from './armyOrders.ts';
import {cloneGameState} from './cloneGameState.ts';
import {recordMovement} from './movementHistory.ts';
import { runStrategicAI } from './aiSystem.ts';
import { monthlyStability, pacifyProvince, suppressRebellion } from './stabilitySystem.ts';
import { monthlyWar, proposePeace, recordWarBattle, respondPeace } from './warSystem.ts';
import { declareWar, diplomaticAction, monthlyDiplomacy, offerTreaty, respondTreaty, warBetween } from './diplomacySystem.ts';
import {startRelationMission,cancelRelationMission,sendGift,sendInsult,offerDiplomacy,respondDiplomacy,terminateTreaty,monthlyDiplomacy2,canEnterTerritory} from './diplomacy2System.ts';
import { assignCommander, battleFatigue, combatMultiplier, recoverMilitary, UNITS, type UnitType } from './militarySystem.ts';
import { monthlyResearch, startResearch, techLevel } from './technologySystem.ts';
import { buildingModifierTotals, cancelConstructionInProvince, completeConstructions, provinceBuildingModifiers, startConstruction } from './buildingSystem.ts';
import { initializeResources } from './resourceSystem.ts';
import { initializePopulation, monthlyPopulationGrowth, recalcPopulationTotals } from './populationSystem.ts';
import { initializeEconomy, recalcEconomy, monthlyEconomy, borrow, repay, refreshArmyBudget, money } from './economySystem.ts';
import { initializeReligions, recalcReligiousUnity, monthlyReligionEffects, RELIGION_CHANGE_COST, RELIGION_STABILITY_COST, RELIGION_COOLDOWN_TICKS } from './religionSystem.ts';
import { normalizeGameState } from './stateMigrations.ts';
import { assertGameCommand } from './commandValidation.ts';
import { GOVERNMENT_CHANGE_COST, GOVERNMENT_COOLDOWN_TICKS, GOVERNMENT_STABILITY_COST, POLITICAL_POWER_MONTHLY, governmentIncome, governmentModifiers, initializeGovernments } from './governmentSystem.ts';
import { Army, BattleEvent, CountryId, GameCommand, GameState, Player, Province, countryFor } from './gameTypes.ts';

const clone = cloneGameState;
const getPlayer = (state: GameState, playerId: string): Player => {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) throw new Error('Игрок не найден');
  return player;
};
const countryIds = (state: GameState) => Object.keys(state.countries) as CountryId[];
const armiesIn = (state: GameState, provinceId: string, ownerId?: CountryId) => state.armies.filter((army) => army.provinceId === provinceId && (!ownerId || army.ownerId === ownerId));
const provinceById = (state: GameState, id: string) => state.provinces.find((province) => province.id === id);
const totalTroops = (armies: Army[]) => armies.reduce((sum, army) => sum + army.troops, 0);

function recalcCountryStats(state: GameState) {
  for (const nation of Object.values(state.countries)) { nation.income = 0; nation.army = 0; if (state.dataset) { nation.population = 0; nation.provinceIds = []; } }
  for (const province of state.provinces) {
    const nation = countryFor(state, province.ownerId);
    nation.income += province.income;
    if (state.dataset) { nation.population += province.population; nation.provinceIds!.push(province.id); }
  }
  if (state.dataset) for (const nation of Object.values(state.countries)) nation.income = governmentIncome(nation.income, nation.governmentType);
  for (const army of state.armies) countryFor(state, army.ownerId).army += army.troops;
  recalcEconomy(state);
}
function entityId(state: GameState, kind: string): string {
  const sequence = state.nextEntityId ?? 1;
  if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence >= Number.MAX_SAFE_INTEGER) throw new Error('Entity sequence exhausted');
  state.nextEntityId = sequence + 1;
  return `${kind}-${state.id}-${sequence}`;
}
function addBattle(state: GameState, event: Omit<BattleEvent, 'id' | 'tick'>) {
  state.battleLog.unshift({ ...event, id: entityId(state, 'battle'), tick: state.tick });
  state.battleLog = state.battleLog.slice(0, 20);
  recordWarBattle(state, state.battleLog[0]!);
}
function applyLosses(state: GameState, defenders: Army[], losses: number) {
  let remaining = losses;
  for (const defender of [...defenders].sort((a, b) => b.troops - a.troops)) {
    if (remaining <= 0) break;
    const hit = Math.min(defender.troops, remaining);
    defender.troops -= hit; remaining -= hit;
  }
  state.armies = state.armies.filter((army) => army.troops > 0);
}
function resolveMovement(state: GameState, ownerId: CountryId, armyId: string, destinationId: string) {
  const army = state.armies.find((candidate) => candidate.id === armyId);
  if (!army || army.ownerId !== ownerId) throw new Error('Армия не найдена');
  const origin = provinceById(state, army.provinceId), destination = provinceById(state, destinationId);
  if (!origin || !destination) throw new Error('Провинция не найдена');
  if (!origin.neighbors.includes(destination.id)) throw new Error('Провинции не соседствуют');
  const controller = state.dataset ? destination.controllerId ?? destination.ownerId : destination.ownerId;
  if (controller === ownerId || state.dataset && !warBetween(state,ownerId,controller) && canEnterTerritory(state,ownerId,controller,army.id,destination.id)) { recordMovement(state,{armyId,ownerId,from:origin.id,to:destination.id,tick:state.tick}); army.provinceId = destination.id; return; }
  if (state.dataset && !warBetween(state, ownerId, controller)) throw new Error('Сначала объявите войну');
  recordMovement(state,{armyId,ownerId,from:origin.id,to:destination.id,tick:state.tick});
  const defenderId = controller, defenders = armiesIn(state, destination.id, defenderId), defenderTroops = totalTroops(defenders);
  const attackerNation = countryFor(state, ownerId), defenderNation = countryFor(state, defenderId);
  const attackPower = army.troops * (1 + attackerNation.technology / 200) * (0.75 + attackerNation.stability / 200) * combatMultiplier(state, army, destination, false);
  const fortification = state.dataset ? 1 + provinceBuildingModifiers(destination).defensePercent / 100 : 1;
  const defensePower = (defenderTroops + 2_500) * (1 + defenderNation.technology / 180) * (0.85 + defenderNation.stability / 250) * 1.12 * fortification * (defenderTroops > 0 ? defenders.reduce((sum, a) => sum + a.troops * combatMultiplier(state, a, destination, true), 0) / defenderTroops : 1);
  const ratio = attackPower / Math.max(1, defensePower);
  if (ratio >= 1) {
    const attackerLosses = Math.min(Math.max(0, army.troops - 1), Math.max(1_000, Math.round((defenderTroops + 2_500) * (0.42 + 0.18 / ratio))));
    const defenderLosses = defenderTroops;
    army.troops -= attackerLosses;
    state.armies = state.armies.filter((candidate) => !defenders.some((defender) => defender.id === candidate.id));
    if (state.dataset) destination.controllerId = ownerId;
    else { destination.ownerId = ownerId; if (destination.countryId) destination.countryId = ownerId; }
    cancelConstructionInProvince(state, destination.id);
    army.provinceId = destination.id;
    addBattle(state, { provinceId: destination.id, attackerId: ownerId, defenderId, attackerLosses, defenderLosses, winnerId: ownerId, captured: true, message: `${attackerNation.name} захватывает ${destination.name}` });
  } else {
    const attackerLosses = Math.min(army.troops, Math.max(1_000, Math.round(army.troops * Math.min(0.78, 0.42 + (1 - ratio) * 0.28))));
    const defenderLosses = Math.min(defenderTroops, Math.max(0, Math.round(army.troops * Math.max(0.12, ratio * 0.36))));
    army.troops -= attackerLosses; applyLosses(state, defenders, defenderLosses);
    state.armies = state.armies.filter((candidate) => candidate.troops > 0);
    addBattle(state, { provinceId: destination.id, attackerId: ownerId, defenderId, attackerLosses, defenderLosses, winnerId: defenderId, captured: false, message: `${defenderNation.name} удерживает ${destination.name}` });
  }
  if (state.dataset) battleFatigue([army, ...defenders]);
  recalcCountryStats(state); recalcPopulationTotals(state); recalcReligiousUnity(state);
}
function recruit(state: GameState, ownerId: CountryId, province: Province, troops: number, unitType: UnitType = 'Infantry') {
  if (province.rebellion || province.ownerId !== ownerId || (state.dataset && (province.controllerId ?? province.ownerId) !== ownerId)) throw new Error('Нельзя нанимать войска в чужой провинции');
  if (!Number.isInteger(troops) || troops < 1_000 || troops > 100_000) throw new Error('Недопустимый размер набора');
  const nation = countryFor(state, ownerId);
  if (state.dataset && state.tick < nation.bankruptcyUntilTick!) throw new Error('Набор недоступен после банкротства');
  if (state.dataset && techLevel(nation, 'Military') < UNITS[unitType].unlock) throw new Error('Нужен более высокий уровень военной технологии');
  const cost = Math.ceil(troops / 1_000) * (state.dataset ? UNITS[unitType].cost : 20);
  if (nation.treasury < cost) throw new Error('Недостаточно средств');
  if (nation.manpower < troops) throw new Error('Недостаточно людских ресурсов');
  nation.treasury = state.dataset ? money(nation.treasury - cost) : nation.treasury - cost;
  nation.manpower -= troops;
  const existing = state.armies.find((candidate) => candidate.ownerId === ownerId && candidate.provinceId === province.id && (candidate.unitType ?? 'Infantry') === unitType);
  if (existing) existing.troops += troops; else state.armies.push({ id: entityId(state, 'army'), ownerId, provinceId: province.id, troops, ...(state.dataset ? { unitType, morale: 80, organization: 60 } : {}) });
  nation.army += troops;
  if (state.dataset) refreshArmyBudget(nation);
}
function runAi(state: GameState) {
  if(state.dataset){runStrategicAI(state,{recruit,move:resolveMovement});return;}
  const humanCountries = new Set(state.players.map((player) => player.countryId).filter(Boolean) as CountryId[]);
  for (const id of countryIds(state)) {
    if (humanCountries.has(id)) continue;
    const owned = state.provinces.filter((province) => province.ownerId === id && !province.rebellion && (!state.dataset || (province.controllerId ?? province.ownerId) === id));
    if (!owned.length) continue;
    const nation = countryFor(state, id);
    const budgetAllowsRecruitment = !state.dataset || (state.tick >= nation.bankruptcyUntilTick! && nation.economy!.monthlyBalance >= 5 && nation.treasury >= 80 + (nation.economy!.armyMaintenance + 5) * 3);
    if (state.tick % 3 === 0 && nation.treasury >= 80 && nation.manpower >= 4_000 && budgetAllowsRecruitment) {
      const richest = [...owned].sort((a, b) => b.income - a.income)[0]; if (richest) recruit(state, id, richest, 4_000);
    }
    if (state.tick % 2 !== 0) continue;
    const army = state.armies.filter((candidate) => candidate.ownerId === id && candidate.troops >= 12_000).sort((a, b) => b.troops - a.troops)[0];
    if (!army) continue;
    const origin = provinceById(state, army.provinceId); if (!origin) continue;
    const targets = origin.neighbors.map((neighborId) => provinceById(state, neighborId)).filter((province): province is Province => Boolean(province && (province.controllerId ?? province.ownerId) !== id && (!state.dataset || warBetween(state, id, province.controllerId ?? province.ownerId))));
    if (!targets.length) continue;
    const target = [...targets].sort((a, b) => totalTroops(armiesIn(state, a.id, a.ownerId)) - totalTroops(armiesIn(state, b.id, b.ownerId)))[0];
    if (target) resolveMovement(state, id, army.id, target.id);
  }
}
function checkWinner(state: GameState) { if (new Set(state.provinces.map((province) => province.ownerId)).size === 1) state.phase = 'finished'; }

export function applyCommand(state: GameState, command: GameCommand, validatedLocalState = false): GameState {
  assertGameCommand(command, Object.keys(state.countries));
  const next = clone(state);
  if(!validatedLocalState){initializeGovernments(next); initializePopulation(next); initializeReligions(next); initializeResources(next); normalizeGameState(next); initializeEconomy(next);}
  switch (command.type) {
    case 'SET_TAX_RATE':
    case 'BORROW':
    case 'REPAY_DEBT': {
      if (!next.dataset) throw new Error('Бюджет доступен в кампании современного мира');
      if (next.phase !== 'running' && next.phase !== 'paused') throw new Error('Сначала начните кампанию');
      const player = getPlayer(next, command.playerId); if (!player.countryId) throw new Error('Страна не выбрана');
      const nation = countryFor(next, player.countryId);
      if (command.type === 'SET_TAX_RATE') { nation.taxRate = command.taxRate; recalcEconomy(next); }
      else if (command.type === 'BORROW') borrow(next, nation, command.amount); else repay(next, nation, command.amount);
      return next;
    }
    case 'PACIFY_PROVINCE':
    case 'SUPPRESS_REBELLION': {
      if (!next.dataset || !['running','paused'].includes(next.phase)) throw new Error('Сначала начните кампанию');
      const player=getPlayer(next,command.playerId);if(!player.countryId)throw new Error('Страна не выбрана');
      const province=provinceById(next,command.provinceId);if(!province)throw new Error('Провинция не найдена');
      if(command.type==='PACIFY_PROVINCE')pacifyProvince(next,player.countryId,province);
      else suppressRebellion(next,player.countryId,province);
      recalcCountryStats(next);return next;
    }
    case 'PROPOSE_PEACE':
    case 'RESPOND_PEACE': {
      if (!next.dataset || !['running','paused'].includes(next.phase)) throw new Error('Сначала начните кампанию');
      const player=getPlayer(next,command.playerId);if(!player.countryId)throw new Error('Страна не выбрана');
      if(command.type==='PROPOSE_PEACE')proposePeace(next,player.countryId,command.warId,command.terms);
      else respondPeace(next,player.countryId,command.warId,command.accept);
      recalcCountryStats(next);recalcPopulationTotals(next);recalcReligiousUnity(next);recalcEconomy(next);checkWinner(next);return next;
    }
    case 'DIPLOMATIC_ACTION':
    case 'START_RELATION_MISSION':
    case 'CANCEL_RELATION_MISSION':
    case 'SEND_GIFT':
    case 'SEND_INSULT':
    case 'OFFER_DIPLOMACY':
    case 'RESPOND_DIPLOMACY':
    case 'TERMINATE_TREATY':
    case 'OFFER_TREATY':
    case 'RESPOND_TREATY':
    case 'DECLARE_WAR': {
      if (!next.dataset || !['running','paused'].includes(next.phase)) throw new Error('Сначала начните кампанию');
      const player=getPlayer(next,command.playerId);if(!player.countryId)throw new Error('Страна не выбрана');
      if(command.type==='DIPLOMATIC_ACTION')diplomaticAction(next,player.countryId,command.targetId,command.action);
      if(command.type==='START_RELATION_MISSION')startRelationMission(next,player.countryId,command.targetId,command.kind);
      if(command.type==='CANCEL_RELATION_MISSION')cancelRelationMission(next,player.countryId,command.missionId);
      if(command.type==='SEND_GIFT')sendGift(next,player.countryId,command.targetId,command.amount);
      if(command.type==='SEND_INSULT')sendInsult(next,player.countryId,command.targetId);
      if(command.type==='OFFER_DIPLOMACY')offerDiplomacy(next,player.countryId,command.targetId,command.terms);
      if(command.type==='RESPOND_DIPLOMACY')respondDiplomacy(next,player.countryId,command.offerId,command.accept);
      if(command.type==='TERMINATE_TREATY')terminateTreaty(next,player.countryId,command.targetId,command.treatyId);
      if(command.type==='OFFER_TREATY')offerTreaty(next,player.countryId,command.targetId,command.treaty);
      if(command.type==='RESPOND_TREATY')respondTreaty(next,player.countryId,command.targetId,command.accept);
      if(command.type==='DECLARE_WAR')declareWar(next,player.countryId,command.targetId);
      recalcCountryStats(next);recalcPopulationTotals(next);recalcReligiousUnity(next);return next;
    }
    case 'START_RESEARCH': {
      if (!next.dataset || !['running', 'paused'].includes(next.phase)) throw new Error('Сначала начните кампанию');
      const player = getPlayer(next, command.playerId); if (!player.countryId) throw new Error('Страна не выбрана');
      startResearch(next, countryFor(next, player.countryId), command.branch); return next;
    }
    case 'BUILD': {
      if (!next.dataset) throw new Error('Строительство доступно в кампании современного мира');
      if (next.phase !== 'running' && next.phase !== 'paused') throw new Error('Сначала начните кампанию');
      const player = getPlayer(next, command.playerId); if (!player.countryId) throw new Error('Страна не выбрана');
      const province = provinceById(next, command.provinceId); if (!province) throw new Error('Провинция не найдена');
      startConstruction(next, player.countryId, province, command.buildingType); recalcEconomy(next); return next;
    }
    case 'SELECT_COUNTRY': {
      if (next.phase !== 'lobby') throw new Error('Страну можно выбрать только в лобби');
      const player = getPlayer(next, command.playerId);
      if (next.players.some((candidate) => candidate.id !== player.id && candidate.countryId === command.countryId)) throw new Error('Эта страна уже занята');
      player.countryId = command.countryId; player.ready = false; next.selectedCountryId = command.countryId; return next;
    }
    case 'SET_READY': {
      if (next.phase !== 'lobby') throw new Error('Готовность меняется только в лобби');
      const player = getPlayer(next, command.playerId); if (!player.countryId && command.ready) throw new Error('Сначала выберите страну');
      player.ready = command.ready; return next;
    }
    case 'START_GAME': {
      if (next.phase !== 'lobby') throw new Error('Кампания уже запущена');
      const player = getPlayer(next, command.playerId); if (!player.isHost) throw new Error('Только хост может начать игру');
      if (next.players.some((candidate) => !candidate.countryId || !candidate.ready)) throw new Error('Все игроки должны выбрать страну и подтвердить готовность');
      next.phase = 'running'; return next;
    }
    case 'SET_SPEED': {
      if (next.phase !== 'running' && next.phase !== 'paused') throw new Error('Сначала начните кампанию');
      const player = getPlayer(next, command.playerId); if (!player.isHost) throw new Error('Скорость меняет хост');
      next.speed = command.speed; next.phase = command.speed === 0 ? 'paused' : 'running'; return next;
    }
    case 'ASSIGN_COMMANDER': {
      if (!next.dataset || !['running','paused'].includes(next.phase)) throw new Error('Сначала начните кампанию');
      const player = getPlayer(next, command.playerId); if (!player.countryId) throw new Error('Страна не выбрана');
      assignCommander(next, player.countryId, command.armyId, command.commanderId); return next;
    }
    case 'RECRUIT_UNIT':
    case 'RECRUIT': {
      if (next.phase !== 'running' && next.phase !== 'paused') throw new Error('Сначала начните кампанию');
      const player = getPlayer(next, command.playerId); if (!player.countryId) throw new Error('Страна не выбрана');
      const province = provinceById(next, command.provinceId); if (!province) throw new Error('Провинция не найдена');
      if (command.type === 'RECRUIT_UNIT' && !next.dataset) throw new Error('Нужна современная кампания');
      recruit(next, player.countryId, province, command.troops, command.type === 'RECRUIT_UNIT' ? command.unitType : 'Infantry'); return next;
    }
    case 'ORDER_ARMY':
    case 'CANCEL_ARMY_ORDER': {
      if (!['running','paused'].includes(next.phase)) throw Error('Сначала начните кампанию');
      const player=getPlayer(next,command.playerId),army=next.armies.find(a=>a.id===command.armyId);
      if(!player.countryId||!army||army.ownerId!==player.countryId)throw Error('Можно отдавать приказы только своей армии');
      if(command.type==='CANCEL_ARMY_ORDER')delete army.order;
      else setArmyOrder(next,player.countryId,army.id,command.provinceId);
      return next;
    }
    case 'MOVE_ARMY': {
      if (next.phase !== 'running' && next.phase !== 'paused') throw new Error('Сначала начните кампанию');
      const player = getPlayer(next, command.playerId); if (!player.countryId) throw new Error('Страна не выбрана');
      const army=next.armies.find(a=>a.id===command.armyId),order=army?.order;
      resolveMovement(next, player.countryId, command.armyId, command.provinceId);
      // Legacy one-step clients may complete the first waypoint of a saved
      // route. Consume it once; a different manual destination replaces it.
      if(army&&order){if(army.provinceId===command.provinceId&&order.route[0]===command.provinceId){order.route.shift();if(!order.route.length)delete army.order;}else delete army.order;}
      checkWinner(next); return next;
    }
    case 'CHANGE_RELIGION': {
      if (!next.dataset) throw new Error('Смена религии доступна в кампании современного мира');
      if (next.phase !== 'running' && next.phase !== 'paused') throw new Error('Сначала начните кампанию');
      const player = getPlayer(next, command.playerId); if (!player.countryId) throw new Error('Страна не выбрана');
      const nation = countryFor(next, player.countryId);
      if (nation.religion === command.religionId) throw new Error('Эта религия уже действует');
      if (next.tick < nation.religionCooldownUntilTick!) throw new Error('Смена религии на cooldown');
      if (nation.politicalPower! < RELIGION_CHANGE_COST) throw new Error('Недостаточно политической силы');
      nation.politicalPower! -= RELIGION_CHANGE_COST; nation.stability = Math.max(0, nation.stability - RELIGION_STABILITY_COST); nation.unrest = Math.min(100, nation.unrest! + 8);
      nation.religion = command.religionId; nation.religionCooldownUntilTick = next.tick + RELIGION_COOLDOWN_TICKS;
      for (const p of next.provinces) if (p.ownerId === nation.id && p.religion !== nation.religion) p.unrest = Math.min(100, p.unrest! + 10);
      recalcReligiousUnity(next); recalcEconomy(next); return next;
    }
    case 'CHANGE_GOVERNMENT': {
      if (!next.dataset) throw new Error('Смена правительства доступна в кампании современного мира');
      if (next.phase !== 'running' && next.phase !== 'paused') throw new Error('Сначала начните кампанию');
      const player = getPlayer(next, command.playerId); if (!player.countryId) throw new Error('Страна не выбрана');
      const nation = countryFor(next, player.countryId);
      if (nation.governmentType === command.governmentType) throw new Error('Эта форма правления уже действует');
      if (next.tick < nation.governmentCooldownUntilTick!) throw new Error(`Смена правительства доступна через ${nation.governmentCooldownUntilTick! - next.tick} мес.`);
      if (nation.politicalPower! < GOVERNMENT_CHANGE_COST) throw new Error('Недостаточно политической силы');
      const previous = governmentModifiers(nation.governmentType);
      nation.politicalPower! -= GOVERNMENT_CHANGE_COST; nation.governmentType = command.governmentType; nation.governmentCooldownUntilTick = next.tick + GOVERNMENT_COOLDOWN_TICKS;
      nation.stability = Math.max(0, nation.stability - GOVERNMENT_STABILITY_COST);
      nation.diplomaticReputation = Math.min(100, Math.max(0, nation.diplomaticReputation! + governmentModifiers(command.governmentType).diplomacy - previous.diplomacy));
      recalcCountryStats(next); return next;
    }
    case 'ADVANCE_TICK': {
      if (next.phase !== 'running' || next.speed === 0) return next;
      if(!Number.isSafeInteger(next.tick+1)||!Number.isSafeInteger(next.year+(next.month===12?1:0)))throw new Error('Campaign clock overflow');
      next.tick += 1; next.month += 1; if (next.month > 12) { next.month = 1; next.year += 1; }
      advanceArmyOrders(next,resolveMovement);
      completeConstructions(next);
      monthlyDiplomacy(next);
      monthlyDiplomacy2(next);
      monthlyResearch(next);
      recoverMilitary(next);
      monthlyPopulationGrowth(next); recalcCountryStats(next);
      const buildingTotals = buildingModifierTotals(next);
      for (const id of countryIds(next)) {
        const nation = countryFor(next, id);
        if (!next.dataset) nation.treasury += nation.income;
        const government = next.dataset ? governmentModifiers(nation.governmentType) : undefined;
        const buildings = buildingTotals.get(id);
        nation.manpower += Math.max(500, Math.round(nation.population * .00004 * (1 + ((government?.manpowerPercent ?? 0) + (buildings?.manpowerPercent ?? 0)) / 100)));
        if (government) {
          nation.politicalPower = Math.min(500, nation.politicalPower! + POLITICAL_POWER_MONTHLY);
          nation.technology = Math.min(100, nation.technology + .025 * (1 + (government.researchPercent + (buildings?.researchPercent ?? 0)) / 100));
          nation.stability = Math.min(100, Math.max(0, nation.stability + (government.stabilityPerYear + (buildings?.stabilityPerYear ?? 0) + techLevel(nation, 'Administration') * .6) / 12));
          nation.unrest = Math.min(100, Math.max(0, nation.unrest! + (government.unrestPerYear + (buildings?.unrestPerYear ?? 0)) / 12));
        }
      }
      monthlyReligionEffects(next); monthlyEconomy(next); monthlyWar(next); monthlyStability(next); runAi(next); recalcCountryStats(next); recalcPopulationTotals(next); recalcReligiousUnity(next); checkWinner(next); return next;
    }
  }
}
