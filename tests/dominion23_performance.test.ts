import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stableBorderZoom} from '../src/map/borderStyle';

test('small pinch reversals reuse prepared strokes, while large zoom changes refine them',()=>{
  let prepared=3.5;
  for(const zoom of [3.50000001,3.49999999,3.45,3.55,3.48,3.52])prepared=stableBorderZoom(zoom,prepared);
  assert.equal(prepared,3.5);assert.equal(stableBorderZoom(6,prepared),6);assert.equal(stableBorderZoom(2,prepared),2);
});
