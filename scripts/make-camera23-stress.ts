import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {decodeCampaign,encodeCampaign} from '../src/persistence/campaignCodec';
import {splitArmy} from '../supabase/functions/_shared/military3System';
import {queueConstruction} from '../supabase/functions/_shared/constructionQueueSystem';
import {startFocus} from '../supabase/functions/_shared/focusSystem';

// Accepted schema25 source and detached SDK fixtures only. Split existing
// soldiers and pay normal validators; no new troops, cash, materials or rooms.
const directory=process.argv[2]!;
const manifest=JSON.parse(readFileSync(join(directory,'manifest.json'),'utf8'));
const state=decodeCampaign(readFileSync(join(directory,manifest.war.filename),'utf8')).state;
const totalTroops=state.armies.reduce((sum,a)=>sum+a.troops,0);
const treasuryBefore=Object.values(state.countries).reduce((sum,c)=>sum+c.treasury,0);
const stocksBefore=new Map(Object.values(state.countries).map(c=>[c.id,{...c.stockpile!.amounts}]));
let splits=0,projects=0,focuses=0;
for(let pass=0;pass<3&&state.armies.length<500;pass++){
 for(const army of [...state.armies]){
  if(state.armies.length>=500)break;
  if(army.troops<8000)continue;
  try{splitArmy(state,army.ownerId,army.id,50);splits++;}catch{ /* Busy armies remain in their battle/siege. */ }
 }
}
assert.equal(state.armies.reduce((sum,a)=>sum+a.troops,0),totalTroops);
assert.ok(state.armies.length>=400,'Insufficient legal split armies');
for(const country of Object.values(state.countries).sort((a,b)=>a.id.localeCompare(b.id))){
 if(focuses<60&&!country.nationalFocus){try{startFocus(state,country.id,'eco-audit');focuses++;}catch{}}
 for(const province of state.provinces.filter(p=>p.ownerId===country.id).slice(0,5)){
  if((state.constructions?.length??0)+(state.constructionQueue?.length??0)>=240)break;
  for(const type of ['Farm','Infrastructure','Factory'] as const){
   try{queueConstruction(state,country.id,province,type);projects++;break;}catch{}
  }
 }
}
assert.ok(projects>=100,'Insufficient paid projects');assert.ok(focuses>=40);
for(const country of Object.values(state.countries)){
 assert.ok(country.treasury>=0);
 assert.ok(Object.values(country.stockpile!.amounts).every(n=>n===undefined||n>=0));
 const before=stocksBefore.get(country.id)!;
 for(const [resource,amount] of Object.entries(country.stockpile!.amounts))
  assert.ok((amount??0)<=(before[resource as keyof typeof before]??0)+.0001,'Fixture created resources');
}
const cashSpent=treasuryBefore-Object.values(state.countries).reduce((sum,c)=>sum+c.treasury,0);
assert.ok(cashSpent>focuses*220,'Projects must also debit real treasury');
const saved=JSON.parse(encodeCampaign(state,1,'Camera2.3 paid stress QA'));saved.metadata.lastPlayed=0;
const canonical=JSON.stringify(saved);assert.deepEqual(decodeCampaign(canonical).state,saved.state);
writeFileSync(join(directory,manifest.war.filename),canonical);
manifest.war={...manifest.war,sha256:createHash('sha256').update(canonical).digest('hex'),checksum:saved.checksum,
 armies:state.armies.length,constructions:state.constructions!.length,queuedConstructions:state.constructionQueue!.length,
 activeFocuses:Object.values(state.countries).filter(c=>c.nationalFocus).length,
 stress:{legalSplits:splits,totalTroopsConserved:totalTroops,paidProjects:projects,paidFocuses:focuses,cashSpent,noResourcesCreated:true}};
writeFileSync(join(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify(manifest.war));
