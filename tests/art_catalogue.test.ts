import {test} from 'node:test';import assert from 'node:assert/strict';
import {BUILDING_ART,GOVERNMENT_ART,RELIGION_ART,TECHNOLOGY_ART} from '../src/ui/artCatalogue';
import {BUILDING_TYPES} from '../supabase/functions/_shared/buildingSystem';
import {GOVERNMENT_TYPES} from '../supabase/functions/_shared/governmentSystem';
import {RELIGION_IDS} from '../supabase/functions/_shared/religionSystem';
import {TECHNOLOGY_BRANCHES} from '../supabase/functions/_shared/technologySystem';
test('every authoritative building, government, religion and technology has a valid optimized atlas tile',()=>{
 for(const type of BUILDING_TYPES)assert.ok(Number.isInteger(BUILDING_ART[type])&&BUILDING_ART[type]>=0&&BUILDING_ART[type]<10);
 for(const type of GOVERNMENT_TYPES)assert.ok(Number.isInteger(GOVERNMENT_ART[type])&&GOVERNMENT_ART[type]>=0&&GOVERNMENT_ART[type]<6);
 for(const id of RELIGION_IDS)assert.ok(Number.isInteger(RELIGION_ART[id])&&RELIGION_ART[id]!>=0&&RELIGION_ART[id]!<8);
 for(const branch of TECHNOLOGY_BRANCHES)assert.ok(Number.isInteger(TECHNOLOGY_ART[branch])&&TECHNOLOGY_ART[branch]>=0&&TECHNOLOGY_ART[branch]<10);
});
