import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import CanvasKitInit,{type CanvasKit,type Image} from 'canvaskit-wasm';
import {RASTER_LEVELS,type RasterLevel} from '../src/map/cameraCoverage';
import {rasterTiles,visibleRasterTiles,RasterCache} from '../src/map/rasterTiles';
import {rasterImageDraw} from '../src/map/rasterImageDraw';
import {mapSceneFor} from '../src/map/worldScene';
import {boundsOf,featurePath,overlaps,type MapFeature} from '../src/map/geometry';

const whole={left:0,top:0,right:1440,bottom:720};
// Immutable historical grid for a pixel comparison, never selected by runtime.
const legacy={key:'world',cell:160,scale:2} as unknown as RasterLevel;
const require=createRequire(import.meta.url);
const bytes=(b:typeof whole,scale:number)=>(Math.ceil((b.right-b.left)*scale)+4)*(Math.ceil((b.bottom-b.top)*scale)+4)*4;

test('world batching retains every real province and the original surface/cache limits',()=>{
  const scene=mapSceneFor({dataset:'modern-world-v2'}),level=RASTER_LEVELS[0],tiles=rasterTiles(scene.features,level),old=rasterTiles(scene.features,legacy);
  assert.equal(scene.provinceGeometry.size,2924);
  assert.equal(old.length,45);assert.equal(tiles.length,15);
  assert.equal(level.scale,legacy.scale,'World pixel resolution is preserved');
  assert.ok(level.cell*level.scale<=576,'Existing decoded-side guard is unchanged');
  assert.equal(rasterTiles(scene.features,level),tiles);
  const images=new RasterCache<string>();let total=0;
  for(const tile of tiles){
    const size=bytes(tile.bounds,level.scale);assert.ok(size<=580*580*4);
    images.set(tile.key,tile.key,size);total+=size;
  }
  assert.equal(images.bytes,total);assert.equal(images.size,tiles.length);
  assert.ok(total<=32*1024*1024);assert.equal(images.maxColdBytes,8*1024*1024);
  for(const f of scene.provinceGeometry.values()){
    const containing=tiles.filter(t=>overlaps(t.bounds,f.bounds));
    assert.ok(containing.length>0,f.id);
    for(const t of containing)assert.ok(t.features.includes(f),f.id+' / '+t.key);
  }
});

test('world culling retains exhaustive geometry at seams, dateline, world edges and overscan',()=>{
  const scene=mapSceneFor({dataset:'modern-world-v2'}),level=RASTER_LEVELS[0];
  for(const point of [{x:0,y:0},{x:288,y:288},{x:576,y:576},{x:864,y:288},{x:1152,y:576},{x:1440,y:720},{x:792,y:160}]){
    for(const pad of [0,1,288]){
      const b={left:point.x-pad,top:point.y-pad,right:point.x+pad,bottom:point.y+pad},tiles=visibleRasterTiles(scene.features,b,level);
      for(const f of scene.spatialIndex.query(b))assert.ok(tiles.some(t=>t.features.includes(f)),f.id+' / '+JSON.stringify(b));
      assert.equal(new Set(tiles.map(t=>t.key)).size,tiles.length);
    }
  }
});

test('larger world cells preserve linear raster pixels, transparent terrain and two-pixel gutters through pan and pinch',async()=>{
  const s:CanvasKit=await CanvasKitInit({locateFile:file=>require.resolve('canvaskit-wasm/bin/'+file)});
  const output=s.MakeSurface(64,48);assert.ok(output);
  const ring=(left:number,top:number,right:number,bottom:number)=>[{x:left,y:top},{x:right,y:top},{x:right,y:bottom},{x:left,y:bottom},{x:left,y:top}];
  const feature=(id:string,points:ReturnType<typeof ring>):MapFeature=>({id,name:id,countryId:null,provinceId:id,polygons:[[points]],bounds:boundsOf(points),anchor:points[0]!});
  const features=[
    feature('transparent',ring(0,0,1440,720)),
    feature('west',[{x:1.125,y:3.375},{x:612.25,y:9.875},{x:528.5,y:631.25},{x:64.875,y:702.125},{x:1.125,y:3.375}]),
    feature('east',[{x:704.375,y:18.125},{x:1437.625,y:2.875},{x:1398.25,y:719.125},{x:672.875,y:669.375},{x:704.375,y:18.125}]),
  ];
  const paint=new s.Paint();paint.setAntiAlias(true);
  const paths=new Map(features.map(f=>{const p=s.Path.MakeFromSVGString(featurePath(f));assert.ok(p);return [f.id,p] as const;}));
  const river=s.Path.MakeFromSVGString('M0 161.25 L1440 577.375 M288.125 0 L1152.625 720');assert.ok(river);
  const colours=new Map([['transparent',s.TRANSPARENT],['west',s.Color(62,104,83)],['east',s.Color(173,139,98)]]);
  const make=(level:RasterLevel)=>{
    const images:{tile:ReturnType<typeof rasterTiles>[number];image:Image}[]=[];
    for(const tile of rasterTiles(features,level)){
      const b=tile.bounds,k=level.scale,w=Math.ceil((b.right-b.left)*k)+4,h=Math.ceil((b.bottom-b.top)*k)+4;
      const surface=s.MakeSurface(w,h);assert.ok(surface);
      try{
        const c=surface.getCanvas();c.clear(s.TRANSPARENT);c.translate(2-b.left*k,2-b.top*k);c.scale(k,k);
        paint.setStyle(s.PaintStyle.Fill);
        for(const f of tile.features){paint.setColor(colours.get(f.id)!);c.drawPath(paths.get(f.id)!,paint);}
        paint.setColor(s.Color(198,185,123,.35));c.drawCircle(288.125,160.75,96.625,paint);c.drawCircle(1151.875,576.125,74.25,paint);
        paint.setStyle(s.PaintStyle.Stroke);paint.setStrokeWidth(.4);paint.setColor(s.Color(101,148,165,.7));c.drawPath(river,paint);
        surface.flush();images.push({tile,image:surface.makeImageSnapshot()});
      }finally{surface.dispose();}
    }
    return images;
  };
  const old=make(legacy),batched=make(RASTER_LEVELS[0]),samplePaint=new s.Paint();
  const draw=(images:typeof old,x:number,y:number,zoom:number)=>{
    const c=output.getCanvas();c.clear(s.Color(32,60,76));c.save();c.translate(32.375-x*zoom,24.125-y*zoom*.86);c.scale(zoom,zoom*.86);
    for(const {tile,image}of images){
      const d=rasterImageDraw(tile,image.width(),image.height()),a=d.source,b=d.destination,clip=d.clip;
      c.save();c.clipRect(s.XYWHRect(clip.x,clip.y,clip.width,clip.height),s.ClipOp.Intersect,false);
      c.drawImageRectOptions(image,s.XYWHRect(a.x,a.y,a.width,a.height),s.XYWHRect(b.x,b.y,b.width,b.height),s.FilterMode.Linear,s.MipmapMode.None,samplePaint);c.restore();
    }
    c.restore();output.flush();
    const result=c.readPixels(0,0,{width:64,height:48,colorType:s.ColorType.RGBA_8888,alphaType:s.AlphaType.Unpremul,colorSpace:s.ColorSpace.SRGB});assert.ok(result);return new Uint8Array(result);
  };
  try{
    const differences:{zoom:number;center:number[];maxChannelDelta:number;changedChannels:number;alphaChanges:number;firstDifferences:{channel:number;actual:number;expected:number}[]}[]=[];
    for(const zoom of [.5,.875,1.3,1.95])for(const [x,y]of [[160.125,160.25],[287.875,288.375],[575.625,576.125],[1152.375,576.875],[1439.25,719.125]]){
      const actual=draw(batched,x!,y!,zoom),expected=draw(old,x!,y!,zoom);
      let maxChannelDelta=0,changedChannels=0,alphaChanges=0;
      const firstDifferences:{channel:number;actual:number;expected:number}[]=[];
      for(let i=0;i<actual.length;i++){
        const delta=Math.abs(actual[i]!-expected[i]!);maxChannelDelta=Math.max(maxChannelDelta,delta);
        if(delta){changedChannels++;if(i%4===3)alphaChanges++;if(firstDifferences.length<4)firstDifferences.push({channel:i,actual:actual[i]!,expected:expected[i]!});}
      }
      differences.push({zoom,center:[x!,y!],maxChannelDelta,changedChannels,alphaChanges,firstDifferences});
    }
    console.info('DOMINION_WORLD_PIXEL '+JSON.stringify(differences));
    assert.ok(differences.every(d=>d.maxChannelDelta===0),'Strict byte equality; all20 measured configurations retained before failure');
  }finally{
    for(const {image}of [...old,...batched])image.delete();
    for(const p of paths.values())p.delete();river.delete();paint.delete();samplePaint.delete();output.dispose();
  }
});
