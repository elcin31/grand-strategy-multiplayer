import { CountryId, GameCommand, GameState, Player } from '../types/game';

const clone = (state: GameState): GameState => structuredClone(state);
const getPlayer = (state: GameState, playerId: string): Player => {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) throw new Error('Игрок не найден');
  return player;
};
const ownsCountry = (player: Player, countryId: CountryId) => player.countryId === countryId;

export function applyCommand(state: GameState, command: GameCommand): GameState {
  const next = clone(state);
  switch (command.type) {
    case 'SELECT_COUNTRY': {
      if (next.phase !== 'lobby') throw new Error('Страну можно выбрать только в лобби');
      const player = getPlayer(next, command.playerId);
      const occupied = next.players.some((candidate) => candidate.id !== player.id && candidate.countryId === command.countryId);
      if (occupied) throw new Error('Эта страна уже занята');
      player.countryId = command.countryId;
      player.ready = false;
      next.selectedCountryId = command.countryId;
      return next;
    }
    case 'SET_READY': {
      const player = getPlayer(next, command.playerId);
      if (!player.countryId && command.ready) throw new Error('Сначала выберите страну');
      player.ready = command.ready;
      return next;
    }
    case 'START_GAME': {
      const player = getPlayer(next, command.playerId);
      if (!player.isHost) throw new Error('Только хост может начать игру');
      if (next.players.some((candidate) => !candidate.countryId || !candidate.ready)) throw new Error('Все игроки должны выбрать страну и подтвердить готовность');
      next.phase = 'running';
      return next;
    }
    case 'SET_SPEED': {
      const player = getPlayer(next, command.playerId);
      if (!player.isHost) throw new Error('Скорость меняет хост');
      next.speed = command.speed;
      next.phase = command.speed === 0 ? 'paused' : 'running';
      return next;
    }
    case 'RECRUIT': {
      if (next.phase !== 'running') throw new Error('Игра не запущена');
      if (command.troops <= 0) throw new Error('Количество войск должно быть положительным');
      const player = getPlayer(next, command.playerId);
      const province = next.provinces.find((candidate) => candidate.id === command.provinceId);
      if (!province || !player.countryId || !ownsCountry(player, province.ownerId)) throw new Error('Нельзя нанимать войска в чужой провинции');
      const nation = next.countries[player.countryId];
      const cost = Math.ceil(command.troops / 1000) * 20;
      if (nation.treasury < cost) throw new Error('Недостаточно средств');
      if (nation.manpower < command.troops) throw new Error('Недостаточно людских ресурсов');
      nation.treasury -= cost;
      nation.manpower -= command.troops;
      nation.army += command.troops;
      next.armies.push({ id: `army-${next.tick}-${next.armies.length + 1}`, ownerId: player.countryId, provinceId: province.id, troops: command.troops });
      return next;
    }
    case 'MOVE_ARMY': {
      if (next.phase !== 'running') throw new Error('Игра не запущена');
      const player = getPlayer(next, command.playerId);
      const army = next.armies.find((candidate) => candidate.id === command.armyId);
      const destination = next.provinces.find((candidate) => candidate.id === command.provinceId);
      if (!army || !destination || !player.countryId || army.ownerId !== player.countryId) throw new Error('Недопустимое перемещение армии');
      army.provinceId = destination.id;
      return next;
    }
    case 'ADVANCE_TICK': {
      if (next.phase !== 'running' || next.speed === 0) return next;
      next.tick += 1;
      next.month += 1;
      if (next.month > 12) { next.month = 1; next.year += 1; }
      for (const country of Object.values(next.countries)) country.treasury += country.income;
      return next;
    }
  }
}
