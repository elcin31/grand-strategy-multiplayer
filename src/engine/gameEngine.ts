import { assertGameCommand } from '../../supabase/functions/_shared/commandValidation';
import { Army, BattleEvent, CountryId, GameCommand, GameState, Player, Province } from '../types/game';

const clone = (state: GameState): GameState => structuredClone(state);
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
  for (const id of countryIds(state)) {
    const nation = state.countries[id];
    nation.income = state.provinces.filter((province) => province.ownerId === id).reduce((sum, province) => sum + province.income, 0);
    nation.army = state.armies.filter((army) => army.ownerId === id).reduce((sum, army) => sum + army.troops, 0);
  }
}

function addBattle(state: GameState, event: Omit<BattleEvent, 'id' | 'tick'>) {
  state.battleLog.unshift({ ...event, id: `battle-${state.tick}-${state.battleLog.length + 1}`, tick: state.tick });
  state.battleLog = state.battleLog.slice(0, 20);
}

function applyLosses(state: GameState, defenders: Army[], losses: number) {
  let remaining = losses;
  for (const defender of [...defenders].sort((a, b) => b.troops - a.troops)) {
    if (remaining <= 0) break;
    const hit = Math.min(defender.troops, remaining);
    defender.troops -= hit;
    remaining -= hit;
  }
  state.armies = state.armies.filter((army) => army.troops > 0);
}

function resolveMovement(state: GameState, ownerId: CountryId, armyId: string, destinationId: string) {
  const army = state.armies.find((candidate) => candidate.id === armyId);
  if (!army || army.ownerId !== ownerId) throw new Error('Армия не найдена');
  const origin = provinceById(state, army.provinceId);
  const destination = provinceById(state, destinationId);
  if (!origin || !destination) throw new Error('Провинция не найдена');
  if (!origin.neighbors.includes(destination.id)) throw new Error('Провинции не соседствуют');
  if (destination.ownerId === ownerId) {
    army.provinceId = destination.id;
    return;
  }

  const defenderId = destination.ownerId;
  const defenders = armiesIn(state, destination.id, defenderId);
  const defenderTroops = totalTroops(defenders);
  const attackerNation = state.countries[ownerId];
  const defenderNation = state.countries[defenderId];
  const attackPower = army.troops * (1 + attackerNation.technology / 200) * (0.75 + attackerNation.stability / 200);
  const defensePower = (defenderTroops + 2_500) * (1 + defenderNation.technology / 180) * (0.85 + defenderNation.stability / 250) * 1.12;
  const ratio = attackPower / Math.max(1, defensePower);

  if (ratio >= 1) {
    const attackerLosses = Math.min(army.troops - 1_000, Math.max(1_000, Math.round((defenderTroops + 2_500) * (0.42 + 0.18 / ratio))));
    const defenderLosses = defenderTroops;
    army.troops = Math.max(1_000, army.troops - attackerLosses);
    state.armies = state.armies.filter((candidate) => !defenders.some((defender) => defender.id === candidate.id));
    destination.ownerId = ownerId;
    army.provinceId = destination.id;
    addBattle(state, {
      provinceId: destination.id,
      attackerId: ownerId,
      defenderId,
      attackerLosses,
      defenderLosses,
      winnerId: ownerId,
      captured: true,
      message: `${attackerNation.name} захватывает ${destination.name}`,
    });
  } else {
    const attackerLosses = Math.min(army.troops, Math.max(1_000, Math.round(army.troops * Math.min(0.78, 0.42 + (1 - ratio) * 0.28))));
    const defenderLosses = Math.min(defenderTroops, Math.max(0, Math.round(army.troops * Math.max(0.12, ratio * 0.36))));
    army.troops -= attackerLosses;
    applyLosses(state, defenders, defenderLosses);
    state.armies = state.armies.filter((candidate) => candidate.troops > 0);
    addBattle(state, {
      provinceId: destination.id,
      attackerId: ownerId,
      defenderId,
      attackerLosses,
      defenderLosses,
      winnerId: defenderId,
      captured: false,
      message: `${defenderNation.name} удерживает ${destination.name}`,
    });
  }
  recalcCountryStats(state);
}

function recruit(state: GameState, ownerId: CountryId, province: Province, troops: number, id: string) {
  if (province.ownerId !== ownerId) throw new Error('Нельзя нанимать войска в чужой провинции');
  if (!Number.isInteger(troops) || troops < 1_000 || troops > 100_000) throw new Error('Недопустимый размер набора');
  const nation = state.countries[ownerId];
  const cost = Math.ceil(troops / 1_000) * 20;
  if (nation.treasury < cost) throw new Error('Недостаточно средств');
  if (nation.manpower < troops) throw new Error('Недостаточно людских ресурсов');
  nation.treasury -= cost;
  nation.manpower -= troops;
  const existing = state.armies.find((army) => army.ownerId === ownerId && army.provinceId === province.id);
  if (existing) existing.troops += troops;
  else state.armies.push({ id, ownerId, provinceId: province.id, troops });
  recalcCountryStats(state);
}

function runAi(state: GameState) {
  const humanCountries = new Set(state.players.map((player) => player.countryId).filter(Boolean) as CountryId[]);
  for (const id of countryIds(state)) {
    if (humanCountries.has(id)) continue;
    const owned = state.provinces.filter((province) => province.ownerId === id);
    if (!owned.length) continue;
    const nation = state.countries[id];
    if (state.tick % 3 === 0 && nation.treasury >= 80 && nation.manpower >= 4_000) {
      const richest = [...owned].sort((a, b) => b.income - a.income)[0];
      if (richest) recruit(state, id, richest, 4_000, `ai-${id}-${state.tick}`);
    }
    if (state.tick % 2 !== 0) continue;
    const army = state.armies.filter((candidate) => candidate.ownerId === id && candidate.troops >= 12_000).sort((a, b) => b.troops - a.troops)[0];
    if (!army) continue;
    const origin = provinceById(state, army.provinceId);
    if (!origin) continue;
    const targets = origin.neighbors.map((neighborId) => provinceById(state, neighborId)).filter((province): province is Province => Boolean(province && province.ownerId !== id));
    if (!targets.length) continue;
    const target = [...targets].sort((a, b) => totalTroops(armiesIn(state, a.id, a.ownerId)) - totalTroops(armiesIn(state, b.id, b.ownerId)))[0];
    if (target) resolveMovement(state, id, army.id, target.id);
  }
}

function checkWinner(state: GameState) {
  const owners = new Set(state.provinces.map((province) => province.ownerId));
  if (owners.size === 1) state.phase = 'finished';
}

export function applyCommand(state: GameState, command: GameCommand): GameState {
  assertGameCommand(command, Object.keys(state.countries));
  const next = clone(state);
  switch (command.type) {
    case 'SELECT_COUNTRY': {
      if (next.phase !== 'lobby') throw new Error('Страну можно выбрать только в лобби');
      const player = getPlayer(next, command.playerId);
      if (next.players.some((candidate) => candidate.id !== player.id && candidate.countryId === command.countryId)) throw new Error('Эта страна уже занята');
      player.countryId = command.countryId;
      player.ready = false;
      next.selectedCountryId = command.countryId;
      return next;
    }
    case 'SET_READY': {
      if (next.phase !== 'lobby') throw new Error('Готовность меняется только в лобби');
      const player = getPlayer(next, command.playerId);
      if (!player.countryId && command.ready) throw new Error('Сначала выберите страну');
      player.ready = command.ready;
      return next;
    }
    case 'START_GAME': {
      if (next.phase !== 'lobby') throw new Error('Кампания уже запущена');
      const player = getPlayer(next, command.playerId);
      if (!player.isHost) throw new Error('Только хост может начать игру');
      if (next.players.some((candidate) => !candidate.countryId || !candidate.ready)) throw new Error('Все игроки должны выбрать страну и подтвердить готовность');
      next.phase = 'running';
      return next;
    }
    case 'SET_SPEED': {
      if (next.phase !== 'running' && next.phase !== 'paused') throw new Error('Сначала начните кампанию');
      const player = getPlayer(next, command.playerId);
      if (!player.isHost) throw new Error('Скорость меняет хост');
      next.speed = command.speed;
      next.phase = command.speed === 0 ? 'paused' : 'running';
      return next;
    }
    case 'RECRUIT': {
      if (next.phase !== 'running' && next.phase !== 'paused') throw new Error('Сначала начните кампанию');
      const player = getPlayer(next, command.playerId);
      if (!player.countryId) throw new Error('Страна не выбрана');
      const province = provinceById(next, command.provinceId);
      if (!province) throw new Error('Провинция не найдена');
      recruit(next, player.countryId, province, command.troops, `army-${next.tick}-${next.armies.length + 1}`);
      return next;
    }
    case 'MOVE_ARMY': {
      if (next.phase !== 'running' && next.phase !== 'paused') throw new Error('Сначала начните кампанию');
      const player = getPlayer(next, command.playerId);
      if (!player.countryId) throw new Error('Страна не выбрана');
      resolveMovement(next, player.countryId, command.armyId, command.provinceId);
      checkWinner(next);
      return next;
    }
    case 'ADVANCE_TICK': {
      if (next.phase !== 'running' || next.speed === 0) return next;
      next.tick += 1;
      next.month += 1;
      if (next.month > 12) { next.month = 1; next.year += 1; }
      recalcCountryStats(next);
      for (const id of countryIds(next)) {
        const nation = next.countries[id];
        nation.treasury += nation.income;
        nation.manpower += Math.max(500, Math.round(nation.population * 0.00004));
      }
      runAi(next);
      recalcCountryStats(next);
      checkWinner(next);
      return next;
    }
  }
}
