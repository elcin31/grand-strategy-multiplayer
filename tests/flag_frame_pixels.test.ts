import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import CanvasKitInit,{type CanvasKit,type Canvas} from 'canvaskit-wasm';
import {flagFrameGroups,type FlagFrame} from '../src/map/flagFrameGroups';

const require=createRequire(import.meta.url);
const init=()=>CanvasKitInit({locateFile:file=>require.resolve('canvaskit-wasm/bin/'+file)});
function draw(s:CanvasKit,c:Canvas,frames:readonly FlagFrame[],grouped:boolean,union=false){
  const paint=new s.Paint();paint.setColor(s.Color(198,167,106));paint.setAntiAlias(true);
  try{
    for(const group of grouped?flagFrameGroups(frames):union?[frames]:frames.map(f=>[f])){
      if(group.length===1&&!union){const f=group[0]!;c.drawRect(s.XYWHRect(f.x,f.y,f.width,f.height),paint);}
      else{
        const builder=new s.PathBuilder();for(const f of group)builder.addRect(s.XYWHRect(f.x,f.y,f.width,f.height));
        const path=builder.detach();try{c.drawPath(path,paint);}finally{path.delete();builder.delete();}
      }
    }
  }finally{paint.delete();}
}

test('isolated frame pixels match analytic rectangles through fractional pan and zoom',async()=>{
  const s=await init(),surface=s.MakeSurface(320,180);assert.ok(surface);
  const frames=[{x:10.12,y:12.23,width:22,height:16},{x:56.625,y:20.875,width:37.4,height:27.2},{x:99.475,y:64.225,width:12.1,height:8.8}];
  try{
    for(const zoom of [.5,.8,1,1.3,2.7])for(const pan of [0,.125,.375,.875]){
      const sample=(grouped:boolean):Uint8Array|Float32Array|null=>{
        const c:Canvas=surface.getCanvas();c.clear(s.TRANSPARENT);c.save();c.translate(pan+5,4.125);c.scale(zoom,zoom*.86);
        draw(s,c,frames,grouped);c.restore();surface.flush();
        return c.readPixels(0,0,{width:320,height:180,colorType:s.ColorType.RGBA_8888,alphaType:s.AlphaType.Premul,colorSpace:s.ColorSpace.SRGB});
      };
      assert.deepEqual(sample(true),sample(false),`analytic rectangle pixels at ${zoom}/${pan}`);
    }
  }finally{surface.dispose();}
});

test('overlapping and touching frame pixels retain the existing compound winding union',async()=>{
  const s=await init(),surface=s.MakeSurface(320,180);assert.ok(surface);
  const frames=[{x:10.125,y:12.375,width:22,height:16},{x:29.25,y:16.875,width:22,height:16},{x:51.25,y:17.125,width:37.4,height:27.2}];
  try{
    for(const zoom of [.5,1,1.3,2.7]){
      const sample=(grouped:boolean):Uint8Array|Float32Array|null=>{
        const c:Canvas=surface.getCanvas();c.clear(s.TRANSPARENT);c.save();c.translate(.375,.875);c.scale(zoom,zoom*.86);
        draw(s,c,frames,grouped,!grouped);c.restore();surface.flush();
        return c.readPixels(0,0,{width:320,height:180,colorType:s.ColorType.RGBA_8888,alphaType:s.AlphaType.Premul,colorSpace:s.ColorSpace.SRGB});
      };
      assert.deepEqual(sample(true),sample(false),`overlap union at ${zoom}`);
    }
  }finally{surface.dispose();}
});
