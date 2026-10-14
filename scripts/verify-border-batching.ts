/** Offline Skia raster comparison only. Native APK/gate checks remain required. */
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {createHash} from 'node:crypto';
import {mapSceneFor} from '../src/map/worldScene';
import {worldCountries} from '../src/world/catalog';
import {borderChunks,bordersInBounds} from '../src/map/borderChunks';
import {cameraCoverage} from '../src/map/cameraCoverage';
import {TILT} from '../src/map/camera';
import {smoothDetail} from '../src/map/atlas22';
import {GRAPHICS,type GraphicsPreset} from '../src/map/settings';

async function main(){
const load=createRequire(resolve('package.json'));
const wasmRoot=dirname(load.resolve('canvaskit-wasm/package.json'));
const kit=await load('canvaskit-wasm')({locateFile:(f:string)=>join(wasmRoot,'bin',f)});
const out=resolve(process.argv[2]??'border-batching-proof');mkdirSync(out,{recursive:true});
const scene=mapSceneFor({dataset:'modern-world-v2'});
const owners=new Map(worldCountries.flatMap(c=>c.provinceIds.map(id=>[id,c.id] as const)));
const center=scene.cities.find(c=>c.name==='Berlin')!.point;
const viewport={width:1280,height:720};
const rows=[];
for(const preset of ['Balanced','Performance'] as GraphicsPreset[]){
  for(const zoom of [.9,3.5,7,12]){
    const camera={x:zoom<1?720:center.x,y:zoom<1?360:center.y,zoom};
    const chunks=bordersInBounds(borderChunks(scene.edges,owners),cameraCoverage(camera,viewport));
    const detail=smoothDetail(zoom,preset==='Performance'?4:2.7,7);
    const native=chunks.map(chunk=>{
      const outer=new kit.PathBuilder(),inner=new kit.PathBuilder();
      for(const e of chunk.outer)outer.moveTo(e.a.x,e.a.y).lineTo(e.b.x,e.b.y);
      if(detail>0)for(const e of chunk.inner)inner.moveTo(e.a.x,e.a.y).lineTo(e.b.x,e.b.y);
      const paths={outer:outer.snapshot(),inner:inner.snapshot()};outer.delete();inner.delete();return paths;
    });
    const outerBuilder=new kit.PathBuilder(),innerBuilder=new kit.PathBuilder();
    for(const p of native){outerBuilder.addPath(p.outer);innerBuilder.addPath(p.inner);}
    const outer=outerBuilder.snapshot(),inner=innerBuilder.snapshot();outerBuilder.delete();innerBuilder.delete();
    const render=(batched:boolean)=>{
      const surface=kit.MakeSurface(viewport.width,viewport.height);
      if(!surface)throw Error('No software Skia surface');
      const canvas=surface.getCanvas(),paint=new kit.Paint();
      paint.setAntiAlias(true);paint.setStyle(kit.PaintStyle.Stroke);
      canvas.clear(kit.Color(11,32,48));
      canvas.translate(viewport.width/2,viewport.height/2);canvas.scale(zoom,zoom*TILT);canvas.translate(-camera.x,-camera.y);
      const drawInner=(p:typeof inner)=>{paint.setColor(kit.Color(35,43,41));paint.setAlphaf(.48*detail);paint.setStrokeWidth(.65/zoom);canvas.drawPath(p,paint);};
      const drawOuter=(p:typeof outer)=>{
        // Keep the accepted order of setAlphaf/setColor, including Skia's
        // alpha reset on setColor. This verifier must not silently fix styles.
        paint.setAlphaf(.9);paint.setColor(kit.Color(19,30,35));paint.setStrokeWidth(GRAPHICS[preset].borderWidth*1.65/zoom);canvas.drawPath(p,paint);
        paint.setAlphaf(.42);paint.setColor(kit.Color(227,201,145));paint.setStrokeWidth(.5/zoom);canvas.drawPath(p,paint);
      };
      if(batched){if(detail>0)drawInner(inner);drawOuter(outer);}
      else for(const p of native){if(detail>0)drawInner(p.inner);drawOuter(p.outer);}
      surface.flush();
      const image=surface.makeImageSnapshot();
      const pixels=image.readPixels(0,0,{width:viewport.width,height:viewport.height,colorType:kit.ColorType.RGBA_8888,alphaType:kit.AlphaType.Unpremul,colorSpace:kit.ColorSpace.SRGB}) as Uint8Array;
      const png=image.encodeToBytes() as Uint8Array;
      if(!pixels||!png)throw Error('No software pixels');
      image.delete();paint.delete();surface.dispose();
      return {pixels,png};
    };
    const before=render(false),after=render(true);
    let changed=0,over8=0,max=0,total=0;
    for(let p=0;p<before.pixels.length;p+=4){
      let delta=0;for(let c=0;c<3;c++){const d=Math.abs(before.pixels[p+c]!-after.pixels[p+c]!);delta=Math.max(delta,d);total+=d;}
      if(delta>0)changed++;if(delta>8)over8++;max=Math.max(max,delta);
    }
    const key=preset.toLowerCase()+'-'+zoom;
    writeFileSync(join(out,key+'-before.png'),before.png);writeFileSync(join(out,key+'-after.png'),after.png);
    rows.push({preset,zoom,chunks:chunks.length,segments:chunks.reduce((n,c)=>n+c.outer.length+(detail>0?c.inner.length:0),0),beforePathDraws:chunks.length*(detail>0?3:2),afterPathDraws:detail>0?3:2,changedPixels:changed,pixelsOver8:over8,pixelFractionOver8:over8/(viewport.width*viewport.height),maxChannelDelta:max,meanChannelDelta:total/(viewport.width*viewport.height*3),sha256:[before.png,after.png].map(p=>createHash('sha256').update(p).digest('hex'))});
    outer.delete();inner.delete();for(const p of native){p.outer.delete();p.inner.delete();}
  }
}
const report={kind:'offline-cpu-Skia-border-draw-order-comparison',canvasKitVersion:load('canvaskit-wasm/package.json').version,viewport,rows,limitations:['CanvasKit software raster differs from Android native Skia/GPU.','Exact vertices are retained, but batching can change overlapping stroke antialiasing at joins.','This comparison does not measure Android frame time or pass the performance gate.']};
writeFileSync(join(out,'border-batching-proof.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
