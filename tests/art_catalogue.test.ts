import {test} from 'node:test';import assert from 'node:assert/strict';
import {BUILDING_ART,GOVERNMENT_ART,RELIGION_ART} from '../src/ui/artCatalogue';
import {BUILDING_TYPES} from '../supabase/functions/_shared/buildingSystem';
import {GOVERNMENT_TYPES} from '../supabase/functions/_shared/governmentSystem';
import {RELIGION_IDS} from '../supabase/functions/_shared/religionSystem';
test('every authoritative building, government and religion has a valid optimized atlas tile',()=>{
 for(const type of BUILDING_TYPES)assert.ok(Number.isInteger(BUILDING_ART[type])&&BUILDING_ART[type]>=0&&BUILDING_ART[type]<10);
 for(const type of GOVERNMENT_TYPES)assert.ok(Number.isInteger(GOVERNMENT_ART[type])&&GOVERNMENT_ART[type]>=0&&GOVERNMENT_ART[type]<6);
 for(const id of RELIGION_IDS)assert.ok(Number.isInteger(RELIGION_ART[id])&&RELIGION_ART[id]!>=0&&RELIGION_ART[id]!<8);
});
