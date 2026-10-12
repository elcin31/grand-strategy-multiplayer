import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {patchTextureView,validateCanvasContract}=require('../plugins/withMapTextureOpacity.cjs') as {
  patchTextureView:(source:string)=>string;validateCanvasContract:(canvases:{path:string;source:string}[])=>void;
};
const native='node_modules/@shopify/react-native-skia/android/src/main/java/com/shopify/reactnative/skia/SkiaTextureView.java';

test('actual pinned TextureView changes only the opacity declaration and retains its callbacks',()=>{
  const source=readFileSync(native,'utf8');
  const original=source.replace('        // DOMINION_OPAQUE_MAP_TEXTURE: the sole canvas begins with a full opaque Fill.\n        setOpaque(true);','        setOpaque(false);');
  const patched=patchTextureView(original);
  assert.equal(patched.replace('        // DOMINION_OPAQUE_MAP_TEXTURE: the sole canvas begins with a full opaque Fill.\n        setOpaque(true);','        setOpaque(false);'),original);
  assert.match(patched,/extends TextureView/);assert.match(patched,/setOpaque\(true\)/);
  assert.equal(patchTextureView(patched),patched);
});

test('unknown native source and inconsistent opacity declarations fail the build contract',()=>{
  const source=readFileSync(native,'utf8');
  assert.throws(()=>patchTextureView(source.replace('extends TextureView','extends SurfaceView')));
  assert.throws(()=>patchTextureView(source.replace('setSurfaceTextureListener(this);','')));
  const original=source.replace('        // DOMINION_OPAQUE_MAP_TEXTURE: the sole canvas begins with a full opaque Fill.\n        setOpaque(true);','        setOpaque(false);');
  assert.throws(()=>patchTextureView(original+'\nsetOpaque(false);'));
  assert.throws(()=>patchTextureView(original.replace('        setOpaque(false);','    setOpaque(false);')));
});

test('current map is the sole canvas with an unconditional full opaque first Fill',()=>{
  validateCanvasContract([{path:'src/components/WorldMap.tsx',source:readFileSync('src/components/WorldMap.tsx','utf8')}]);
});

test('transparent, conditional, additional or other canvases cannot inherit opaque rendering',()=>{
  const good={path:'src/components/WorldMap.tsx',source:'<Canvas><Fill color="#203B48" /></Canvas>'};
  for(const canvases of [[],[good,good],[{...good,path:'src/components/Other.tsx'}],
    [{...good,source:'<Canvas><Fill color="transparent" /></Canvas>'}],
    [{...good,source:'<Canvas opaque={true}><Fill color="#203B48" /></Canvas>'}],
    [{...good,source:'<Canvas>{ready && <Fill color="#203B48" />}</Canvas>'}]])assert.throws(()=>validateCanvasContract(canvases));
});
