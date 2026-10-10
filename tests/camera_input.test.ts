import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCameraInput,queueCameraInput,takeCameraInput} from '../src/performance/cameraInput';
import {nextFrameDeadline} from '../src/performance/framePacing';
import {TILT,clamp} from '../src/map/camera';

test('pointer bursts preserve the latest exact position at30/60fps without replaying stale input',()=>{
  for(const target of [30,60]){
    const input=createCameraInput({x:720,y:360,zoom:3.5});let deadline=0,painted=0,last=0;
    //180 input events/sec and a90Hz display: pointer and presentation clocks differ.
    for(let i=1;i<=1800;i++){
      const now=i*1000/180,x=720+100*Math.sin(i/100);
      queueCameraInput(input,x,360,3.5,false);
      if(i%2===0&&now>=deadline-.5){
        deadline=nextFrameDeadline(now,deadline,target);
        const next=takeCameraInput(input)!;assert.equal(next.x,x);last=next.x;painted++;
      }
    }
    const final=takeCameraInput(input);if(final)last=final.x;
    assert.equal(last,720+100*Math.sin(18));assert.equal(input.events,1800);
    assert.ok(Math.abs(painted-target*10)<=1);
    assert.ok(input.commits<=target*10+2);assert.ok(input.commits<input.events/2);
    assert.equal(takeCameraInput(input),null);
  }
});

test('pinch keeps its geographic focal anchor through interrupted display frames and final handoff',()=>{
  const input=createCameraInput({x:720,y:360,zoom:1});
  const focal={x:110,y:90},anchor={x:800,y:300};
  for(let i=0;i<=120;i++){
    const zoom=1+2*Math.sin(Math.PI*i/120);
    queueCameraInput(input,anchor.x-focal.x/zoom,anchor.y-focal.y/(zoom*TILT),zoom);
    if(i%12===0){
      const pose=takeCameraInput(input)!;
      assert.ok(Math.abs(pose.x+focal.x/pose.zoom-anchor.x)<1e-10);
      assert.ok(Math.abs(pose.y+focal.y/(pose.zoom*TILT)-anchor.y)<1e-10);
      assert.equal(pose.updateZoom,true);
    }
  }
  queueCameraInput(input,690,210,1); // last pointer arrives after the last display frame
  assert.deepEqual(takeCameraInput(input),{x:690,y:210,zoom:1,updateZoom:true});
  assert.equal(takeCameraInput(input),null,'Gesture end cannot apply the last position twice');
});

test('pan handoff consumes the final bounded position before inertia without cancelling concurrent zoom',()=>{
  const input=createCameraInput({x:800,y:160,zoom:3.5});
  for(const translation of [0,30,300,5000])queueCameraInput(input,clamp(800-translation/3.5,0,1440),160,3.5,false);
  const pose=takeCameraInput(input)!;
  assert.deepEqual(pose,{x:0,y:160,zoom:3.5,updateZoom:false});
  assert.equal(takeCameraInput(input),null,'Later frame cannot overwrite inertia with stale gesture data');
  assert.equal(input.commits,1);assert.equal(input.events,4);
});

test('invalid pointer coordinates cannot poison a valid pending pose or another campaign',()=>{
  const defaults={x:800,y:160,zoom:3.5},input=createCameraInput(defaults),other=createCameraInput(defaults);
  queueCameraInput(input,700,200,2);
  for(const bad of [NaN,Infinity,-Infinity]){
    queueCameraInput(input,bad,0,1);queueCameraInput(input,0,bad,1);queueCameraInput(input,0,0,bad);
  }
  queueCameraInput(input,0,0,0);queueCameraInput(input,0,0,-1);
  assert.deepEqual(takeCameraInput(input),{x:700,y:200,zoom:2,updateZoom:true});
  assert.equal(input.events,1);assert.equal(other.pending,false);assert.equal(other.events,0);
  assert.deepEqual(defaults,{x:800,y:160,zoom:3.5});
});
