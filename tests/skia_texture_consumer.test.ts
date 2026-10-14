import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),plugin=require('../plugins/withSkiaTextureConsumer.cjs');
const source=readFileSync(plugin.nativePath,'utf8');

test('pinned producer stops acquiring the HWUI-owned consumer but retains drawing and window destruction',()=>{
  const patched=plugin.patchTextureConsumer(source);
  assert.equal(plugin.patchTextureConsumer(patched),patched);
  assert.ok(!patched.includes('env->CallVoidMethod(_jSurfaceTexture, _updateTexImageMethod)'));
  assert.ok(!patched.includes('updateAndRelease() failed'));
  assert.ok(patched.includes('cb(surface->getCanvas());\n      // Swap buffers and show on screen\n      _surfaceHolder->present();'));
  const destruction='void RNSkOpenGLCanvasProvider::surfaceDestroyed()';
  assert.equal(patched.slice(patched.indexOf(destruction)),source.slice(source.indexOf(destruction)));
  assert.ok(patched.includes('env->NewGlobalRef(jSurfaceTexture)'));
  assert.ok(patched.includes('env->DeleteGlobalRef(_jSurfaceTexture)'));
});
test('changed provider source and attempted extra lifecycle edits fail the pinned native guard',()=>{
  assert.throws(()=>plugin.patchTextureConsumer(source+'\n// another SDK'),/pinned Skia/);
  const patched=plugin.patchTextureConsumer(source);
  assert.throws(()=>plugin.patchTextureConsumer(patched.replace('ANativeWindow_fromSurface(env, jSurface)','nullptr')),/pinned Skia/);
  assert.throws(()=>plugin.patchTextureConsumer(patched.replace('cb(surface->getCanvas());','')),/pinned Skia/);
});
