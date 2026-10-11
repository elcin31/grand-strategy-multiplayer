import {test} from 'node:test';
import assert from 'node:assert/strict';
import {processTransform3d} from '../node_modules/@shopify/react-native-skia/lib/commonjs/skia/types/Matrix4';
import {cameraMatrix} from '../src/map/cameraMatrix';
import {TILT,worldToScreen,screenToWorld,zoomAt} from '../src/map/camera';

const close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
test('direct camera matrix equals the pinned Skia six-transform compositor at every zoom and landscape size',()=>{
  for(const viewport of [{width:1280,height:664},{width:960,height:484},{width:2340,height:1024},{width:2560,height:1544},{width:1,height:1}]){
    for(let i=0;i<=240;i++){
      const x=i*6,y=(i*17)%721,zoom=.5+17.5*i/240;
      const legacy=processTransform3d([{translateX:viewport.width/2},{translateY:viewport.height/2},{scaleX:zoom},{scaleY:zoom*TILT},{translateX:-x},{translateY:-y}]);
      const actual=cameraMatrix(x,y,zoom,viewport.width,viewport.height);
      [0,1,3,4,5,7,12,13,15].forEach((index,n)=>close(actual[n]!,legacy[index]!));
      for(const point of [{x:0,y:0},{x:1440,y:720},{x,y},{x:790.125,y:176.875}]){
        const expected=worldToScreen(point,{x,y,zoom},viewport);
        close(actual[0]*point.x+actual[1]*point.y+actual[2],expected.x);
        close(actual[3]*point.x+actual[4]*point.y+actual[5],expected.y);
        const restored=screenToWorld(expected,{x,y,zoom},viewport);
        close(restored.x,point.x);close(restored.y,point.y);
      }
    }
  }
});

test('matrix projection keeps pinch focal points and final tap coordinates through camera handoff',()=>{
  const viewport={width:1280,height:664},focal={x:500,y:290};
  let camera={x:790,y:176,zoom:3.5};
  for(const factor of [1.1,1.3,.8,.7,1.4]){
    const anchor=screenToWorld(focal,camera,viewport);
    camera=zoomAt(camera,factor,focal,viewport);
    const m=cameraMatrix(camera.x,camera.y,camera.zoom,viewport.width,viewport.height);
    close(m[0]*anchor.x+m[2],focal.x);close(m[4]*anchor.y+m[5],focal.y);
  }
  const left=cameraMatrix(0,0,.5,1280,664),right=cameraMatrix(1440,720,18,1280,664);
  assert.equal(left[2],640);assert.equal(left[5],332);
  assert.ok([...left,...right].every(Number.isFinite));
});
