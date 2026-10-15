import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {applyServerCommand} from '../supabase/functions/_shared/serverCommand';
import {focusNode} from '../supabase/functions/_shared/focusCatalogue';
import {encodeCampaign,decodeCampaign} from '../src/persistence/campaignCodec';
import type {GameCommand} from '../src/types/game';
const output=process.argv[2];assert.ok(output,'Output directory required');mkdirSync(output,{recursive:true});
let state=createWorldState('gameplay23-qa','PLAY23','gameplay-host','Playtest QA',101);
for(const command of [
 {type:'SELECT_SCENARIO',playerId:'gameplay-host',scenarioId:'rhine-reconstruction-compact'},
 {type:'SELECT_COUNTRY',playerId:'gameplay-host',countryId:'germany'},
 {type:'SET_READY',playerId:'gameplay-host',ready:true},
 {type:'START_GAME',playerId:'gameplay-host'},
 {type:'ADVANCE_TICK'},
 {type:'SET_SPEED',playerId:'gameplay-host',speed:0},
] satisfies GameCommand[])state=applyServerCommand(state,command,'gameplay-host');
const event=state.events!.pending.find(e=>e.countryId==='germany'&&e.eventId==='alt-rhine-workshops');assert.ok(event);
assert.equal(state.countries.germany!.stockpile!.autoBuild,false);
const text=encodeCampaign(state,1,'Dominion 2.3 · проверка игровых систем');assert.deepEqual(decodeCampaign(text).state,state);
writeFileSync(join(output,state.id+'.1.json'),text);writeFileSync(join(output,'manifest.json'),JSON.stringify({filename:state.id+'.1.json',eventId:event.id,countryId:'germany',scenarioId:state.scenario!.id,initialTreasury:state.countries.germany!.treasury,initialPoliticalPower:state.countries.germany!.politicalPower,initialTick:state.tick,focusName:focusNode('eco-audit')!.name},null,2)+'\n');
console.log('PASS: original alternate scenario, pending paid event and compatible paused campaign');
