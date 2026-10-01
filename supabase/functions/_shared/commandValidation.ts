/** Validate JSON at both command boundaries. No client state or economic fields are accepted. */
const fields: Record<string, readonly string[]> = {
  SELECT_COUNTRY: ['type', 'playerId', 'countryId'],
  SET_READY: ['type', 'playerId', 'ready'],
  START_GAME: ['type', 'playerId'],
  SET_SPEED: ['type', 'playerId', 'speed'],
  RECRUIT: ['type', 'playerId', 'provinceId', 'troops'],
  MOVE_ARMY: ['type', 'playerId', 'armyId', 'provinceId'],
  ADVANCE_TICK: ['type'],
};
export function assertGameCommand(input: unknown, countryIds: readonly string[]): void {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid command payload');
  const command = input as Record<string, unknown>;
  const type = command.type;
  if (typeof type !== 'string' || !Object.hasOwn(fields, type)) throw new Error('Unknown command');
  const allowed = fields[type]!;
  if (Object.keys(command).some(key => !allowed.includes(key)) || allowed.some(key => !Object.hasOwn(command, key))) throw new Error('Invalid command fields');
  for (const key of ['playerId', 'provinceId', 'armyId']) {
    if (allowed.includes(key) && (typeof command[key] !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(command[key] as string))) throw new Error('Invalid command identifier');
  }
  if (type === 'SELECT_COUNTRY' && (typeof command.countryId !== 'string' || !countryIds.includes(command.countryId))) throw new Error('Unknown country');
  if (type === 'SET_READY' && typeof command.ready !== 'boolean') throw new Error('Invalid ready value');
  if (type === 'SET_SPEED' && (typeof command.speed !== 'number' || !Number.isInteger(command.speed) || command.speed < 0 || command.speed > 4)) throw new Error('Invalid game speed');
  if (type === 'RECRUIT' && (typeof command.troops !== 'number' || !Number.isSafeInteger(command.troops) || command.troops < 1000 || command.troops > 100000)) throw new Error('Invalid recruitment amount');
}
