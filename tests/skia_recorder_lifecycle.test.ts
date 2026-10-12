import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require=createRequire(import.meta.url);
const {patchNativeContainer}=require('../plugins/withSkiaRecorderLifecycle.cjs') as {patchNativeContainer:(source:string)=>string};
const source=readFileSync('node_modules/@shopify/react-native-skia/src/sksg/Container.native.ts','utf8');
const patched=patchNativeContainer(source);
type Node={resources:string[];animated:boolean};
type Picture={resources:string[]};
type Recorder={id:number;commands:string[];resets:number;plays:number;reset:()=>void;play:(picture:Picture)=>void;applyUpdates:()=>void};
type Container={root:Node[];mount:()=>void;unmount:()=>void;redraw:()=>void};

// Execute the actual patched upstream module. Model the pinned Worklets FIFO
// UI queue, not memory/PSS or native graphics; full APK QA remains required.
function harness(animatedRuntime=true){
  const queue:(()=>void)[]=[],recorders:Recorder[]=[],events:string[]=[];
  const mappers=new Map<number,{run:()=>void;inputs:{recorderId:number}[]}>();
  let ui=false,nextMapper=0,presented:Picture|null=null;
  const onUi=(run:()=>void)=>{assert.equal(ui,false);ui=true;try{run();}finally{ui=false;}};
  const rea={
    runOnUI:(run:()=>void)=>()=>queue.push(run),
    startMapper:(run:()=>void,inputs:{recorderId:number}[])=>{const id=++nextMapper;queue.push(()=>{events.push('start:'+id);mappers.set(id,{run,inputs});});return id;},
    stopMapper:(id:number)=>queue.push(()=>{events.push('stop:'+id);mappers.delete(id);}),
  };
  class BaseContainer{
    root:Node[]=[];unmounted=false;
    constructor(public Skia:unknown){}
    mount(){this.unmounted=false;}
    unmount(){this.unmounted=true;}
  }
  class StaticContainer extends BaseContainer{redraw(){events.push('static');}}
  class ReanimatedRecorder{
    recorder:Recorder;values:{recorderId:number}[]=[];
    constructor(){
      const id=recorders.length;
      this.recorder={id,commands:[],resets:0,plays:0,
        reset(){assert.equal(ui,true,'native reset must run on UI');assert.ok(![...mappers.values()].some(m=>m.inputs.some(v=>v.recorderId===id)),'retired mapper must stop before reset');events.push('reset:'+id);this.commands=[];this.resets++;},
        play(picture){assert.equal(ui,true);assert.equal(this.resets,0,'a retired recorder must never play again');events.push('play:'+id);picture.resources=[...this.commands];this.plays++;},
        applyUpdates(){assert.equal(ui,true);assert.equal(this.resets,0);events.push('update:'+id);},
      };
      recorders.push(this.recorder);
    }
    getSharedValues(){return this.values;}
    getRecorder(){return this.recorder;}
  }
  const api={setJsiProperty:(_id:number,name:string,picture:Picture)=>{assert.equal(ui,true);assert.equal(name,'picture');presented=picture;}};
  const skia={Picture:{MakePicture:()=>({resources:[]})}};
  const imports:Record<string,unknown>={
    '../external/reanimated/ReanimatedProxy':{default:rea},
    '../external/reanimated/renderHelpers':{HAS_REANIMATED_3:animatedRuntime},
    './Recorder/ReanimatedRecorder':{ReanimatedRecorder},
    './StaticContainer':{Container:BaseContainer,StaticContainer},
    './Recorder/Visitor':{visit:(rec:ReanimatedRecorder,nodes:Node[])=>{rec.recorder.commands=nodes.flatMap(n=>n.resources);rec.values=nodes.some(n=>n.animated)?[{recorderId:rec.recorder.id}]:[];}},
    '../skia/NativeSetup':{},'../views/api':{},
  };
  const exports:{createContainer?:(skia:unknown,id:number)=>Container}={};
  const context=vm.createContext({exports,SkiaViewApi:api,require:(name:string)=>{assert.ok(name in imports,'unexpected upstream dependency: '+name);return imports[name];}});
  vm.runInContext(ts.transpileModule(patched,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,context);
  const create=(id=1)=>exports.createContainer!(skia,id);
  const flush=()=>{while(queue.length)onUi(queue.shift()!);};
  const tick=()=>onUi(()=>{for(const mapper of mappers.values())mapper.run();});
  return {create,flush,tick,recorders,events,mappers,presented:()=>presented};
}

test('pinned recorder patch is idempotent and rejects changed original or patched upstream source',()=>{
  assert.equal(patchNativeContainer(patched),patched);
  assert.throws(()=>patchNativeContainer(source+'\n'));
  assert.throws(()=>patchNativeContainer(patched.replace('previousRecorder.reset();','previousRecorder.play(picture);')));
});

test('active shared-value frames retain their live commands and published picture',()=>{
  const h=harness(),container=h.create();
  container.root=[{resources:['terrain','flags'],animated:true}];container.redraw();h.flush();
  h.tick();h.tick();
  assert.equal(h.recorders[0]!.plays,3);assert.equal(h.recorders[0]!.resets,0);
  assert.deepEqual(h.presented()?.resources,['terrain','flags']);assert.equal(h.mappers.size,1);
});

test('replaced animated scene stops the old mapper before resetting its native commands on UI',()=>{
  const h=harness(),container=h.create();
  container.root=[{resources:['old-terrain'],animated:true}];container.redraw();h.flush();h.tick();
  container.root=[{resources:['new-terrain'],animated:true}];container.redraw();
  assert.deepEqual(h.recorders[0]!.commands,['old-terrain'],'JS redraw must not reset native commands from the wrong runtime');
  h.flush();h.tick();
  assert.equal(h.recorders[0]!.resets,1);assert.deepEqual(h.recorders[0]!.commands,[]);
  assert.equal(h.recorders[1]!.resets,0);assert.deepEqual(h.presented()?.resources,['new-terrain']);
  assert.ok(h.events.indexOf('stop:1')<h.events.indexOf('reset:0'));
  assert.ok(h.events.indexOf('play:1')<h.events.indexOf('reset:0'),'publish new picture before retiring old references');
});

test('rapid queued scene replacements retain only the current native command set',()=>{
  const h=harness(),container=h.create();
  for(let i=0;i<100;i++){
    container.root=[{resources:['scene:'+i],animated:i%3!==0}];container.redraw();
  }
  h.flush();h.tick();
  assert.equal(h.recorders.length,100);
  assert.ok(h.recorders.slice(0,-1).every(r=>r.resets===1&&r.commands.length===0));
  assert.equal(h.recorders[99]!.resets,0);assert.deepEqual(h.presented()?.resources,['scene:99']);
  assert.equal(h.mappers.size,0,'final static scene must not retain the preceding animated mapper');
});

test('unmount retires pending or active commands exactly once and remount creates a working scene',()=>{
  for(const flushBeforeUnmount of [false,true]){
    const h=harness(),container=h.create();
    container.root=[{resources:['cached-image'],animated:true}];container.redraw();
    if(flushBeforeUnmount)h.flush();
    container.unmount();container.unmount();container.redraw();h.flush();h.tick();
    assert.equal(h.mappers.size,0);assert.equal(h.recorders[0]!.resets,1);
    assert.deepEqual(h.recorders[0]!.commands,[]);
    assert.deepEqual(h.presented()?.resources,['cached-image'],'published picture owns its references independently');
    container.mount();container.root=[{resources:['remounted'],animated:true}];container.redraw();h.flush();h.tick();
    assert.equal(h.recorders[1]!.resets,0);assert.deepEqual(h.presented()?.resources,['remounted']);
  }
});

test('offscreen and non-Reanimated static containers preserve their existing path',()=>{
  for(const [animatedRuntime,id] of [[true,-1],[false,1]] as const){
    const h=harness(animatedRuntime);h.create(id).redraw();h.flush();
    assert.deepEqual(h.events,['static']);assert.equal(h.recorders.length,0);
  }
});
