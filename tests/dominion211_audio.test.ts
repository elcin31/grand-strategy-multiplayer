import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AudioController,AUDIO_KEY,parseAudioPreferences,type Player} from '../src/audio/controller';
test('audio mute and volume persist; background/resume preserves one music player',async()=>{
 const data=new Map<string,string>(),store={get:async(k:string)=>data.get(k)??null,set:async(k:string,v:string)=>{data.set(k,v);},remove:async(k:string)=>{data.delete(k);}};
 let created=0,plays=0,pauses=0;const driver={create:()=>{created++;return {volume:0,loop:false,play:()=>{plays++;},pause:()=>{pauses++;},seekTo:async()=>{},remove:()=>{}};}};
 const audio=new AudioController(store,{atlas:1,council:2,peace:3,click:4});await audio.start(driver);await audio.start(driver);assert.equal(created,1);assert.equal(plays,1);
 audio.update({master:.4,music:.2,sfx:.6,mute:true});await audio.flushed();const saved=JSON.parse(data.get(AUDIO_KEY)!);assert.equal(saved.mute,true);assert.equal(saved.master,.4);
 const before=plays;audio.play('click');await Promise.resolve();assert.equal(plays,before);
 audio.update({mute:false});audio.foreground(false);audio.foreground(true);assert.equal(created,1);assert.ok(pauses>0);assert.equal(audio.getSnapshot().music,.2);
 await audio.flushed();
 const restored=new AudioController(store,{atlas:1,council:2,peace:3});await restored.start(driver);assert.deepEqual(restored.getSnapshot(),audio.getSnapshot());audio.dispose();restored.dispose();
 assert.equal(parseAudioPreferences('{"master":99}').master,.7);
});
test('rapid duplicate cues are bounded and idle effect players are evicted',async()=>{
 let now=1000,created=0,removed=0,played=0;const sources=Object.fromEntries(['atlas','council','peace',...Array.from({length:12},(_,i)=>'effect'+i)].map((x,i)=>[x,i]));
 const driver={create:():Player=>{created++;return {volume:0,loop:false,play:()=>{played++;},pause:()=>{},seekTo:async()=>{},remove:()=>{removed++;}};}};
 const audio=new AudioController({get:async()=>null,set:async()=>{},remove:async()=>{}},sources,undefined,()=>now);await audio.start(driver);
 audio.play('effect0');audio.play('effect0');await Promise.resolve();assert.equal(created,2);assert.equal(played,2);
 for(let i=1;i<12;i++){now+=200;audio.play('effect'+i);await Promise.resolve();assert.ok(created-removed<=9);}
 audio.foreground(false);now+=200;const count=created;audio.play('effect1');assert.equal(created,count);audio.dispose();assert.equal(created,removed);
});
