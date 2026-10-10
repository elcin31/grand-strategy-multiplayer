import {performance} from 'node:perf_hooks';
import {execFileSync} from 'node:child_process';
import {writeFileSync,rmSync,existsSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {CampaignStore,type CampaignFiles} from '../src/persistence/campaignStore';
import {decodeCampaign} from '../src/persistence/campaignCodec';
const baselineRuntime='d7c3d593802f2edf27894f92fe10928341df0080';
const s=createWorldState('save-store-benchmark','SAVEB1','host','Benchmark',101);
s.players[0]!.countryId='germany';s.phase='paused';s.speed=0;
function files():CampaignFiles {
  const data=new Map<string,string>();
  return {list:async()=>[...data.keys()],read:async n=>data.get(n)!,write:async(n,t)=>{data.set(n,t);},move:async(a,b)=>{data.set(b,data.get(a)!);data.delete(a);},remove:async n=>{data.delete(n);}};
}
async function trial(Type:typeof CampaignStore) {
  const f=files(),store=new Type(f);await store.save(s);
  const next={...s,tick:1},started=performance.now();await store.save(next);const ms=performance.now()-started;
  assert.deepEqual(decodeCampaign(await f.read(s.id+'.2.json')).state,next);
  assert.equal(JSON.parse(await f.read(s.id+'.index.json')).metadata.generation,2);
  return ms;
}
function stats(values:number[]) {
  const sorted=[...values].sort((a,b)=>a-b);
  return {samples:values,median:sorted[Math.floor(sorted.length/2)],max:sorted.at(-1)};
}
async function main() {
  assert.ok(existsSync('src/persistence/campaignStore.ts'),'Run from the Dominion repository root');
  const path=resolve('src/persistence/campaignStore.benchmark-'+process.pid+'.ts');let created=false;
  try {
    writeFileSync(path,execFileSync('git',['show',baselineRuntime+':src/persistence/campaignStore.ts'],{encoding:'utf8'}),{flag:'wx'});created=true;
    const module=await import(pathToFileURL(path).href);
    const Baseline=(module.CampaignStore??module.default?.CampaignStore) as typeof CampaignStore;
    await trial(Baseline);await trial(CampaignStore);
    const before:number[]=[],after:number[]=[];
    for(let i=0;i<5;i++) {
      if(i%2===0){before.push(await trial(Baseline));after.push(await trial(CampaignStore));}
      else{after.push(await trial(CampaignStore));before.push(await trial(Baseline));}
    }
    console.log(JSON.stringify({baselineStoreRuntime:baselineRuntime,snapshotBytes:Buffer.byteLength(JSON.stringify(s)),beforeMs:stats(before),afterMs:stats(after),note:'Paired alternating host memory-file saves of identical validated paused world; one warmup and five timed existing-generation saves each. Integrity and metadata verified every trial. No filesystem IO/native latency or Android FPS claim; no camera guard in this CPU-only probe. Historical store implementation loaded from git; shared codec/engine current.'},null,2));
  } finally {if(created)rmSync(path,{force:true});}
}
void main();
