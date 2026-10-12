import {test} from 'node:test';
import assert from 'node:assert/strict';
import {flagFrameGroups,type FlagFrame} from '../src/map/flagFrameGroups';

test('dispersed country frames never share a viewport-sized compound mask',()=>{
  const frames=Array.from({length:10},(_,i)=>({x:23.125+i*84,y:19.375+i*32,width:22,height:16}));
  const copy=JSON.stringify(frames),groups=flagFrameGroups(frames);
  assert.equal(groups.length,frames.length);
  assert.ok(groups.every(g=>g.length===1));
  assert.deepEqual(groups.flat(),frames);
  assert.equal(JSON.stringify(frames),copy);
});

test('touching, overlapping and near AA edges retain the original winding union, including transitive bridges',()=>{
  const a:FlagFrame={x:0,y:0,width:22,height:16},b={x:20,y:0,width:22,height:16},c={x:43.5,y:0,width:22,height:16},remote={x:200,y:100,width:22,height:16};
  for(const input of [[a,b,c,remote],[a,c,remote,b],[remote,c,b,a]]){
    const groups=flagFrameGroups(input),joined=groups.find(g=>g.includes(a))!;
    assert.equal(joined.length,3);
    assert.ok(joined.includes(b)&&joined.includes(c));
    assert.deepEqual(groups.find(g=>g.includes(remote)),[remote]);
    assert.equal(new Set(groups.flat()).size,4);
  }
});

test('all original rectangles and signed fractional coordinates survive partitioning',()=>{
  assert.deepEqual(flagFrameGroups([]),[]);
  const frames:FlagFrame[]=[{x:-71.25,y:-19.875,width:12.1,height:8.8},{x:84.25,y:32.125,width:37.4,height:27.2}];
  const result=flagFrameGroups(frames).flat();
  assert.deepEqual(result,frames);
  assert.ok(result.every((frame,i)=>frame===frames[i]));
});
