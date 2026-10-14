import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
type Binding={file:string;sha:string;changes:[string,string][]};
const {bindings,patchImmutableSource,applyImmutableBorders}=require('../plugins/withSkiaImmutableBorders.cjs') as {
  bindings:Binding[];patchImmutableSource:(source:string,binding:Binding)=>string;
  applyImmutableBorders:(root:string,proof?:string)=>{files:{file:string;sha256:string}[];header:{file:string;sha256:string}};
};
const sdk='node_modules/@shopify/react-native-skia';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
function original(b:Binding){
  let source=readFileSync(join(sdk,b.file),'utf8');
  if(source.includes('#include "DominionImmutablePath.h"'))
    for(const [before,after] of [...b.changes].reverse())source=source.replace(after,before);
  assert.equal(hash(source),b.sha);return source;
}
function fixture(run:(root:string)=>void){
  const root=mkdtempSync(join(tmpdir(),'dominion-border-contract-'));
  const put=(file:string,value:string)=>{mkdirSync(dirname(join(root,file)),{recursive:true});writeFileSync(join(root,file),value);};
  put(sdk+'/package.json',JSON.stringify({version:'2.6.2'}));
  for(const b of bindings)put(sdk+'/'+b.file,original(b));
  try{run(root);}finally{rmSync(root,{recursive:true,force:true});}
}
test('pinned immutable border bindings are reversible and idempotent; reject upstream and patched drift',()=>{
  for(const b of bindings){
    const source=original(b),patched=patchImmutableSource(source,b);
    assert.equal(patchImmutableSource(patched,b),patched);
    let reversed=patched;for(const [before,after] of [...b.changes].reverse())reversed=reversed.replace(after,before);
    assert.equal(reversed,source,'existing mutable path implementation must remain byte-for-byte unchanged');
    assert.throws(()=>patchImmutableSource(source+'\n',b));
    assert.throws(()=>patchImmutableSource(patched.replace('DominionImmutablePath.h','UnexpectedPath.h'),b));
    assert.throws(()=>patchImmutableSource(patched.replace('JSI_HOST_FUNCTION(', 'JSI_CHANGED_FUNCTION('),b));
  }
});
test('native patch proof matches every actual file and repeated prebuild is stable',()=>fixture(root=>{
  const proofDir=join(root,'android'),proof=applyImmutableBorders(root,proofDir);
  for(const file of [...proof.files,proof.header])assert.equal(hash(readFileSync(join(root,file.file),'utf8')),file.sha256);
  assert.deepEqual(applyImmutableBorders(root,proofDir),proof);
  assert.deepEqual(JSON.parse(readFileSync(join(proofDir,'skia-immutable-borders.json'),'utf8')),proof);
}));
test('changed second SDK input refuses the entire patch before the first file is modified',()=>fixture(root=>{
  const first=join(root,sdk,bindings[0]!.file),before=readFileSync(first,'utf8');
  const second=join(root,sdk,bindings[1]!.file);writeFileSync(second,readFileSync(second,'utf8')+'\n');
  assert.throws(()=>applyImmutableBorders(root));assert.equal(readFileSync(first,'utf8'),before);
}));
test('changed Skia version refuses native mutation',()=>fixture(root=>{
  const first=join(root,sdk,bindings[0]!.file),before=readFileSync(first,'utf8');
  writeFileSync(join(root,sdk,'package.json'),JSON.stringify({version:'2.6.3'}));
  assert.throws(()=>applyImmutableBorders(root));assert.equal(readFileSync(first,'utf8'),before);
}));
