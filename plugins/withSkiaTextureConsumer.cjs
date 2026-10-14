const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {withDangerousMod}=require('expo/config-plugins');
const NATIVE_PATH='node_modules/@shopify/react-native-skia/android/cpp/rnskia-android/RNSkOpenGLCanvasProvider.cpp';
const ORIGINAL_SHA256='dd82eeb01ff28830b9705ac4069a7e967825aee60e4778f82e9f6de19f405bd8';
const MARKER='// DOMINION_HWUI_CONSUMER: TextureView owns its SurfaceTexture consumer.';
const BEFORE=`    if (_jSurfaceTexture) {
      JNIEnv *env = facebook::jni::Environment::current();
      env->CallVoidMethod(_jSurfaceTexture, _updateTexImageMethod);

      // Check for exceptions
      if (env->ExceptionCheck()) {
        RNSkLogger::logToConsole(
            "updateAndRelease() failed. The exception above "
            "can safely be ignored");
        env->ExceptionClear();
      }
    }
`;
const AFTER=`    ${MARKER}
    // This EGL window produces buffers. HWUI consumes them in its own context.
    // Calling updateTexImage here repeatedly throws on the producer/UI thread.
`;
const ANNOUNCE_BEFORE='  // Post redraw request to ensure we paint in the next draw cycle.\n  _requestRedraw();';
const ANNOUNCE_AFTER='  RNSkLogger::logToConsole(std::string("DOMINION_PRESENTATION hwui-owned-consumer"));\n'+ANNOUNCE_BEFORE;
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');

function once(s,before,after){if(s.split(before).length!==2)throw Error('Unexpected pinned TextureView provider layout');return s.replace(before,after);}
function patchTextureConsumer(source){
  let original=source;
  if(source.includes(MARKER)){original=once(original,ANNOUNCE_AFTER,ANNOUNCE_BEFORE);original=once(original,AFTER,BEFORE);}
  if(hash(original)!==ORIGINAL_SHA256)throw Error('Review texture consumer ownership before changing pinned Skia');
  const patched=once(once(original,BEFORE,AFTER),ANNOUNCE_BEFORE,ANNOUNCE_AFTER);
  if(source.includes(MARKER)&&patched!==source)throw Error('Inconsistent texture consumer patch');
  return patched;
}
function applyTextureConsumer(root,proofDirectory){
  const metadata=JSON.parse(fs.readFileSync(path.join(root,'node_modules/@shopify/react-native-skia/package.json'),'utf8'));
  if(metadata.version!=='2.6.2')throw Error('Texture consumer fix requires reviewed Skia 2.6.2');
  const config=JSON.parse(fs.readFileSync(path.join(root,'app.json'),'utf8')).expo;
  if(!config.plugins.includes('./plugins/withMapTextureOpacity.cjs'))throw Error('Texture ownership requires the guarded sole map TextureView');
  const view=fs.readFileSync(path.join(root,'node_modules/@shopify/react-native-skia/android/src/main/java/com/shopify/reactnative/skia/SkiaTextureView.java'),'utf8');
  if(!view.includes('extends TextureView')||!view.includes('setSurfaceTextureListener(this)')||!view.includes('mApi.onSurfaceTextureCreated(surfaceTexture, width, height)'))throw Error('Changed Java consumer ownership');
  const file=path.join(root,NATIVE_PATH),patched=patchTextureConsumer(fs.readFileSync(file,'utf8'));fs.writeFileSync(file,patched);
  const proof={skiaVersion:'2.6.2',nativePath:NATIVE_PATH,originalSourceSha256:ORIGINAL_SHA256,
    nativeSourceSha256:hash(patched),presentationBackend:'TextureView',consumerOwner:'Android HWUI',
    producerCallsUpdateTexImage:false,javaSurfaceLifecycleUnchanged:true,nativeWindowLifecycleUnchanged:true,
    drawingAndPresentUnchanged:true,geometryChanges:false,extraImagesOrSurfaces:false,frameRateClaim:false};
  if(proofDirectory){fs.mkdirSync(proofDirectory,{recursive:true});fs.writeFileSync(path.join(proofDirectory,'skia-texture-consumer.json'),JSON.stringify(proof,null,2)+'\n');}
  return proof;
}
module.exports=config=>withDangerousMod(config,['android',async mod=>{applyTextureConsumer(mod.modRequest.projectRoot,mod.modRequest.platformProjectRoot);return mod;}]);
module.exports.patchTextureConsumer=patchTextureConsumer;
module.exports.applyTextureConsumer=applyTextureConsumer;
module.exports.nativePath=NATIVE_PATH;
