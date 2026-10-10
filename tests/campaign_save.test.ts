import {test} from 'node:test';import assert from 'node:assert/strict';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {CURRENT_STATE_VERSION} from '../supabase/functions/_shared/stateMigrations';
import {decodeCampaign,encodeCampaign,validateCampaign} from '../src/persistence/campaignCodec';
import {CampaignStore,type CampaignFiles} from '../src/persistence/campaignStore';
import {LocalTransport} from '../src/multiplayer/localTransport';
function storage(){const map=new Map<string,string>();const files:CampaignFiles={list:async()=>[...map.keys()],read:async n=>{const value=map.get(n);if(!value)throw Error('missing');return value;},write:async(n,t)=>{map.set(n,t);},move:async(a,b)=>{map.set(b,map.get(a)!);map.delete(a);},remove:async n=>{map.delete(n);}};return{map,files,store:new CampaignStore(files)};}
function world(){const s=createWorldState('saveqa','SAV001','host','QA',32);s.players[0]!.countryId='germany';s.phase='paused';s.speed=0;return s;}
test('save/load/delete and metadata survive new repository and transport instances',async()=>{const{files,store}=storage(),s=world();await store.save(s,'Campaign QA');const restarted=new CampaignStore(files),entry=(await restarted.list())[0]!;assert.equal(entry.metadata!.name,'Campaign QA');assert.equal(entry.metadata!.country,'germany');const loaded=await restarted.load(s.id);assert.deepEqual(loaded,s);const session=await new LocalTransport().restore(loaded);assert.equal(session.playerId,'host');assert.equal(session.state.countries.germany!.treasury,s.countries.germany!.treasury);await restarted.delete(s.id);assert.equal((await restarted.list()).length,0);});
test('old optional state migrates sequentially; invalid ownership and future versions are rejected',()=>{const s=world();s.stateVersion=1;delete s.wars;delete s.diplomacy;delete s.commanders;for(const c of Object.values(s.countries)){delete c.technologies;delete c.warExhaustion;}for(const l of Object.values(s.leaders!))delete l.aiPersonality;const loaded=validateCampaign(s);assert.equal(loaded.stateVersion,CURRENT_STATE_VERSION);assert.equal(loaded.countries.germany!.technologies!.Military,0);assert.ok(loaded.leaders![loaded.countries.germany!.rulerId!]!.aiPersonality);s.provinces[0]!.ownerId='missing';assert.throws(()=>validateCampaign(s));const future=world();future.stateVersion=999;assert.throws(()=>validateCampaign(future));});
test('corrupted latest save reports an error and cannot be overwritten by autosave',async()=>{const{store,map}=storage(),s=world();await store.save(s);const name=[...map.keys()][0]!;map.set(name,'{broken');await assert.rejects(()=>store.load(s.id));await assert.rejects(()=>store.save(s));assert.equal(map.get(name),'{broken');assert.equal((await store.list())[0]!.metadata?.id,s.id); assert.throws(()=>decodeCampaign(encodeCampaign(s,1).replace('"checksum":"','"checksum":"bad')));});
test('interrupted write preserves prior generation; concurrent saves are serialized and bounded',async()=>{const{files,store,map}=storage(),s=world();await store.save(s);const broken=new CampaignStore({...files,move:async()=>{throw Error('disk interrupted');}});s.tick=1;await assert.rejects(()=>broken.save(s));assert.equal((await store.load(s.id)).tick,0);await Promise.all([store.save(s),store.save({...s,tick:2}),store.save({...s,tick:3})]);assert.equal((await store.load(s.id)).tick,3);assert.equal([...map.keys()].filter(n=>/\.\d+\.json$/.test(n)).length,2);});

test('indexed city ownership validation still rejects a mismatched country',()=>{const s=world();s.cities![0]!.countryId='germany';if(s.provinces.find(p=>p.id===s.cities![0]!.provinceId)!.ownerId==='germany')s.cities![0]!.countryId='france';assert.throws(()=>validateCampaign(s),/владение городом/);});

test('menu listing reads only the current metadata sidecar, while stale sidecars fall back to the snapshot',async()=>{const{files,store,map}=storage(),s=world();await store.save(s);const reads:string[]=[];const restarted=new CampaignStore({...files,read:async n=>{reads.push(n);return files.read(n);}});assert.equal((await restarted.list())[0]!.metadata!.id,s.id);assert.deepEqual(reads,[s.id+'.index.json']);map.set(s.id+'.index.json','{broken');reads.length=0;assert.equal((await restarted.list())[0]!.metadata!.id,s.id);assert.ok(reads.includes(s.id+'.1.json'));});

test('autosave resumes validation only after camera quiet when either file read finishes during a gesture',{timeout:30000},async()=>{
  for(const interruptedRead of ['saveqa.1.json','saveqa.2.json.pending']){
    const {files,store,map}=storage(),s=world();await store.save(s);
    const durable=map.get('saveqa.1.json');
    let resumed!:()=>void,readDone!:()=>void,parked=false,active=false,outcome='pending';
    const quiet=new Promise<void>(resolve=>{resumed=resolve;});
    const readReached=new Promise<void>(resolve=>{readDone=resolve;});
    const background=new CampaignStore({...files,read:async name=>{
      const text=await files.read(name);
      if(name===interruptedRead){active=true;readDone();return '{corrupt';}
      return text;
    }});
    const saving=background.save({...s,tick:1},undefined,{beforeWork:async()=>{
      if(active){parked=true;await quiet;}
    }});
    void saving.then(()=>{outcome='complete';},()=>{outcome='rejected';});
    await readReached;await new Promise<void>(resolve=>setImmediate(resolve));
    assert.equal(parked,true);assert.equal(outcome,'pending');
    assert.equal(map.has('saveqa.2.json'),false);
    active=false;resumed();await assert.rejects(saving);
    assert.equal(map.get('saveqa.1.json'),durable);
    assert.equal((await store.load(s.id)).tick,0);
  }
});

test('manual and lifecycle flushes release parked autosaves without cancelling their captured snapshot',{timeout:30000},async()=>{
  for(const manual of [true,false]){
    const {files,store,map}=storage(),s=world();await store.save(s);
    let parked!:()=>void,isUrgent:()=>boolean=()=>false;
    const reached=new Promise<void>(resolve=>{parked=resolve;});
    const input={...s,tick:1};
    const auto=store.save(input,undefined,{beforeWork:async urgent=>{
      isUrgent=urgent;parked();await new Promise<void>(()=>{});
    }});
    await reached;input.tick=9;
    assert.equal(map.has('saveqa.2.json'),false);
    const foreground=manual?store.save({...s,tick:2}):undefined;
    if(!manual)store.flushBackgroundWork();
    await auto;assert.equal(isUrgent(),true);
    assert.equal(decodeCampaign(map.get('saveqa.2.json')!).state.tick,1);
    if(foreground)await foreground;
    assert.equal((await new CampaignStore(files).load(s.id)).tick,manual?2:1);
  }
});
