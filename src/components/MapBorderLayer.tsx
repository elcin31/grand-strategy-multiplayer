import {memo,useEffect,useMemo,useRef} from 'react';
import {Picture,Skia,PaintStyle} from '@shopify/react-native-skia';
import {borderChunks,bordersInBounds,type BorderChunk} from '../map/borderChunks';
import {smoothDetail} from '../map/atlas22';
import type {Bounds} from '../map/geometry';
import type {MapScene} from '../map/worldScene';
import {withNativeRecordingObjects} from '../map/nativeRecording';
import {RecordingPathCache} from '../map/recordingPathCache';
import {GRAPHICS,type GraphicsPreset} from '../map/settings';
import {stableBorderZoom} from '../map/borderStyle';
import {recordMetrics,getMetrics} from '../performance/telemetry';
const prepared=new WeakMap<BorderChunk,{outer:ReturnType<typeof Skia.Path.Make>;inner?:ReturnType<typeof Skia.Path.Make>}>();
function borderPaths(chunk:BorderChunk,detail:boolean){
  let paths=prepared.get(chunk);if(!paths){const outer=Skia.Path.Make();for(const e of chunk.outer)outer.moveTo(e.a.x,e.a.y).lineTo(e.b.x,e.b.y);paths={outer};prepared.set(chunk,paths);}
  if(detail&&!paths.inner){paths.inner=Skia.Path.Make();for(const e of chunk.inner)paths.inner.moveTo(e.a.x,e.a.y).lineTo(e.b.x,e.b.y);}
  return paths;
}
export const MapBorderLayer=memo(function MapBorderLayer({scene,owners,bounds,zoom,preset}:{scene:MapScene;owners:ReadonlyMap<string,string>;bounds:Bounds;zoom:number;preset:GraphicsPreset}){
  const previousZoom=useRef(zoom),styleZoom=preset==='Balanced'||preset==='Performance'?stableBorderZoom(zoom,previousZoom.current):zoom;previousZoom.current=styleZoom;
  const query=useMemo(()=>bordersInBounds(borderChunks(scene.edges,owners),bounds),[scene,owners,bounds]);
  const prior=useRef(query);if(query.length!==prior.current.length||query.some((c,i)=>c!==prior.current[i]))prior.current=query;
  const chunks=prior.current;
  // Borrow aggregate builders only while recording. Native pictures snapshot
  // their paths, so the existing bounded path cache can safely evict builders.
  const paths=useMemo(()=>new RecordingPathCache<ReturnType<typeof Skia.Path.Make>>(8*1024*1024,8),[scene,owners]);
  useEffect(()=>()=>paths.clear(),[paths]);
  const key=useMemo(()=>chunks.map(c=>c.key).join('|'),[chunks]);
  const picture=useMemo(()=>{
    const start=performance.now();
    const picture=withNativeRecordingObjects(own=>{
      const recorder=own(Skia.PictureRecorder()),c=recorder.beginRecording(Skia.XYWHRect(0,0,1440,720));
      const paint=own(Skia.Paint());paint.setAntiAlias(true);paint.setStyle(PaintStyle.Stroke);
      const detail=smoothDetail(styleZoom,preset==='Performance'?4:2.7,7);
      const inner=(p:ReturnType<typeof Skia.Path.Make>)=>{paint.setColor(Skia.Color('#232b29'));paint.setAlphaf(.48*detail);paint.setStrokeWidth(.65/styleZoom);c.drawPath(p,paint);};
      const outer=(p:ReturnType<typeof Skia.Path.Make>)=>{
        paint.setAlphaf(.9);paint.setColor(Skia.Color('#131e23'));paint.setStrokeWidth(GRAPHICS[preset].borderWidth*1.65/styleZoom);c.drawPath(p,paint);
        paint.setAlphaf(.42);paint.setColor(Skia.Color('#e3c991'));paint.setStrokeWidth(.5/styleZoom);c.drawPath(p,paint);
      };
      // Preserve the accepted per-chunk recording order on High/Ultra.
      if(preset==='High'||preset==='Ultra'){
        for(const chunk of chunks){const p=borderPaths(chunk,detail>0);if(detail>0&&p.inner)inner(p.inner);outer(p.outer);}
        return recorder.finishRecordingAsPicture();
      }
      const draw=(kind:'outer'|'inner',record:(path:ReturnType<typeof Skia.Path.Make>)=>void)=>paths.withPath(key+':'+kind,()=>{
        const group=Skia.Path.Make();
        for(const chunk of chunks){const path=borderPaths(chunk,kind==='inner')[kind];if(path)group.addPath(path);}
        return group;
      },record);
      if(detail>0)draw('inner',inner);
      draw('outer',outer);
      return recorder.finishRecordingAsPicture();
    });
    const m=getMetrics();recordMetrics({borderVectorBuilds:m.borderVectorBuilds+1,borderVectorMs:m.borderVectorMs+performance.now()-start});
    return picture;
  },[chunks,key,paths,styleZoom,preset]);
  // One native display node, at most three path draws on Balanced/Performance.
  // Exact vertices are retained; zoom never creates bitmap surfaces.
  return <Picture picture={picture}/>;
});
