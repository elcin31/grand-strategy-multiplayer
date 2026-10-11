import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RasterCache,retainRasterImage} from '../src/map/rasterTiles';

test('retained pixels release only their redundant vector cache reference, never the still displayed picture',()=>{
  let disposed=0;
  const displayedPicture={dispose:()=>{disposed++;}},otherPicture={id:'other'};
  const pictures=new RasterCache<object>(1000,96),images=new RasterCache<object>(32*1024*1024,96);
  pictures.set('visible',displayedPicture,1);pictures.set('other',otherPicture,1);
  const image={id:'visible-rgba'};
  assert.equal(retainRasterImage(images,pictures,'visible',image,1024),true);
  assert.equal(images.get('visible'),image);assert.equal(images.bytes,1024);
  assert.equal(pictures.peek('visible'),undefined);assert.equal(pictures.bytes,1);
  assert.equal(pictures.get('other'),otherPicture);assert.equal(disposed,0);
  assert.equal(typeof displayedPicture.dispose,'function','A display node retains its own native picture reference');
});

test('rejected raster retention preserves the fallback and does not evict foreground pixels during prewarm',()=>{
  const pictures=new RasterCache<object>(1000,96),images=new RasterCache<object>(20,2);
  const active={id:'active'},fallback={id:'fallback'};
  images.set('active',active,15);pictures.set('pending',fallback,1);
  for(const bytes of [10,21,NaN,Infinity,-1,.5,0]){
    assert.equal(retainRasterImage(images,pictures,'pending',{bytes},bytes,true),false);
    assert.equal(pictures.get('pending'),fallback);assert.equal(images.get('active'),active);
    assert.equal(images.bytes,15);assert.equal(pictures.bytes,1);
  }
  for(const bytes of [21,NaN,Infinity,-1,.5,0])assert.equal(retainRasterImage(images,pictures,'pending',{},bytes),false);
  assert.equal(pictures.get('pending'),fallback);assert.equal(images.get('active'),active);
  const disabled=new RasterCache<object>(20,0);
  assert.equal(retainRasterImage(disabled,pictures,'pending',{},10),false);
  assert.equal(pictures.peek('pending'),fallback);
});

test('ready warm and cold tiles keep the accepted pixel LRU and limits without a second retained vector cache',()=>{
  const images=new RasterCache<string>(30,3),pictures=new RasterCache<string>(1000,96);
  for(const key of ['active-a','active-b','idle']){
    pictures.set(key,'vector-'+key,1);
    assert.equal(retainRasterImage(images,pictures,key,'rgba-'+key,10,key==='idle'),true);
  }
  assert.equal(images.size,3);assert.equal(images.bytes,30);assert.equal(pictures.size,0);
  assert.equal(images.get('active-a'),'rgba-active-a');
  pictures.set('next','vector-next',1);
  assert.equal(retainRasterImage(images,pictures,'next','rgba-next',10),true);
  assert.equal(images.peek('idle'),undefined,'An unused prewarmed tile remains first for normal eviction');
  assert.equal(images.get('active-a'),'rgba-active-a');assert.equal(images.get('active-b'),'rgba-active-b');
  assert.equal(images.size,3);assert.equal(images.bytes,30);assert.equal(pictures.size,0);
});
