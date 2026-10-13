import {memo,useMemo} from 'react';
import {Picture,Skia,PaintStyle} from '@shopify/react-native-skia';
import {borderChunks,bordersInBounds} from '../map/borderChunks';
import {smoothDetail} from '../map/atlas22';
import type {Bounds} from '../map/geometry';
import type {MapScene} from '../map/worldScene';
import {withNativeRecordingObjects} from '../map/nativeRecording';
import {GRAPHICS,type GraphicsPreset} from '../map/settings';
export const MapBorderLayer=memo(function MapBorderLayer({scene,owners,bounds,zoom,preset}:{scene:MapScene;owners:ReadonlyMap<string,string>;bounds:Bounds;zoom:number;preset:GraphicsPreset}){
  const picture=useMemo(()=>withNativeRecordingObjects(own=>{
    const recorder=own(Skia.PictureRecorder()),c=recorder.beginRecording(Skia.XYWHRect(0,0,1440,720));
    const paint=own(Skia.Paint());paint.setAntiAlias(true);paint.setStyle(PaintStyle.Stroke);
    const outer=own(Skia.Path.Make()),inner=own(Skia.Path.Make());
    for(const chunk of bordersInBounds(borderChunks(scene.edges,owners),bounds)){
      for(const e of chunk.outer)outer.moveTo(e.a.x,e.a.y).lineTo(e.b.x,e.b.y);
      for(const e of chunk.inner)inner.moveTo(e.a.x,e.a.y).lineTo(e.b.x,e.b.y);
    }
    const detail=smoothDetail(zoom,preset==='Performance'?4:2.7,7);
    if(detail>0){paint.setColor(Skia.Color('#232b29'));paint.setAlphaf(.48*detail);paint.setStrokeWidth(.65/zoom);c.drawPath(inner,paint);}
    paint.setAlphaf(.9);paint.setColor(Skia.Color('#131e23'));paint.setStrokeWidth(GRAPHICS[preset].borderWidth*1.65/zoom);c.drawPath(outer,paint);
    paint.setAlphaf(.42);paint.setColor(Skia.Color('#e3c991'));paint.setStrokeWidth(.5/zoom);c.drawPath(outer,paint);
    return recorder.finishRecordingAsPicture();
  }),[scene,owners,bounds,zoom,preset]);
  return <Picture picture={picture}/>;
});
