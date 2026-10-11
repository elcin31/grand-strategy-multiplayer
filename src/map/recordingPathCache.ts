interface RecordingPath {dispose():void;countPoints():number}

/** Builders are borrowed only inside a synchronous recording callback. The
 * consumer copies/snapshots the geometry; neither React nor Canvas owns these
 * wrappers. Unlike the image/picture LRU, eviction may therefore free them.
 * Bytes estimate path points, verbs and builder overhead, not process PSS. */
export class RecordingPathCache<T extends RecordingPath>{
  private entries=new Map<string,{path:T;bytes:number}>();
  bytes=0;
  constructor(readonly maxBytes=8*1024*1024,readonly maxEntries=2048){}
  withPath(key:string,create:()=>T,record:(path:T)=>void):void{
    const cached=this.entries.get(key);
    if(cached){this.entries.delete(key);this.entries.set(key,cached);record(cached.path);return;}
    const path=create(),points=path.countPoints(),bytes=256+points*16;
    if(!Number.isSafeInteger(points)||points<0||bytes>this.maxBytes||this.maxEntries<1){
      try{record(path);}finally{path.dispose();}return;
    }
    this.entries.set(key,{path,bytes});this.bytes+=bytes;
    while(this.bytes>this.maxBytes||this.entries.size>this.maxEntries){
      const first=this.entries.keys().next().value!,entry=this.entries.get(first)!;
      this.entries.delete(first);this.bytes-=entry.bytes;entry.path.dispose();
    }
    record(path);
  }
  clear():void{
    const paths=[...this.entries.values()];this.entries.clear();this.bytes=0;
    for(const entry of paths)entry.path.dispose();
  }
  get size():number{return this.entries.size;}
}
