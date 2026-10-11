import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import CanvasKitInit,{type Canvas,type CanvasKit} from 'canvaskit-wasm';
import {RecordingPathCache} from '../src/map/recordingPathCache';
import {rasterImageDraw} from '../src/map/rasterImageDraw';
import {RASTER_LEVELS} from '../src/map/cameraCoverage';

const require=createRequire(import.meta.url);
const skia=()=>CanvasKitInit({locateFile:file=>require.resolve('canvaskit-wasm/bin/'+file)});
const pixels=(s:CanvasKit,c:Canvas)=>{
  const data=c.readPixels(0,0,{width:64,height:48,colorType:s.ColorType.RGBA_8888,alphaType:s.AlphaType.Unpremul,colorSpace:s.ColorSpace.SRGB});
  assert.ok(data);return data;
};

test('recorded raster pictures preserve accepted linear image pixels and non-AA tile clips through camera transforms',async()=>{
  const s=await skia(),surface=s.MakeSurface(64,48);assert.ok(surface);
  const source=s.MakeSurface(20,20);assert.ok(source);
  const paint=new s.Paint();paint.setAntiAlias(false);
  const src=source.getCanvas();src.clear(s.TRANSPARENT);
  for(let y=0;y<20;y+=2)for(let x=0;x<20;x+=2){paint.setColor(s.Color(x*12,y*12,(x+y)*6));src.drawRect(s.XYWHRect(x,y,2,2),paint);}
  source.flush();const image=source.makeImageSnapshot();
  const tile={bounds:{left:3.25,top:4.125,right:11.25,bottom:12.125},level:RASTER_LEVELS[0]};
  const {source:a,destination:b,clip}=rasterImageDraw(tile,20,20);
  const recorder=new s.PictureRecorder(),recording=recorder.beginRecording(s.XYWHRect(b.x,b.y,b.width,b.height));
  recording.clipRect(s.XYWHRect(clip.x,clip.y,clip.width,clip.height),s.ClipOp.Intersect,false);
  recording.drawImageRectOptions(image,s.XYWHRect(a.x,a.y,a.width,a.height),s.XYWHRect(b.x,b.y,b.width,b.height),s.FilterMode.Linear,s.MipmapMode.None,paint);
  const picture=recorder.finishRecordingAsPicture();recorder.delete();
  try{
    for(const zoom of [.5,1,2.7,3.5])for(const pan of [-1.125,2.375]){
      const draw=(pictureMode:boolean):Uint8Array|Float32Array=>{
        const c:Canvas=surface.getCanvas();c.clear(s.TRANSPARENT);c.save();c.translate(pan+5,pan+2);c.scale(zoom,zoom*.86);
        if(pictureMode)c.drawPicture(picture);
        else{c.clipRect(s.XYWHRect(tile.bounds.left,tile.bounds.top,8,8),s.ClipOp.Intersect,false);c.drawImageRectOptions(image,s.XYWHRect(0,0,20,20),s.XYWHRect(tile.bounds.left-1,tile.bounds.top-1,10,10),s.FilterMode.Linear,s.MipmapMode.None,paint);}
        c.restore();surface.flush();return pixels(s,c);
      };
      assert.deepEqual(draw(true),draw(false),`zoom ${zoom}, pan ${pan}`);
    }
  }finally{picture.delete();image.delete();paint.delete();source.dispose();surface.dispose();}
});

test('every raster band keeps the full source pixels, exact two-pixel gutter and world-edge clip',()=>{
  for(const level of RASTER_LEVELS){
    const bounds={left:1392,top:704,right:1440,bottom:720};
    const width=Math.ceil(48*level.scale)+4,height=Math.ceil(16*level.scale)+4;
    const d=rasterImageDraw({bounds,level},width,height);
    assert.deepEqual(d.source,{x:0,y:0,width,height});
    assert.deepEqual(d.clip,{x:1392,y:704,width:48,height:16});
    assert.ok(Math.abs((d.destination.x-1392)*level.scale+2)<1e-9);
    assert.ok(Math.abs((d.destination.y-704)*level.scale+2)<1e-9);
    assert.ok(Math.abs(d.destination.width*level.scale-width)<1e-9);
    assert.ok(Math.abs(d.destination.height*level.scale-height)<1e-9);
  }
});

test('builder LRU eviction and scene cleanup cannot invalidate already-recorded native geometry',async()=>{
  const s=await skia(),surface=s.MakeSurface(64,48);assert.ok(surface);
  const disposed:number[]=[],cache=new RecordingPathCache<{dispose():void;countPoints():number;copyTo(canvas:Canvas):void}>(400,1);
  const paint=new s.Paint();paint.setColor(s.Color(255,0,0));paint.setAntiAlias(false);
  const picture=(id:number)=>{
    const recorder=new s.PictureRecorder(),canvas=recorder.beginRecording(s.XYWHRect(0,0,64,48));
    cache.withPath(String(id),()=>{
      const path=new s.PathBuilder();path.addRect(s.XYWHRect(4,4,6,6));
      return {countPoints:()=>4,dispose:()=>{path.delete();disposed.push(id);},copyTo(c:Canvas){const copied=path.snapshot();try{c.drawPath(copied,paint);}finally{copied.delete();}}};
    },path=>path.copyTo(canvas));
    const result=recorder.finishRecordingAsPicture();recorder.delete();return result;
  };
  const first=picture(1),warm=picture(1),second=picture(2);
  assert.deepEqual(disposed,[1]);assert.equal(cache.size,1);assert.equal(cache.bytes,320);
  cache.clear();assert.deepEqual(disposed,[1,2]);assert.equal(cache.bytes,0);assert.equal(cache.size,0);
  try{
    const c=surface.getCanvas();c.clear(s.TRANSPARENT);c.drawPicture(first);surface.flush();const expected=pixels(s,c);
    for(const p of [warm,second]){c.clear(s.TRANSPARENT);c.drawPicture(p);surface.flush();assert.deepEqual(pixels(s,c),expected);}
    assert.deepEqual(Array.from(expected.slice((6*64+6)*4,(6*64+6)*4+4)),[255,0,0,255]);
  }finally{first.delete();warm.delete();second.delete();paint.delete();surface.dispose();}
});

test('oversized and disabled recording caches release a borrowed builder even when recording fails',()=>{
  for(const cache of [new RecordingPathCache(10,1),new RecordingPathCache(1024,0)]){
    let disposed=0;const error=new Error('recording failed');
    assert.throws(()=>cache.withPath('large',()=>({countPoints:()=>100,dispose:()=>{disposed++;}}),()=>{throw error;}),actual=>actual===error);
    assert.equal(disposed,1);assert.equal(cache.size,0);assert.equal(cache.bytes,0);
  }
});
