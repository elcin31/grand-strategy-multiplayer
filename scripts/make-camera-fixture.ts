import {mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {applyServerCommand} from '../supabase/functions/_shared/serverCommand';
import {encodeCampaign,decodeCampaign} from '../src/persistence/campaignCodec';
import {type GameCommand} from '../src/types/game';

// Only a CI fixture, never a production room or a runtime/debug backdoor.
// Keep the schema12 baseline explicit when later expansion migrations arrive.
const directory=process.argv[2]??'camera-fixture';mkdirSync(directory,{recursive:true});
let state=createWorldState('camera-fixture-101','CAM101','camera-host','Camera QA',101);
for(const command of [
  {type:'SELECT_COUNTRY',playerId:'camera-host',countryId:'germany'},
  {type:'SET_READY',playerId:'camera-host',ready:true},
  {type:'START_GAME',playerId:'camera-host'},
  {type:'SET_SPEED',playerId:'camera-host',speed:0},
] satisfies GameCommand[])state=applyServerCommand(state,command,'camera-host');
assert.equal(state.stateVersion,12,'Generate the legacy fixture from the accepted schema12 source, not an incompatible future schema');
assert.equal(state.phase,'paused');assert.equal(state.tick,0);
const text=encodeCampaign(state,1,'Camera QA · fixed seed 101');
const saved=JSON.parse(text);saved.metadata.lastPlayed=0;
const canonical=JSON.stringify(saved);
assert.deepEqual(decodeCampaign(canonical).state,state);
const filename=state.id+'.1.json',sha256=createHash('sha256').update(canonical).digest('hex');
writeFileSync(join(directory,filename),canonical);
writeFileSync(join(directory,'manifest.json'),JSON.stringify({filename,sha256,stateChecksum:saved.checksum,stateVersion:12,seed:101,tick:0,countries:Object.keys(state.countries).length,provinces:state.provinces.length,cities:state.cities!.length},null,2)+'\n');
console.log(JSON.stringify({filename,sha256,bytes:Buffer.byteLength(canonical),stateChecksum:saved.checksum}));
