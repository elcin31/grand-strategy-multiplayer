import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {validateScenarioPack,validateEventDefinitions} from '../supabase/functions/_shared/contentValidation';
import {data,contentHash} from '../supabase/functions/_shared/scenarioContent';
import {DOMINION_EVENTS} from '../supabase/functions/_shared/eventCatalogue';
import {FOCUS_IDS} from '../supabase/functions/_shared/focusCatalogue';
const root=resolve('content/scenarios');
for(const file of readdirSync(root).filter(name=>name.endsWith('.json'))){
 const bytes=readFileSync(resolve(root,file));assert.ok(bytes.length<2*1024*1024,'Content pack too large');
 const pack=JSON.parse(bytes.toString());validateScenarioPack(pack);
 if(pack.id===data.id){assert.deepEqual(pack,data);assert.equal(createHash('sha256').update(JSON.stringify(pack)).digest('hex'),contentHash);}
 console.log(`PASS: ${pack.id} v${pack.version}; ${pack.events.length} event definition(s), ${pack.focuses.length} focus definition(s)`);
}
validateEventDefinitions(DOMINION_EVENTS,new Set(FOCUS_IDS));
console.log(`PASS: ${DOMINION_EVENTS.length} registered events; ${FOCUS_IDS.length} national courses; finite chains and strict effect registry`);
