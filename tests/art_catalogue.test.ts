import {test} from 'node:test';import assert from 'node:assert/strict';
import {BUILDING_ART,GOVERNMENT_ART,RELIGION_ART,TECHNOLOGY_ART} from '../src/ui/artCatalogue';
import {BUILDING_TYPES} from '../supabase/functions/_shared/buildingSystem';
import {GOVERNMENT_TYPES} from '../supabase/functions/_shared/governmentSystem';
import {RELIGION_IDS} from '../supabase/functions/_shared/religionSystem';
import {TECHNOLOGY_BRANCHES} from '../supabase/functions/_shared/technologySystem';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {URL} from 'node:url';
import {EXPANSION_SCENES,EXPANSION_SCENE_NAMES,governmentScene,religionScene,constructionScene} from '../src/ui/expansionArt';
test('every authoritative building, government, religion and technology has a valid optimized atlas tile',()=>{
 for(const type of BUILDING_TYPES)assert.ok(Number.isInteger(BUILDING_ART[type])&&BUILDING_ART[type]>=0&&BUILDING_ART[type]<10);
 for(const type of GOVERNMENT_TYPES)assert.ok(Number.isInteger(GOVERNMENT_ART[type])&&GOVERNMENT_ART[type]>=0&&GOVERNMENT_ART[type]<6);
 for(const id of RELIGION_IDS)assert.ok(Number.isInteger(RELIGION_ART[id])&&RELIGION_ART[id]!>=0&&RELIGION_ART[id]!<8);
 for(const branch of TECHNOLOGY_BRANCHES)assert.ok(Number.isInteger(TECHNOLOGY_ART[branch])&&TECHNOLOGY_ART[branch]>=0&&TECHNOLOGY_ART[branch]<10);
});

test('the27 new paintings meet the approved19-category scope plus8 distinct themes without reused originals',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../assets/art/manifest.json',import.meta.url),'utf8')) as {path:string;bytes:number;sha256:string;subjectId?:string;category?:string;sourceSha256?:string}[];
 const fresh=manifest.filter(e=>e.subjectId);assert.equal(fresh.length,27);assert.equal(new Set(fresh.map(e=>e.sourceSha256)).size,27);
 const counts:Record<string,number>={};
 for(const name of EXPANSION_SCENE_NAMES){const asset=fresh.find(e=>e.subjectId===name);assert.ok(asset,name);assert.equal(asset.category,EXPANSION_SCENES[name].category);counts[asset.category!]=(counts[asset.category!]??0)+1;const bytes=readFileSync(new URL('../'+asset.path,import.meta.url));assert.equal(bytes.length,asset.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);}
 assert.deepEqual(counts,{Diplomacy:5,Military:4,Construction:4,Government:3,Religion:3,Theme:8});assert.equal(manifest.length,42);assert.ok(manifest.reduce((sum,e)=>sum+e.bytes,0)<3_500_000);
});

test('new contextual scenes preserve complete existing catalogues and faith-specific architecture',()=>{
 for(const type of GOVERNMENT_TYPES)assert.equal(EXPANSION_SCENES[governmentScene(type)].category,'Government');
 for(const type of BUILDING_TYPES){const scene=constructionScene(type);if(scene)assert.equal(EXPANSION_SCENES[scene].category,'Construction');else assert.ok(BUILDING_ART[type]>=0);}
 for(const id of RELIGION_IDS){const scene=religionScene(id);if(scene)assert.equal(EXPANSION_SCENES[scene].category,'Religion');else assert.ok(RELIGION_ART[id]!>=0);}
 assert.equal(religionScene('hinduism'),null);assert.equal(religionScene('secular'),null);assert.equal(religionScene('buddhism'),'religion-temple');
});
