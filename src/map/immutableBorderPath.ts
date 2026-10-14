import {Skia,type SkCanvas,type SkPaint,type SkPath} from '@shopify/react-native-skia';
import type {Edge} from './scene';
interface ImmutablePath {readonly __typename__:'DominionImmutablePath';countPoints():number;getGenerationID():number;dispose():void}
type BorderPath=SkPath|ImmutablePath;
type PathFactory=typeof Skia.Path&{MakeDominionImmutable?:(path:SkPath)=>ImmutablePath};
type NativeCanvas=SkCanvas&{drawDominionImmutablePath?:(path:ImmutablePath,paint:SkPaint)=>void};
let announced=false;
/** Replace the original cached builder with one immutable native geometry
 * holder. Legacy/web engines retain the accepted mutable implementation. */
export function makeBorderPath(edges:readonly Edge[]):BorderPath {
  const builder=Skia.Path.Make();
  try{for(const e of edges)builder.moveTo(e.a.x,e.a.y).lineTo(e.b.x,e.b.y);}
  catch(error){builder.dispose();throw error;}
  const factory=Skia.Path as PathFactory;
  if(!factory.MakeDominionImmutable)return builder;
  try{
    const immutable=factory.MakeDominionImmutable(builder);
    return immutable;
  }finally{builder.dispose();} // Exclusive source builder; the snapshot owns its coordinates.
}
export function drawBorderPath(canvas:SkCanvas,path:BorderPath,paint:SkPaint):void {
  if(path.__typename__==='DominionImmutablePath'){
    const native=canvas as NativeCanvas;
    if(!native.drawDominionImmutablePath)throw Error('Incomplete Dominion immutable border native API');
    native.drawDominionImmutablePath(path,paint);
    if(!announced){announced=true;console.info('DOMINION_BORDER_PATH immutable-native-v1');}
  }else canvas.drawPath(path,paint);
}
