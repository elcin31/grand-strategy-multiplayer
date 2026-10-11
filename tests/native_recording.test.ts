import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import CanvasKitInit,{type Canvas} from 'canvaskit-wasm';
import {withNativeRecordingObjects} from '../src/map/nativeRecording';

test('finished Skia pictures keep exact path and paint snapshots after temporary native builders and recorder are released',async()=>{
  const require=createRequire(import.meta.url),skia=await CanvasKitInit({locateFile:file=>require.resolve('canvaskit-wasm/bin/'+file)});
  const surface=skia.MakeSurface(16,10);assert.ok(surface);
  try{
    for(let frame=0;frame<30;frame++){
      const disposed:string[]=[];
      const picture=withNativeRecordingObjects(own=>{
        const recorder=new skia.PictureRecorder();own({dispose:()=>{recorder.delete();disposed.push('recorder');}});
        const canvas=recorder.beginRecording(skia.XYWHRect(0,0,16,10));
        const paint=new skia.Paint();own({dispose:()=>{paint.delete();disposed.push('paint');}});paint.setAntiAlias(false);
        const builder=new skia.PathBuilder();own({dispose:()=>{builder.delete();disposed.push('builder');}});builder.addRect(skia.XYWHRect(2,2,4,4));
        const left=builder.snapshot();own({dispose:()=>left.delete()});paint.setColor(skia.Color(255,0,0));canvas.drawPath(left,paint);
        builder.offset(6,0);const right=builder.snapshot();own({dispose:()=>right.delete()});paint.setColor(skia.Color(0,0,255));canvas.drawPath(right,paint);
        // The returned picture is deliberately not owned by the temporary scope.
        return recorder.finishRecordingAsPicture();
      });
      assert.deepEqual(disposed,['builder','paint','recorder']);
      try{
        const canvas:Canvas=surface.getCanvas();canvas.clear(skia.TRANSPARENT);canvas.drawPicture(picture);surface.flush();
        const pixels:Float32Array|Uint8Array|null=canvas.readPixels(0,0,{width:16,height:10,colorType:skia.ColorType.RGBA_8888,alphaType:skia.AlphaType.Unpremul,colorSpace:skia.ColorSpace.SRGB});assert.ok(pixels);
        const pixel=(x:number,y:number)=>Array.from(pixels.slice((y*16+x)*4,(y*16+x)*4+4));
        assert.deepEqual(pixel(4,4),[255,0,0,255]);assert.deepEqual(pixel(10,4),[0,0,255,255]);assert.deepEqual(pixel(0,0),[0,0,0,0]);
      }finally{picture.delete();}
    }
  }finally{surface.dispose();}
});

test('a failed recording releases every temporary object once and preserves the recording error',()=>{
  const error=new Error('recording failed'),released:string[]=[],cached={dispose:()=>assert.fail('cached geometry must stay alive')};
  assert.throws(()=>withNativeRecordingObjects(own=>{
    const builder=own({dispose:()=>released.push('builder')});own(builder);
    own({dispose:()=>{released.push('paint');throw new Error('cleanup failed');}});
    own({dispose:()=>released.push('recorder')});void cached;
    throw error;
  }),actual=>actual===error);
  assert.deepEqual(released,['recorder','paint','builder']);
});

test('successful recording reports cleanup failure after releasing the remaining native temporaries',()=>{
  const error=new Error('cleanup failed'),released:string[]=[];
  assert.throws(()=>withNativeRecordingObjects(own=>{
    own({dispose:()=>released.push('recorder')});own({dispose:()=>{released.push('builder');throw error;}});
    return 'picture';
  }),actual=>actual===error);
  assert.deepEqual(released,['builder','recorder']);
});
