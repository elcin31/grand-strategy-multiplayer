import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {stateChecksum} from '../supabase/functions/_shared/sessionState';
const saved=JSON.parse(readFileSync(process.argv[2]!,'utf8'));
assert.equal(saved.checksum,stateChecksum(saved.state),'Native camera save checksum is invalid');
assert.equal(saved.metadata.id,saved.state.id);
console.log('PASS: captured native save checksum');
