import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialGame } from '../src/data/world';
import { applyCommand } from '../src/engine/gameEngine';
import { applyServerCommand, createInitialState } from '../supabase/functions/_shared/game';

for (const mode of ['local', 'server'] as const) {
  test(`${mode} resolves winning/losing battles with consistent losses and unique ownership`, () => {
    for (const troops of [1000, 20000, 200000]) {
      const state = mode === 'local' ? createInitialGame() : createInitialState('game', 'BATTLE', 'local-player', 'Test');
      state.players[0]!.countryId = 'germany';
      state.phase = 'paused'; state.speed = 0;
      state.armies.find(a => a.id === 'army-de-1')!.troops = troops;
      state.countries.germany!.army = state.armies.filter(a => a.ownerId === 'germany').reduce((sum, a) => sum + a.troops, 0);
      const before = structuredClone(state);
      const command = { type: 'MOVE_ARMY', playerId: 'local-player', armyId: 'army-de-1', provinceId: 'fr-1' } as const;
      const next = mode === 'local' ? applyCommand(state, command) : applyServerCommand(state, command, 'local-player');
      assert.deepEqual(state, before);
      const battle = next.battleLog[0]!;
      const captured = troops === 200000;
      assert.equal(battle.captured, captured);
      assert.equal(battle.winnerId, captured ? 'germany' : 'france');
      assert.equal(next.provinces.find(p => p.id === 'fr-1')?.ownerId, battle.winnerId);
      assert.ok(Number.isSafeInteger(battle.attackerLosses) && battle.attackerLosses >= 0 && battle.attackerLosses <= troops);
      assert.ok(Number.isSafeInteger(battle.defenderLosses) && battle.defenderLosses >= 0);
      const sum = (armies: typeof state.armies) => armies.reduce((total, a) => total + a.troops, 0);
      assert.equal(sum(before.armies) - sum(next.armies), battle.attackerLosses + battle.defenderLosses);
      assert.equal(new Set(next.provinces.map(p => p.id)).size, next.provinces.length);
      assert.equal(new Set(next.armies.map(a => a.id)).size, next.armies.length);
      for (const army of next.armies) assert.ok(Number.isSafeInteger(army.troops) && army.troops > 0);
      for (const country of Object.values(next.countries)) assert.equal(country.army, sum(next.armies.filter(a => a.ownerId === country.id)));
      assert.equal(next.tick, before.tick);
      assert.equal(next.phase, 'paused');
    }
  });
}
