import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const plugin=require('../plugins/withSkiaUiDispatch.cjs');
const source=readFileSync(plugin.nativePath,'utf8');

test('deferred UI dispatch preserves all stream, error and native API code outside the dispatch method',()=>{
  const original=plugin.restoreUiDispatch(source),patched=plugin.patchUiDispatch(original);
  assert.equal(plugin.patchUiDispatch(patched),patched);
  assert.equal(plugin.restoreUiDispatch(patched),original);
  const methodStart=patched.indexOf('    public void notifyTaskReady()');
  assert.equal(patched.slice(patched.indexOf('    // Private c++ native methods')),original.slice(original.indexOf('    // Private c++ native methods')));
  assert.equal(patched.slice(patched.indexOf('    @DoNotStrip\n    public Object createVideo'),methodStart),original.slice(original.indexOf('    @DoNotStrip\n    public Object createVideo'),original.indexOf('    public void notifyTaskReady()')));
  const method=patched.slice(methodStart,patched.indexOf('    // Private c++ native methods'));
  assert.ok(!method.includes('Looper.myLooper()'));
  assert.ok(method.indexOf('mainHandler.post(() -> {')<method.indexOf('notifyTaskReadyNative();'));
  assert.ok(method.indexOf('notifyTaskReadyNative();')<method.indexOf('DOMINION_UI_DISPATCH posted-main-loop'));
});
test('SDK drift, partial patch and changed thread target are rejected before native writes',()=>{
  const original=plugin.restoreUiDispatch(source),patched=plugin.patchUiDispatch(original);
  assert.throws(()=>plugin.patchUiDispatch(original+'\n// changed SDK'),/pinned Skia/);
  assert.throws(()=>plugin.patchUiDispatch(patched.replace('Looper.getMainLooper()','Looper.myLooper()')),/Changed pinned UI dispatch layout/);
  assert.throws(()=>plugin.restoreUiDispatch(patched.replace('notifyTaskReadyNative();','notifyTaskReadyNative();\n            notifyTaskReadyNative();')),/dispatch/);
});
