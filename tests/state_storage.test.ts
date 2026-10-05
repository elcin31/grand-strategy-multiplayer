import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorldState } from '../supabase/functions/_shared/worldState';
import { packRoomState, unpackRoomState } from '../supabase/functions/_shared/stateStorage';

test('compressed persistence round-trips a full modern world and materially reduces wire size', async () => {
  const state = createWorldState('storage-qa','STORE1','host','Storage QA',707);
  const json = JSON.stringify(state);
  const packed = await packRoomState(state);
  assert.match(packed, /^gz1:/);
  assert.ok(packed.length < json.length * 0.45, `compressed=${packed.length} json=${json.length}`);
  assert.deepEqual(await unpackRoomState({ state: null, state_compressed: packed }), state);
});

test('legacy JSONB state remains readable for lazy migration', async () => {
  const state = createWorldState('storage-legacy','STORE2','host','Storage QA',708);
  const restored=await unpackRoomState({state});
  assert.deepEqual(restored,state);assert.notEqual(restored,state);
  restored.tick++;assert.equal(state.tick,0);
});

test('missing, malformed and unknown-codec persistence is rejected', async () => {
  await assert.rejects(() => unpackRoomState({}), /missing/);
  await assert.rejects(() => unpackRoomState({ state_compressed: 'zip9:abc' }), /Unsupported/);
  await assert.rejects(() => unpackRoomState({ state_compressed: 'gz1:not-base64' }), /Corrupted/);
});
