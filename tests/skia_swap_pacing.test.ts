import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const plugin=require('../plugins/withSkiaSwapPacing.cjs');
const source=readFileSync(plugin.nativePath,'utf8');

test('pinned Android window patch applies idempotently and only to newly current surfaces',()=>{
  const patched=plugin.patchSwapPacing(source);
  assert.equal(plugin.patchSwapPacing(patched),patched);
  const request=patched.indexOf('eglSwapInterval(eglGetCurrentDisplay(), 0)');
  assert.ok(request>patched.indexOf('if (_skSurface == nullptr)'));
  assert.ok(request>patched.indexOf('_glContext->makeCurrent(_glSurface.get())'));
  assert.ok(request<patched.indexOf('GLint stencil;'));
  assert.ok(request<patched.indexOf('void OpenGLWindowContext::present()'));
  assert.equal(patched.split('eglSwapInterval(').length,2);
  assert.equal(patched.slice(patched.indexOf('void OpenGLWindowContext::present()')),source.slice(source.indexOf('void OpenGLWindowContext::present()')));
});
test('changed pinned native rendering or tampered pacing cannot bypass the source guard',()=>{
  assert.throws(()=>plugin.patchSwapPacing(source+'\n// different SDK'),/pinned Skia/);
  const patched=plugin.patchSwapPacing(source);
  assert.throws(()=>plugin.patchSwapPacing(patched.replace('eglGetCurrentDisplay(), 0','eglGetCurrentDisplay(), 1')),/pinned Skia/);
  assert.throws(()=>plugin.patchSwapPacing(patched.replace('_directContext->flushAndSubmit();','_directContext->flushAndSubmit();\n  glFinish();')),/pinned Skia/);
});
