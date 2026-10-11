export interface RecordingObject {dispose():void}

/** Own only temporary builders/paints/recorders used by synchronous draw calls.
 * Skia2.6.2 drawPath snapshots the builder and copies its paint; finishing a
 * recorder transfers the picture. Never register returned pictures, images,
 * fonts or cached geometry: those can still be displayed by the native Canvas.
 * Growing an initially empty native path does not update its JSI memory
 * pressure, so waiting for JS GC can retain much more than the raster budget. */
export function withNativeRecordingObjects<T>(record:(own:<R extends RecordingObject>(resource:R)=>R)=>T):T{
  const resources=new Set<RecordingObject>();let completed=false;
  try{
    const result=record(resource=>{resources.add(resource);return resource;});
    completed=true;return result;
  }finally{
    let cleanupError:unknown;
    for(const resource of [...resources].reverse()){
      try{resource.dispose();}catch(error){cleanupError??=error;}
    }
    // Keep a recording failure intact while still releasing every builder.
    if(completed&&cleanupError!==undefined)throw cleanupError;
  }
}
