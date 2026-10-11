/** Sequential same-host transform microbenchmark, never hardware FPS. */
import {writeFileSync} from 'node:fs';
import {processTransform3d} from '../node_modules/@shopify/react-native-skia/lib/commonjs/skia/types/Matrix4';
import {cameraMatrix} from '../src/map/cameraMatrix';
import {TILT} from '../src/map/camera';

const iterations=200000;
function run(kind:'legacy'|'direct',count=iterations){
  let checksum=0;const started=performance.now();
  for(let i=0;i<count;i++){
    const x=i%1441,y=(i*17)%721,zoom=.5+(i%241)*17.5/240;
    if(kind==='legacy'){
      const m=processTransform3d([{translateX:640},{translateY:332},{scaleX:zoom},{scaleY:zoom*TILT},{translateX:-x},{translateY:-y}]);
      checksum+=m[0]+m[3]+m[5]+m[7];
    }else{
      const m=cameraMatrix(x,y,zoom,1280,664);checksum+=m[0]+m[2]+m[4]+m[5];
    }
  }
  return {kind,iterations:count,elapsedMs:performance.now()-started,checksum};
}
run('legacy',2000);run('direct',2000);
const samples=(['legacy','direct','direct','legacy'] as const).map(kind=>run(kind));
if(samples.some(s=>Math.abs(s.checksum-samples[0]!.checksum)>1e-5))throw Error('Projection changed');
const report={note:'Host Node microbenchmark of actual pinned Skia2.6.2 transform composition and equivalent direct matrix. Not UI/GPU time, native frame acceptance or physical FPS.',iterations,samples};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
