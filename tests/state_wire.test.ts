import {test} from 'node:test';import assert from 'node:assert/strict';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {encodeSnapshot,decodeSnapshot} from '../supabase/functions/_shared/stateWire';
import {stateChecksum} from '../supabase/functions/_shared/sessionState';
test('dynamic snapshots omit static metadata and roundtrip mutable gameplay exactly',()=>{const state=createWorldState('wire','WIRE01','host','QA');state.provinces[0]!.name='Edited legacy name';state.provinces[0]!.ownerId='france';const before=JSON.stringify(state),full={state,version:3,checksum:stateChecksum(state)},wire=encodeSnapshot(full);assert.deepEqual(decodeSnapshot(wire).state,state);assert.equal(JSON.stringify(state),before);assert.ok(JSON.stringify(wire).length<before.length*.9);assert.equal(wire.checksum,full.checksum);assert.equal(decodeSnapshot(full),full);});
test('dynamic snapshots reject corrupted payloads without adopting them',()=>{const state=createWorldState('wire','WIRE01','host','QA'),wire=encodeSnapshot({state});wire.state.countries.usa!.treasury+=1;assert.throws(()=>decodeSnapshot(wire),/Invalid dynamic/);});
