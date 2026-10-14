const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {withDangerousMod}=require('expo/config-plugins');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const root='node_modules/@shopify/react-native-skia/';
const header='cpp/api/DominionImmutablePath.h';
const bindings=[
  {file:'cpp/api/JsiSkPathFactory.h',sha:'62c2a1186da194c85d04e65aca643f98427e86ccd33320cd52351b054d8b0164',changes:[
    ['#include "JsiSkHostObjects.h"','#include "JsiSkHostObjects.h"\n#include "DominionImmutablePath.h"'],
    ['  JSI_HOST_FUNCTION(Make) {',`  JSI_HOST_FUNCTION(MakeDominionImmutable) {
    if(count!=1)throw jsi::JSError(runtime,"Expected one native border path");
    auto source=arguments[0].asObject(runtime).asHostObject<JsiSkPath>(runtime)->getObject();
    auto holder=std::make_shared<JsiDominionImmutablePath>(getContext(),source->snapshot());
    return JSI_CREATE_HOST_OBJECT_WITH_MEMORY_PRESSURE(runtime,holder,getContext());
  }

  JSI_HOST_FUNCTION(Make) {`],
    ['  JSI_EXPORT_FUNCTIONS(JSI_EXPORT_FUNC(JsiSkPathFactory, Make),','  JSI_EXPORT_FUNCTIONS(JSI_EXPORT_FUNC(JsiSkPathFactory, MakeDominionImmutable),\n                       JSI_EXPORT_FUNC(JsiSkPathFactory, Make),'],
  ]},
  {file:'cpp/api/JsiSkCanvas.h',sha:'4e20c521175c6a80dc950f1aa47d70d96bd6ac654959e9ae1c9b5b647e61ba95',changes:[
    ['#include "JsiSkPath.h"','#include "JsiSkPath.h"\n#include "DominionImmutablePath.h"'],
    ['  JSI_HOST_FUNCTION(drawPath) {',`  JSI_HOST_FUNCTION(drawDominionImmutablePath) {
    if(count!=2)throw jsi::JSError(runtime,"Expected native border path and paint");
    auto geometry=JsiDominionImmutablePath::read(runtime,arguments[0]);
    auto paint=JsiSkPaint::fromValue(runtime,arguments[1]);
    _canvas->drawPath(*geometry,*paint);
    return jsi::Value::undefined();
  }

  JSI_HOST_FUNCTION(drawPath) {`],
    ['JSI_EXPORT_FUNC(JsiSkCanvas, drawPath),','JSI_EXPORT_FUNC(JsiSkCanvas, drawDominionImmutablePath),\n                       JSI_EXPORT_FUNC(JsiSkCanvas, drawPath),'],
  ]},
];
function once(source,before,after){
  if(source.split(before).length!==2)throw Error('Unexpected pinned immutable border API layout');
  return source.replace(before,after);
}
function patch(source,binding){
  let original=source;
  if(source.includes('#include "DominionImmutablePath.h"'))for(const [a,b]of [...binding.changes].reverse())original=once(original,b,a);
  if(hash(original)!==binding.sha)throw Error('Review immutable borders before changing pinned Skia source');
  let output=original;for(const [a,b]of binding.changes)output=once(output,a,b);
  if(original!==source&&source!==output)throw Error('Inconsistent immutable border patch');
  return output;
}
function apply(projectRoot,proofDir){
  const pkg=JSON.parse(fs.readFileSync(path.join(projectRoot,root,'package.json'),'utf8'));
  if(pkg.version!=='2.6.2')throw Error('Review immutable borders before changing Skia version');
  // Validate every input first; refuse partial patches if any SDK file drifts.
  const edits=bindings.map(b=>({file:root+b.file,originalSha256:b.sha,source:patch(fs.readFileSync(path.join(projectRoot,root,b.file),'utf8'),b)}));
  const nativeHeader=fs.readFileSync(path.join(__dirname,'native/DominionImmutablePath.h'),'utf8');
  for(const edit of edits)fs.writeFileSync(path.join(projectRoot,edit.file),edit.source);
  fs.writeFileSync(path.join(projectRoot,root,header),nativeHeader);
  const proof={skiaVersion:pkg.version,immutableBorderApi:1,mutablePathApiUnchanged:true,livePathsDisposed:false,
    imagesOrSurfacesAdded:false,nativeMemoryPressure:true,files:edits.map(e=>({file:e.file,originalSha256:e.originalSha256,sha256:hash(e.source)})),
    header:{file:root+header,sha256:hash(nativeHeader)}};
  if(proofDir){fs.mkdirSync(proofDir,{recursive:true});fs.writeFileSync(path.join(proofDir,'skia-immutable-borders.json'),JSON.stringify(proof,null,2)+'\n');}
  return proof;
}
module.exports=config=>withDangerousMod(config,['android',async mod=>{apply(mod.modRequest.projectRoot,mod.modRequest.platformProjectRoot);return mod;}]);
module.exports.applyImmutableBorders=apply;
module.exports.patchImmutableSource=patch;
module.exports.bindings=bindings;
