const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {withDangerousMod}=require('expo/config-plugins');
const NATIVE_PATH='node_modules/@shopify/react-native-skia/android/src/main/java/com/shopify/reactnative/skia/PlatformContext.java';
const ORIGINAL_SHA256='455b3245841865b895e87f2088a74a6f22665b2a7cd2b07ebf4f4b4ded81617e';
const MARKER='// DOMINION_UI_DISPATCH: preserve native queue coalescing through a posted UI task.';
const FIELD='    private final Handler mainHandler = new Handler(Looper.getMainLooper());';
const POSTED_FIELD=FIELD+'\n    private boolean mDominionDispatchAnnounced = false;';
const BEFORE=`    public void notifyTaskReady() {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            notifyTaskReadyNative();
        } else {
            mainHandler.post(this::notifyTaskReadyNative);
        }
    }`;
const AFTER=`    public void notifyTaskReady() {
        ${MARKER}
        // Never drain synchronously inside a gesture/animation callback. The
        // existing JNI queue and RNSkView redraw flag retain only one pending
        // dispatch while further camera properties publish their latest picture.
        mainHandler.post(() -> {
            android.os.Trace.beginSection("DOMINION_UI_TASKS");
            try {
                notifyTaskReadyNative();
            } finally {
                android.os.Trace.endSection();
            }
            if (!mDominionDispatchAnnounced) {
                mDominionDispatchAnnounced = true;
                android.util.Log.i("Dominion", "DOMINION_UI_DISPATCH posted-main-loop");
            }
        });
    }`;
const UNCHANGED=[
  ['node_modules/@shopify/react-native-skia/android/cpp/jni/JniPlatformContext.cpp','fe980c2e10bab283cc15cce5e499595b7ad0c91521f4ed2fadf86b175d5c326b'],
  ['node_modules/@shopify/react-native-skia/cpp/rnskia/RNSkView.h','ad7c059f93e9d6e86013b7b85bc28bae3d7830754964b895fc5714e08472800e'],
];
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
function once(source,before,after){if(source.split(before).length!==2)throw Error('Changed pinned UI dispatch layout');return source.replace(before,after);}
function originalUiDispatch(source){
  let original=source;
  if(source.includes(MARKER)){original=once(once(original,AFTER,BEFORE),POSTED_FIELD,FIELD);}
  if(hash(original)!==ORIGINAL_SHA256)throw Error('Review UI dispatch before changing pinned Skia source');
  return original;
}
function patchUiDispatch(source){
  const original=originalUiDispatch(source),patched=once(once(original,FIELD,POSTED_FIELD),BEFORE,AFTER);
  if(source.includes(MARKER)&&source!==patched)throw Error('Inconsistent UI dispatch patch');
  return patched;
}
function applyUiDispatch(root,proofDirectory){
  const metadata=JSON.parse(fs.readFileSync(path.join(root,'node_modules/@shopify/react-native-skia/package.json'),'utf8'));
  if(metadata.version!=='2.6.2')throw Error('UI dispatch requires reviewed Skia 2.6.2');
  const unchanged=UNCHANGED.map(([file,expected])=>{
    const actual=hash(fs.readFileSync(path.join(root,file)));
    if(actual!==expected)throw Error('Changed native task queue/view ownership contract: '+file);
    return {file,sha256:actual};
  });
  const file=path.join(root,NATIVE_PATH),patched=patchUiDispatch(fs.readFileSync(file,'utf8'));
  fs.writeFileSync(file,patched);
  const proof={skiaVersion:'2.6.2',nativePath:NATIVE_PATH,originalSourceSha256:ORIGINAL_SHA256,nativeSourceSha256:hash(patched),
    dispatch:'posted-main-loop',callbackRunsOnUiThread:true,synchronousUiDrain:false,nativeQueueAndViewUnchanged:unchanged,
    nativeWindowAndEglUnchanged:true,geometryChanges:false,extraImagesOrSurfaces:false,frameRateClaim:false};
  if(proofDirectory){fs.mkdirSync(proofDirectory,{recursive:true});fs.writeFileSync(path.join(proofDirectory,'skia-ui-dispatch.json'),JSON.stringify(proof,null,2)+'\n');}
  return proof;
}
module.exports=config=>withDangerousMod(config,['android',async mod=>{applyUiDispatch(mod.modRequest.projectRoot,mod.modRequest.platformProjectRoot);return mod;}]);
module.exports.patchUiDispatch=patchUiDispatch;
module.exports.applyUiDispatch=applyUiDispatch;
module.exports.restoreUiDispatch=originalUiDispatch;
module.exports.nativePath=NATIVE_PATH;
module.exports.originalSha256=ORIGINAL_SHA256;
