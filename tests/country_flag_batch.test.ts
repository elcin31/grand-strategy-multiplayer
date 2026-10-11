import {test} from 'node:test';
import assert from 'node:assert/strict';
import {processTransform3d} from '../node_modules/@shopify/react-native-skia/lib/commonjs/skia/types/Matrix4';
import {countryFlagBatch,hitCountryGlyph,type CountryGlyph,FLAG_ATLAS_CELL_WIDTH,FLAG_ATLAS_CELL_HEIGHT} from '../src/map/countryTargets';
import {worldToScreen,TILT} from '../src/map/camera';

const close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
test('batched flag pixels and border keep the legacy Skia paint transform and country touch target during pan/pinch',()=>{
  for(const zoom of [.35,.6,1,3.5,7.9])for(const scale of [.55,.9,1.7]){
    const glyph:CountryGlyph={label:{countryId:'germany',anchor:{x:790.125,y:176.875},width:90,blocked:false},name:'Germany',width:56,scale};
    const sprite=countryFlagBatch([glyph],zoom,TILT)[0]!;
    const legacy=processTransform3d([{translateX:glyph.label.anchor.x},{translateY:glyph.label.anchor.y},{scaleX:1/zoom},{scaleY:1/(zoom*TILT)},{scaleX:scale},{scaleY:scale},{translateX:-glyph.width/2-25},{translateY:-8}]);
    for(const pixel of [{x:0,y:0},{x:60,y:42},{x:30,y:21}]){
      const old={x:legacy[0]!*(pixel.x/3)+legacy[1]!*(pixel.y/3)+legacy[3]!,y:legacy[4]!*(pixel.x/3)+legacy[5]!*(pixel.y/3)+legacy[7]!};
      const actual={x:(sprite.tx+sprite.scale*pixel.x)/zoom,y:(sprite.ty+sprite.scale*pixel.y)/(zoom*TILT)};
      close(actual.x,old.x);close(actual.y,old.y);
      for(const currentZoom of [zoom*.8,zoom,zoom*1.3])for(const viewport of [{width:1280,height:664},{width:2340,height:1024}]){
        const camera={x:810,y:190,zoom:currentZoom},a=worldToScreen(actual,camera,viewport),b=worldToScreen(old,camera,viewport);close(a.x,b.x);close(a.y,b.y);
      }
      assert.ok(hitCountryGlyph(glyph,actual.x,actual.y,zoom,TILT));
    }
    close(sprite.frame.width/zoom,22*scale/zoom);close(sprite.frame.height/(zoom*TILT),16*scale/(zoom*TILT));
  }
});
test('flag atlas separates all visible countries with transparent gutters across rows and leaves their IDs/order intact',()=>{
  const glyphs:CountryGlyph[]=Array.from({length:55},(_,i)=>({label:{countryId:'country-'+i,anchor:{x:i*10,y:i*3},width:80,blocked:false},name:'Country',width:40,scale:1}));
  const sprites=countryFlagBatch(glyphs,1,TILT);
  assert.deepEqual(sprites.map(s=>s.id),glyphs.map(g=>g.label.countryId));
  const cells=new Set(sprites.map(s=>`${s.source.x},${s.source.y}`));assert.equal(cells.size,glyphs.length);
  for(const s of sprites){assert.equal(s.source.x%FLAG_ATLAS_CELL_WIDTH,2);assert.equal(s.source.y%FLAG_ATLAS_CELL_HEIGHT,2);assert.equal(s.source.width,60);assert.equal(s.source.height,42);}
  assert.deepEqual(countryFlagBatch([],1,TILT),[]);
});
