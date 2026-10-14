import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {mapSceneFor} from '../src/map/worldScene';
import {worldCountries} from '../src/world/catalog';
import {borderChunks,bordersInBounds} from '../src/map/borderChunks';
import {cameraCoverage} from '../src/map/cameraCoverage';

const camera={x:800,y:160,zoom:3.5},viewport={width:1280,height:720};
const scene=mapSceneFor({dataset:'modern-world-v2'});
const owners=new Map(worldCountries.flatMap(c=>c.provinceIds.map(id=>[id,c.id] as const)));
const chunks=bordersInBounds(borderChunks(scene.edges,owners),cameraCoverage(camera,viewport));
const segments=chunks.reduce((n,c)=>n+c.outer.length+c.inner.length,0);
const data=Buffer.alloc(12+chunks.length*8+segments*16);
data.write('D23B',0,'ascii');data.writeUInt32LE(1,4);data.writeUInt32LE(chunks.length,8);
let offset=12;
for(const chunk of chunks){
  data.writeUInt32LE(chunk.outer.length,offset);data.writeUInt32LE(chunk.inner.length,offset+4);offset+=8;
  for(const e of [...chunk.outer,...chunk.inner])for(const value of [e.a.x,e.a.y,e.b.x,e.b.y]){
    if(!Number.isFinite(value))throw Error('Invalid original border coordinate');
    data.writeFloatLE(value,offset);offset+=4;
  }
}
if(offset!==data.length)throw Error('Invalid border fixture length');
const filename=process.argv[2]??'border-path-fixture.bin';writeFileSync(filename,data);
writeFileSync(filename+'.json',JSON.stringify({format:'D23B-v1',camera,viewport,chunks:chunks.length,segments,
  countries:worldCountries.length,provinceOwnerships:owners.size,bytes:data.length,
  sha256:createHash('sha256').update(data).digest('hex'),
  note:'Detached original render edges, converted to the same native float coordinates. No campaign/backend mutation.'},null,2)+'\n');
