import {countryGlyph,hitCountryGlyph,type CountryGlyph} from '../map/countryTargets';
import {CameraWorkGate,nextFrameDeadline,frameBucket,frameQuantile,createFrameAccumulator,recordFrameInterval,finishFrameSample} from '../performance/framePacing';
import {createCameraInput,queueCameraInput,takeCameraInput} from '../performance/cameraInput';
import {MapRasterLayer} from './MapRasterLayer';
import {MapMarkerLayer} from './MapMarkerLayer';
import {cameraCoverage,cameraNeedsCoverage,viewportLayoutUpdate,interactionDetailZoom} from '../map/cameraCoverage';
import {budgetArmyMarkers,markerBudgets} from '../map/markerBudget';
import {countryRenderFeatures,renderFeaturesFor} from '../map/countryRender';
import {loadPreferences,savePreferences} from '../performance/preferences';
import {clusterArmies} from '../map/armyClusters';
import {PerformanceControls,PerformanceOverlay} from './PerformancePanel';
import {recordMetrics,getMetrics,resetMetricSamples,cameraMetrics} from '../performance/telemetry';
import {adaptQuality,initialQuality,targetFrameRate,type FrameRate,type QualityState} from '../performance/quality';
import {geometryForLod,selectGeometryLod,type GeometryLod} from '../map/geometryLod';
import {preparedCountryLabels} from '../map/labelIndex';
import {mapLegend} from '../map/modes';
import {armyCounters,occupationFeatures,warBorderPath} from '../map/overlays';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View, PixelRatio, Platform } from 'react-native';
import {createShareable,UIRuntimeId} from 'react-native-worklets';
import { Canvas, Circle, Fill, Group, LinearGradient, Path, Rect, Skia, matchFont, vec } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { cancelAnimation, runOnJS, runOnUI, useAnimatedReaction, useFrameCallback, useDerivedValue, useSharedValue, withDecay, withTiming } from 'react-native-reanimated';
import { type CountryId, type GameState, type Province } from '../types/game';
import { boundedCamera, Camera, clamp, TILT, visibleBounds, zoomAt } from '../map/camera';
import { featurePath } from '../map/geometry';
import { mapSceneFor, type MapScene } from '../map/worldScene';
import { buildProvinceColors, cityLabelPlacements, troopsByProvince, visibleCities } from '../map/scene';
import { AVAILABLE_MODES, GRAPHICS, GraphicsPreset, MapMode, MODE_LABELS } from '../map/settings';

interface WorldMapProps {
  onSelectCountry?:(countryId:string)=>void;
  onClearSelection?:()=>void;
  onCameraActivity?:(active:boolean)=>void;
  settingsOpen?:boolean;
  onSettingsChange?:(value:boolean)=>void;
  selectedArmyId?:string|null;
  selectedCityId?:string|null;
  onSelectArmy?:(armyId:string,provinceId:string)=>void;
  onSelectCity?:(cityId:string,provinceId:string)=>void;
  state: GameState;
  selectedCountryId: CountryId | null;
  selectedProvinceId: string | null;
  onSelectProvince: (province: Province) => void;
  focusCountryId?: string | null;
  onLongPressProvince?: (province: Province) => void;
}
type NativePath=ReturnType<typeof Skia.Path.Make>;
class LazyPaths extends Map<string,NativePath>{
  constructor(private featuresById:Map<string,import('../map/geometry').MapFeature>,private lod:GeometryLod){super();}
  override get(id:string):NativePath|undefined{let value=super.get(id);if(!value){const feature=this.featuresById.get(id);if(!feature)return undefined;value=Skia.Path.MakeFromSVGString(featurePath(geometryForLod(feature,this.lod)))??undefined;if(value)this.set(id,value);}return value;}
}
const nativeScenes = new WeakMap<MapScene,Map<GeometryLod,{paths:LazyPaths;contextPath:NativePath}>>();
function nativeScene(scene:MapScene,lod:GeometryLod){
  let variants=nativeScenes.get(scene);if(!variants){variants=new Map();nativeScenes.set(scene,variants);}const cached=variants.get(lod);if(cached)return cached;
  const paths=new LazyPaths(new Map([...scene.features,...countryRenderFeatures(scene)].map(f=>[f.id,f])),lod),contextPath=Skia.Path.Make();
  for(const f of scene.features)if(!f.provinceId)contextPath.addPath(paths.get(f.id)!);
  const result={paths,contextPath};variants.set(lod,result);return result;
}
function useStableColors(next:Map<string,string>):Map<string,string>{
  const ref=useRef(next),old=ref.current;
  if(old.size!==next.size)ref.current=next;else for(const [id,color]of next)if(old.get(id)!==color){ref.current=next;break;}
  return ref.current;
}
const measurements=new WeakMap<object,Map<string,number>>();
function measure(font:ReturnType<typeof matchFont>,name:string):number{
 let cache=measurements.get(font);if(!cache){cache=new Map();measurements.set(font,cache);}
 let width=cache.get(name);if(width===undefined){width=font.measureText(name).width;if(cache.size>=1024)cache.delete(cache.keys().next().value!);cache.set(name,width);}return width;
}
const sceneCosts=new WeakMap<MapScene,number>();
const defaults: Camera = { x: 800, y: 160, zoom: 3.5 };

export const WorldMap=memo(function WorldMap({ selectedArmyId,selectedCityId,onSelectArmy,onSelectCity,onSelectCountry,onClearSelection,onCameraActivity,settingsOpen=false,onSettingsChange, state, selectedCountryId, selectedProvinceId, onSelectProvince, onLongPressProvince, focusCountryId }: WorldMapProps) {
  const scene = useMemo(() => {const start=performance.now();const scene=mapSceneFor(state);if(!sceneCosts.has(scene))sceneCosts.set(scene,Math.max(getMetrics().sceneMs,performance.now()-start));recordMetrics({sceneMs:sceneCosts.get(scene)!});return scene;}, [state.dataset]);
  const { features, spatialIndex, provinceGeometry, cities: mapCities } = scene;
  const [viewport, setViewport] = useState({ width: 1, height: 1 });
  const [snapshot, setSnapshot] = useState<Camera>(defaults);
  const [detailZoom,setDetailZoom]=useState(defaults.zoom);
  const [preset, setPreset] = useState<GraphicsPreset>('Balanced');
  const [ceiling,setCeiling]=useState<GraphicsPreset>('Balanced');
  const [frameRate,setFrameRate]=useState<FrameRate>('Auto');
  const [overlay,setOverlay]=useState(false),[adaptive,setAdaptive]=useState(true),[benchmarkRunning,setBenchmarkRunning]=useState(false);
  const quality=useRef<QualityState>({tier:'Balanced',bad:0,good:0,changedAt:Date.now()});
  const calibrated=useRef(false),benchmarkToken=useRef(0);
  const [preferencesReady,setPreferencesReady]=useState(false);
  useEffect(()=>{let alive=true;void loadPreferences().then(saved=>{if(!alive)return;if(saved){calibrated.current=true;setCeiling(saved.preset);setPreset(saved.preset);setFrameRate(saved.frameRate);setAdaptive(saved.adaptive);quality.current={tier:saved.preset,bad:0,good:0,changedAt:Date.now()};}setPreferencesReady(true);});return()=>{alive=false;};},[]);
  useEffect(()=>{if(preferencesReady&&calibrated.current)savePreferences({preset:ceiling,frameRate,adaptive});},[preferencesReady,ceiling,frameRate,adaptive]);
  const choosePreset=(next:GraphicsPreset)=>{setCeiling(next);setPreset(next);quality.current={tier:next,bad:0,good:0,changedAt:Date.now()};};
  useEffect(()=>{if(!preferencesReady||calibrated.current||viewport.width<=1)return;calibrated.current=true;choosePreset(initialQuality(getMetrics().sceneMs,viewport.width*viewport.height*PixelRatio.get()**2));},[viewport,preferencesReady]);
  useEffect(()=>()=>{benchmarkToken.current++;},[]);
  const [mode, setMode] = useState<MapMode>('Political');
  const geometryLod=selectGeometryLod(detailZoom,preset);
  const {paths}=useMemo(()=>nativeScene(scene,geometryLod),[scene,geometryLod]);
  const setSettingsOpen=(value:boolean)=>onSettingsChange?.(value);
  const x = useSharedValue(defaults.x), y = useSharedValue(defaults.y), zoom = useSharedValue(defaults.zoom);
  const renderX=useSharedValue(defaults.x),renderY=useSharedValue(defaults.y),renderZoom=useSharedValue(defaults.zoom);
  const frameBudget=targetFrameRate(frameRate,preset);
  // Worklets 0.10 Shareable holds a mutable host object on the UI runtime.
  // Unlike reactive Shared Values, private counters have no dirty flags,
  // animation cancellation, listeners or guest serialization on each increment.
  // Web runs the callback on its single JS runtime and needs no native host.
  const frameSampler=useMemo(()=>Platform.OS==='web'?{value:createFrameAccumulator()}:createShareable(UIRuntimeId,createFrameAccumulator()),[]);
  const gestureInput=useMemo(()=>Platform.OS==='web'?{value:createCameraInput(defaults)}:createShareable(UIRuntimeId,createCameraInput(defaults)),[]);
  const flushGestureCamera=useCallback(()=>{
    'worklet';
    const pending=takeCameraInput(gestureInput.value!);
    if(pending){x.value=pending.x;y.value=pending.y;if(pending.updateZoom)zoom.value=pending.zoom;}
  },[gestureInput,x,y,zoom]);
  const acceptFrameSample=useCallback((fps:number,ms:number,slow:number,updates:number,histogram: number[]|undefined,events:number,commits:number)=>{
    const distribution=histogram?{frameP50Ms:frameQuantile(histogram,.5),frameP95Ms:frameQuantile(histogram,.95),frameP99Ms:frameQuantile(histogram,.99),frameSamples:histogram.reduce((n,x)=>n+x,0),over50Ms:histogram.slice(frameBucket(50)+1).reduce((n,x)=>n+x,0),over100Ms:histogram.slice(frameBucket(100)+1).reduce((n,x)=>n+x,0)}:{};
    recordMetrics({uiFps:fps,frameMs:ms,slowFrames:slow,cameraUpdates:updates,gestureEvents:events,gestureCommits:commits,...distribution},true);
    if(overlay)console.info('DOMINION_CAMERA '+JSON.stringify(cameraMetrics(getMetrics())));
    if(adaptive){quality.current=adaptQuality(quality.current,ceiling,fps,frameBudget,Date.now(),updates>3);if(quality.current.tier!==preset)setPreset(quality.current.tier);}
  },[adaptive,ceiling,frameBudget,preset,overlay]);
  const pulse=useSharedValue(.9);
  const sampleDistribution=overlay||benchmarkRunning;
  useEffect(()=>{runOnUI(()=>{frameSampler.value!.histogram.fill(0);})();},[sampleDistribution,frameSampler]);
  const moving=useSharedValue(false);
  const activityRef=useRef(onCameraActivity);activityRef.current=onCameraActivity;
  const rasterWork=useRef(new CameraWorkGate());
  const cameraActivity=useCallback((active:boolean)=>{rasterWork.current.activity(active);activityRef.current?.(active);},[]);
  const canPrewarm=useCallback(()=>AppState.currentState==='active'&&!rasterWork.current.defer(performance.now(),750),[]);
  const animateEffects=(preset==='High'||preset==='Ultra')&&state.battleLog.some(b=>state.tick-b.tick<=1);
  useEffect(()=>{if(!animateEffects)pulse.value=.9;},[animateEffects,pulse]);
  useFrameCallback(frame=>{
    const dt=frame.timeSincePreviousFrame;if(dt===null||dt<=0)return;
    const sample=frameSampler.value!;
    recordFrameInterval(sample,dt,frameBudget,sampleDistribution);
    if(frame.timestamp>=sample.deadline-.5){
      sample.deadline=nextFrameDeadline(frame.timestamp,sample.deadline,frameBudget);
      flushGestureCamera();
      if(animateEffects)pulse.value=.8+.2*Math.sin(frame.timestamp/900);
      if(renderX.value!==x.value||renderY.value!==y.value||renderZoom.value!==zoom.value){
        renderX.value=x.value;renderY.value=y.value;renderZoom.value=zoom.value;sample.updates++;sample.lastMotion=frame.timestamp;
        if(!moving.value){moving.value=true;runOnJS(cameraActivity)(true);}
      }
    }
    // One begin/end pair per motion, including inertia and toolbar animations;
    // no per-frame JS callbacks or React camera state updates.
    if(moving.value&&frame.timestamp-sample.lastMotion>=150){moving.value=false;runOnJS(cameraActivity)(false);}
    if(sample.sampleClock===0)sample.sampleClock=frame.timestamp;
    const elapsed=frame.timestamp-sample.sampleClock;
    if(elapsed>=1000){
      const result=finishFrameSample(sample,frame.timestamp,sampleDistribution);
      const input=gestureInput.value!;
      runOnJS(acceptFrameSample)(result.fps,result.ms,result.slow,result.updates,result.histogram,input.events,input.commits);
    }
  });
  const startX = useSharedValue(0), startY = useSharedValue(0), startZoom = useSharedValue(1);
  const pinchX = useSharedValue(0), pinchY = useSharedValue(0), pinching = useSharedValue(false), panning=useSharedValue(false);
  const publishSnapshot=useCallback((camera:Camera,settled=false)=>{setSnapshot(previous=>previous.x===camera.x&&previous.y===camera.y&&previous.zoom===camera.zoom?previous:camera);setDetailZoom(previous=>interactionDetailZoom(previous,camera.zoom,settled));recordMetrics({cullCommits:getMetrics().cullCommits+1});},[]);
  const lastCull = useSharedValue(0), cullX = useSharedValue(defaults.x), cullY = useSharedValue(defaults.y), cullZoom = useSharedValue(defaults.zoom);
  useEffect(()=>()=>{cancelAnimation(x);cancelAnimation(y);cancelAnimation(zoom);if(moving.value){moving.value=false;cameraActivity(false);}},[x,y,zoom,moving,cameraActivity]);
  useAnimatedReaction(() => ({ x: renderX.value, y: renderY.value, zoom: renderZoom.value }), camera => {
    const now = Date.now();
    const needsCoverage=cameraNeedsCoverage(camera,{x:cullX.value,y:cullY.value,zoom:cullZoom.value},viewport);
    if (needsCoverage && now - lastCull.value > 160) {
      lastCull.value = now; cullX.value = camera.x; cullY.value = camera.y; cullZoom.value = camera.zoom;
      runOnJS(publishSnapshot)(camera);
    }
  });
  const transform = useDerivedValue(() => [{ translateX: viewport.width / 2 }, { translateY: viewport.height / 2 }, { scaleX: renderZoom.value }, { scaleY: renderZoom.value * TILT }, { translateX: -renderX.value }, { translateY: -renderY.value }]);
  const inverseScale = useDerivedValue(() => [{ scaleX: 1 / renderZoom.value }, { scaleY: 1 / (renderZoom.value * TILT) }]);
  const borderScale = useDerivedValue(() => GRAPHICS[preset].borderWidth / renderZoom.value);
  const selectionScale = useDerivedValue(() => borderScale.value * 2.7);
  const bounds = useMemo(() => cameraCoverage(snapshot, viewport), [snapshot, viewport]);
  const queriedVisible=useMemo(()=>spatialIndex.query(bounds).filter(f=>f.provinceId),[spatialIndex,bounds]);
  const priorVisible=useRef(queriedVisible);if(priorVisible.current.length!==queriedVisible.length||queriedVisible.some((f,i)=>f!==priorVisible.current[i]))priorVisible.current=queriedVisible;
  const visible=priorVisible.current;
  const visibleIds = useMemo(() => new Set(visible.map(f => f.provinceId!)), [visible]);
  const owners = useStableColors(useMemo(()=>new Map(state.provinces.map(p=>[p.id,p.ownerId])),[state.provinces]));
  const provinceDetail = detailZoom >= (preset==='Performance'?5:preset==='Balanced'?3.8:2.8);
  const renderFeatures=useMemo(()=>renderFeaturesFor(scene,owners,!provinceDetail&&mode==='Political'),[scene,owners,provinceDetail,mode]);
  const controllers=useStableColors(useMemo(()=>new Map(state.provinces.map(p=>[p.id,p.controllerId??p.ownerId])),[state.provinces]));
  const warSides=(state.wars??[]).map(w=>w.id+':'+w.attackers.join(',')+'|'+w.defenders.join(',')).join(';');
  const warBorders=useMemo(()=>state.wars?.length?warBorderPath(state,visibleIds,scene.edges):'',[controllers,warSides,visibleIds,scene]);
  const occupations=useMemo(()=>occupationFeatures(state,visible),[owners,controllers,visible]);
  const budgets=markerBudgets(snapshot.zoom,preset);
  const counters=useMemo(()=>budgetArmyMarkers(clusterArmies(armyCounters(state,visibleIds),provinceGeometry,snapshot.zoom,selectedArmyId),snapshot.zoom,budgets.armies,selectedArmyId,selectedCountryId),[state.armies,visibleIds,provinceGeometry,snapshot.zoom,selectedArmyId,selectedCountryId,budgets.armies]);
  const legend=useMemo(()=>mapLegend(state,mode),[state.provinces,mode]);
  const troops = useMemo(() => troopsByProvince(state), [state.armies]);
  const provinceColors = useStableColors(useMemo(() => buildProvinceColors(state, mode, troops, selectedCountryId??undefined), [state.countries, state.provinces, state.diplomacy,state.wars,selectedCountryId, mode, troops]));
  const provinces = useMemo(() => new Map(state.provinces.map(p => [p.id, p])), [state.provinces]);
  const countryColors=useStableColors(useMemo(()=>new Map(Object.values(state.countries).map(c=>[c.id,c.color])),[state.countries]));
  const occupiedBatches=useMemo(()=>{const grouped=new Map<string,NativePath>();for(const f of occupations){const color=countryColors.get(controllers.get(f.provinceId!)!)??'#778B93';let path=grouped.get(color);if(!path){path=Skia.Path.Make();grouped.set(color,path);}path.addPath(paths.get(f.id)!);}return [...grouped];},[occupations,countryColors,controllers,paths]);
  const cityState = useMemo(()=>new Map((state.cities??[]).map(c=>[c.id,c])),[state.cities]);
  // Query immutable coordinates first. Do not recreate/reindex 7,214 points each tick.
  const visibleCityCatalogue = useMemo(()=>visibleCities(mapCities,bounds,snapshot.zoom,preset),[mapCities,bounds,snapshot.zoom,preset]);
  const cities=useMemo(()=>visibleCityCatalogue.map(c=>({...c,population:cityState.get(c.id)?.population??c.population})),[visibleCityCatalogue,cityState]);
  const font = useMemo(() => matchFont({ fontFamily: 'sans-serif', fontSize: 11, fontWeight: '600' }), []);
  const counterFont = useMemo(() => matchFont({ fontFamily: 'sans-serif', fontSize: 10, fontWeight: 'bold' }), []);
  const nationFont = useMemo(() => matchFont({ fontFamily: 'serif', fontSize: 13, fontWeight: 'bold' }), []);
  const armyLabelBlockers=useMemo(()=>counters.map(c=>({x:c.x,y:c.y,halfWidth:37/snapshot.zoom,halfHeight:14/(snapshot.zoom*TILT)})),[counters,snapshot.zoom]);
  const cityLabels = useMemo(() => cityLabelPlacements(cities, snapshot.zoom, TILT, name => measure(font,name), armyLabelBlockers, visibleBounds(snapshot, viewport, 0)), [cities, snapshot, viewport, font, armyLabelBlockers]);
  const countryGlyphsRef=useRef<CountryGlyph[]>([]);
  const selectAt = useCallback((px: number, py: number, cx: number, cy: number, z: number, long: boolean) => {
    const world = { x: (px - viewport.width / 2) / z + cx, y: (py - viewport.height / 2) / (z * TILT) + cy };
    const countryHit=!long?countryGlyphsRef.current.find(g=>hitCountryGlyph(g,world.x,world.y,snapshot.zoom,TILT)):undefined;
    if(countryHit&&onSelectCountry){onSelectCountry(countryHit.label.countryId);return;}
    const cityHit = visibleCities(mapCities, visibleBounds({ x: cx, y: cy, zoom: z }, viewport, 0), z, preset).find(c => Math.hypot((c.point.x - world.x) * z, (c.point.y - world.y) * z * TILT) < 12);
    const marker=counters.find(c=>Math.abs((c.x-world.x)*z)<35&&Math.abs((c.y-world.y)*z*TILT)<20);
    const army=marker?state.armies.find(a=>a.id===(marker.ids.includes(selectedArmyId??'')?selectedArmyId:marker.ids.find(id=>state.armies.some(a=>a.id===id&&a.ownerId===selectedCountryId))??marker.ids[0])):undefined;
    const nearby=army?{a:army,g:provinceGeometry.get(army.provinceId)}:undefined;
    const hit = nearby?.g ?? (cityHit ? provinceGeometry.get(cityHit.provinceId) : null) ?? spatialIndex.hit(world);
    const province = hit?.provinceId ? provinces.get(hit.provinceId) : null;
    if(!long&&nearby&&onSelectArmy){onSelectArmy(nearby.a.id,nearby.a.provinceId);return;}
    if(!long&&selectedArmyId&&province){onSelectProvince(province);return;}
    if(!long&&cityHit&&onSelectCity){onSelectCity(cityHit.id,cityHit.provinceId);return;}
    if (province) (long ? onLongPressProvince ?? onSelectProvince : onSelectProvince)(province);
    else if(!long)onClearSelection?.();
  }, [counters,selectedArmyId,selectedCountryId,viewport, provinces, state.armies, onSelectProvince, onLongPressProvince,onSelectArmy,onSelectCity,onSelectCountry,onClearSelection,snapshot.zoom, preset, scene, mapCities]);

  const selectionRef=useRef(selectAt);selectionRef.current=selectAt;
  const selectCurrent=useCallback((px:number,py:number,cx:number,cy:number,z:number,long:boolean)=>selectionRef.current(px,py,cx,cy,z,long),[]);
  const gestures = useMemo(() => {
    const pan = Gesture.Pan().minDistance(5).maxPointers(1).onStart(() => { flushGestureCamera();panning.value=true;runOnJS(cameraActivity)(true); cancelAnimation(x); cancelAnimation(y); startX.value = x.value; startY.value = y.value; })
      .onUpdate(e => { if (pinching.value) return; queueCameraInput(gestureInput.value!,clamp(startX.value - e.translationX / zoom.value, 0, 1440),clamp(startY.value - e.translationY / (zoom.value * TILT), 0, 720),zoom.value,false); })
      .onEnd(e => { if (pinching.value) return; flushGestureCamera();x.value = withDecay({ velocity: -e.velocityX / zoom.value, clamp: [0, 1440] }); y.value = withDecay({ velocity: -e.velocityY / (zoom.value * TILT), clamp: [0, 720] }); }).onFinalize(()=>{if(panning.value){if(!pinching.value)flushGestureCamera();runOnJS(cameraActivity)(false);}panning.value=false;});
    const pinch = Gesture.Pinch().onStart(e => {
      flushGestureCamera();runOnJS(cameraActivity)(true); cancelAnimation(x); cancelAnimation(y); cancelAnimation(zoom); pinching.value = true; startZoom.value = zoom.value;
      pinchX.value = (e.focalX - viewport.width / 2) / zoom.value + x.value;
      pinchY.value = (e.focalY - viewport.height / 2) / (zoom.value * TILT) + y.value;
    }).onUpdate(e => {
      const nextZoom=clamp(startZoom.value * e.scale, 0.5, 18);
      queueCameraInput(gestureInput.value!,clamp(pinchX.value - (e.focalX - viewport.width / 2) / nextZoom, 0, 1440),clamp(pinchY.value - (e.focalY - viewport.height / 2) / (nextZoom * TILT), 0, 720),nextZoom);
    }).onFinalize(() => { if(pinching.value){flushGestureCamera();runOnJS(cameraActivity)(false);runOnJS(publishSnapshot)({ x: x.value, y: y.value, zoom: zoom.value },true);}pinching.value = false; });
    const doubleTap = Gesture.Tap().numberOfTaps(2).maxDelay(260).onEnd((e, ok) => {
      if (!ok) return;
      const target = zoomAt({ x: x.value, y: y.value, zoom: zoom.value }, 1.7, { x: e.x, y: e.y }, viewport);
      x.value = withTiming(target.x, { duration: 240 }); y.value = withTiming(target.y, { duration: 240 }); zoom.value = withTiming(target.zoom, { duration: 240 }, done => { if (done) runOnJS(publishSnapshot)(target,true); });
    });
    const tap = Gesture.Tap().onEnd((e, ok) => { if (ok) runOnJS(selectCurrent)(e.x, e.y, x.value, y.value, zoom.value, false); });
    const long = Gesture.LongPress().minDuration(500).onStart(e => runOnJS(selectCurrent)(e.x, e.y, x.value, y.value, zoom.value, true));
    return Gesture.Race(Gesture.Simultaneous(pan, pinch), long, Gesture.Exclusive(doubleTap, tap));
  }, [viewport, selectCurrent,publishSnapshot,cameraActivity,flushGestureCamera,gestureInput, x, y, zoom, startX, startY, startZoom, pinching, panning, pinchX, pinchY]);

  const animateCamera = (camera: Camera) => {
    const c = boundedCamera(camera);
    x.value = withTiming(c.x, { duration: 260 }); y.value = withTiming(c.y, { duration: 260 }); zoom.value = withTiming(c.zoom, { duration: 260 }, done => { if (done) runOnJS(publishSnapshot)(c,true); });
  };
  const selectedPath = useMemo(() => { const path = Skia.Path.Make(); const silhouette=!selectedProvinceId?renderFeatures.find(f=>f.id==='render-country-'+selectedCountryId):undefined;if(silhouette){path.addPath(paths.get(silhouette.id)!);return path;} visible.filter(f => selectedProvinceId ? f.provinceId === selectedProvinceId : owners.get(f.provinceId!) === selectedCountryId).forEach(f => path.addPath(paths.get(f.id)!)); return path; }, [visible, selectedProvinceId, selectedCountryId, owners, paths,renderFeatures]);
  const labelZoom = Math.exp(Math.round(Math.log(snapshot.zoom) * 4) / 4);
  const preparedLabels = useMemo(() => preparedCountryLabels(features,owners),[features,owners]);
  const labels = useMemo(() => {
    const blockers=[...cityLabels.values()].map(label=>label.box).concat(armyLabelBlockers);
    return preparedLabels.filter(label=>label.anchor.x>=bounds.left&&label.anchor.x<=bounds.right&&label.anchor.y>=bounds.top&&label.anchor.y<=bounds.bottom).sort((a,b)=>Number(b.countryId===selectedCountryId)-Number(a.countryId===selectedCountryId)||b.width-a.width).slice(0,Math.min(budgets.labels,preset==='Performance'?6:10)).map(label=>{
      const name=state.countries[label.countryId]?.name??'';
      const halfWidth=Math.min(label.width,measure(nationFont,name)/labelZoom)/2;
      return {...label,blocked:blockers.some(b=>Math.abs(b.x-label.anchor.x)<halfWidth+(b.halfWidth??0)&&Math.abs(b.y-label.anchor.y)<11/(labelZoom*TILT)+(b.halfHeight??0))};
    });
  },[preparedLabels,bounds,cityLabels,armyLabelBlockers,nationFont,labelZoom,state.countries,preset,selectedCountryId,budgets.labels]);
  const countryGlyphs=useMemo(()=>labels.map(l=>state.countries[l.countryId]?countryGlyph(l,state.countries[l.countryId]!,snapshot.zoom,n=>measure(nationFont,n)):null).filter((g):g is CountryGlyph=>g!==null).slice(0,Math.max(0,budgets.labels-(selectedProvinceId?1:0))),[labels,state.countries,snapshot.zoom,nationFont,budgets.labels,selectedProvinceId]);
  countryGlyphsRef.current=countryGlyphs;
  useEffect(() => {
    if (!focusCountryId || viewport.width <= 1) return;
    const capitalId = state.countries[focusCountryId]?.capitalCityId;
    const capital = mapCities.find(c => c.id === capitalId);
    if (!capital) return;
    const target = { x: capital.point.x, y: capital.point.y, zoom: 5 };
    x.value = withTiming(target.x, { duration: 260 }); y.value = withTiming(target.y, { duration: 260 });
    zoom.value = withTiming(target.zoom, { duration: 260 }, done => { if (done) runOnJS(publishSnapshot)(target,true); });
  }, [focusCountryId, scene, viewport.width, x, y, zoom]);
  useEffect(()=>{recordMetrics({countryTargets:overlay?JSON.stringify(countryGlyphs.map(g=>({countryId:g.label.countryId,x:viewport.width/2+(g.label.anchor.x-snapshot.x)*snapshot.zoom-(g.width/2+15)*g.scale,y:viewport.height/2+(g.label.anchor.y-snapshot.y)*snapshot.zoom*TILT}))):'',armyTargets:overlay?JSON.stringify(counters.map(c=>({ids:c.ids,ownerIds:c.ownerIds,selected:c.ids.includes(selectedArmyId??''),x:viewport.width/2+(c.x-snapshot.x)*snapshot.zoom,y:viewport.height/2+(c.y-snapshot.y)*snapshot.zoom*TILT}))):'',renderFeatures:renderFeatures.length,visibleProvinces:visible.length,visibleArmies:counters.length,visibleLabels:Math.min(budgets.labels,cityLabels.size+labels.filter(l=>!l.blocked).length+(selectedProvinceId?1:0)),preset,geometryLod,mapRenders:getMetrics().mapRenders+1});});
  const startBenchmark=async()=>{if(benchmarkRunning)return;const token=++benchmarkToken.current,original={x:x.value,y:y.value,zoom:zoom.value},originalMode=mode;setBenchmarkRunning(true);setSettingsOpen(false);resetMetricSamples();recordMetrics({benchmarkError:'',benchmarkTicks:0});try{for(let i=0;i<AVAILABLE_MODES.length;i++){if(token!==benchmarkToken.current)return;setMode(AVAILABLE_MODES[i]!);const target=i%3===0?{x:720,y:300,zoom:.8}:i%3===1?{x:790,y:170,zoom:7}:{x:1000,y:210,zoom:3};x.value=withTiming(target.x,{duration:1800});y.value=withTiming(target.y,{duration:1800});zoom.value=withTiming(target.zoom,{duration:1800});await new Promise(r=>setTimeout(r,2200));}const {prepareBenchmarkState,advanceBenchmark}=await import('../performance/benchmark');let simulation=prepareBenchmarkState(state);for(let i=0;i<12;i++){if(token!==benchmarkToken.current)return;const started=performance.now();simulation=advanceBenchmark(simulation);recordMetrics({simulationMs:performance.now()-started,benchmarkTicks:i+1});await new Promise(r=>setTimeout(r,20));}}catch(error){recordMetrics({benchmarkError:error instanceof Error?error.message:String(error)});}finally{if(token===benchmarkToken.current){animateCamera(original);setMode(originalMode);setBenchmarkRunning(false);}}};

  return <View style={styles.frame} onLayout={e => setViewport(viewportLayoutUpdate(e))}>
    <GestureDetector gesture={gestures}>
      <Canvas accessible accessibilityLabel="Карта Dominion" style={StyleSheet.absoluteFill}>
        <Fill color="#203B48" />
        {GRAPHICS[preset].water && <Rect x={0} y={0} width={viewport.width} height={viewport.height}><LinearGradient start={vec(0, 0)} end={vec(viewport.width, viewport.height)} colors={['#18303C', '#294A57', '#193542']} /></Rect>}
        <Group transform={transform}>
          <MapRasterLayer scene={scene} features={renderFeatures} owners={owners} colors={provinceColors} lod={geometryLod} preset={preset} mode={mode} detail={provinceDetail} bounds={bounds} zoom={detailZoom} canPrewarm={canPrewarm}/>
          {occupiedBatches.map(([color,path])=><Group key={color}><Path path={path} color={color} opacity={.28}/><Path path={path} color={color} opacity={.55} style="stroke" strokeWidth={selectionScale}/></Group>)}
          {warBorders!==''&&<Path path={warBorders} style="stroke" color="#ed7f72" strokeWidth={selectionScale} opacity={pulse}/>}
          {state.armies.filter(a=>a.id===selectedArmyId&&a.order).map(a=>{const points=[a.provinceId,...a.order!.route].map(id=>provinceGeometry.get(id)?.anchor).filter(Boolean);return <Path key={a.id+"-order"} path={points.map((p,i)=>`${i?"L":"M"}${p!.x},${p!.y}`).join("")} style="stroke" strokeWidth={selectionScale} color="#fff0ac"/>;})}
          {(state.movements??[]).filter(m=>state.tick-m.tick<=2&&(visibleIds.has(m.from)||visibleIds.has(m.to))).map((m,i)=>{const from=provinceGeometry.get(m.from)?.anchor,to=provinceGeometry.get(m.to)?.anchor;if(!from||!to)return null;return <Path key={'movement-'+i} path={`M${from.x},${from.y}L${to.x},${to.y}`} style="stroke" strokeWidth={selectionScale} color={state.countries[m.ownerId]!.color} opacity={pulse}/>;})}
          {!selectedPath.isEmpty() && <Path path={selectedPath} style="stroke" color="#f0db9e" strokeWidth={selectionScale} opacity={pulse} />}
          <MapMarkerLayer state={state} zoom={snapshot.zoom} preset={preset} labels={labels} countryGlyphs={countryGlyphs} cities={cities} cityLabels={cityLabels} counters={counters} countryId={selectedCountryId} armyId={selectedArmyId} cityId={selectedCityId} provinceId={selectedProvinceId} geometry={provinceGeometry} visible={visibleIds} font={font} counterFont={counterFont} nationFont={nationFont} labelBudget={budgets.labels}/>
          {state.battleLog.filter(b => state.tick - b.tick <= 1&&visibleIds.has(b.provinceId)).slice(0, 8).map(b => {
            const f = provinceGeometry.get(b.provinceId); if (!f || !visibleIds.has(b.provinceId)) return null;
            return <Group key={b.id} transform={[{ translateX: f.anchor.x }, { translateY: f.anchor.y }]}><Group transform={inverseScale}><Circle cx={0} cy={0} r={17} style="stroke" strokeWidth={2} color="#c66b55" opacity={pulse} /></Group></Group>;
          })}
        </Group>
      </Canvas>
    </GestureDetector>
    <View style={styles.toolbar}>
      <Pressable accessibilityLabel="Настройки карты" style={styles.button} onPress={() => setSettingsOpen(!settingsOpen)}><Text style={styles.text}>{MODE_LABELS[mode]} · {preset} ▾</Text></Pressable>
      <Pressable accessibilityLabel="Обзор мира" style={styles.button} onPress={() => animateCamera({ x: 720, y: 310, zoom: Math.max(0.5, viewport.width / 1450) })}><Text style={styles.text}>МИР</Text></Pressable>
      <Pressable accessibilityLabel="Фокус выбранной провинции или страны" style={styles.button} onPress={()=>{const selected=selectedProvinceId?provinceGeometry.get(selectedProvinceId)?.anchor:undefined;const capital=mapCities.find(c=>c.id===state.countries[selectedCountryId??'']?.capitalCityId)?.point;const target=selected??capital;if(target)animateCamera({...target,zoom:6});}}><Text style={styles.text}>К ВЫБРАННОМУ</Text></Pressable>
      <Pressable accessibilityLabel="Европа" style={styles.button} onPress={() => animateCamera(defaults)}><Text style={styles.text}>ЕВРОПА</Text></Pressable>
    </View>
    <View style={styles.zoomControls}>
      {[1.5, 1 / 1.5].map((factor, i) => <Pressable key={i} accessibilityLabel={i ? 'Отдалить' : 'Приблизить'} style={styles.button} onPress={() => animateCamera(zoomAt({ x: x.value, y: y.value, zoom: zoom.value }, factor, { x: viewport.width / 2, y: viewport.height / 2 }, viewport))}><Text style={styles.zoomText}>{i ? '−' : '+'}</Text></Pressable>)}
    </View>
    {settingsOpen && <ScrollView style={styles.settings} contentContainerStyle={{padding:14,gap:10}}>
      <Text style={styles.heading}>РЕЖИМ КАРТЫ</Text><View style={styles.options}>{AVAILABLE_MODES.filter(m => m !== 'Resources' || state.provinces.some(p => p.resourceDeposit)).map(m => <Pressable accessibilityLabel={`Режим ${MODE_LABELS[m]}`} accessibilityState={{selected:mode===m}} key={m} style={[styles.option, mode === m && styles.active]} onPress={() => { setMode(m); setSettingsOpen(false); }}><Text style={styles.text}>{MODE_LABELS[m]}</Text></Pressable>)}</View>
      <Text style={styles.heading}>КАЧЕСТВО ГРАФИКИ</Text><View style={styles.options}>{(Object.keys(GRAPHICS) as GraphicsPreset[]).map(p => <Pressable key={p} style={[styles.option, preset === p && styles.active]} onPress={() => choosePreset(p)}><Text style={styles.text}>{p}</Text></Pressable>)}</View>
      <PerformanceControls frameRate={frameRate} onFrameRate={setFrameRate} overlay={overlay} onOverlay={setOverlay} adaptive={adaptive} onAdaptive={setAdaptive} running={benchmarkRunning} onBenchmark={()=>void startBenchmark()}/>
    </ScrollView>}
    {benchmarkRunning&&<View pointerEvents="none" style={{position:'absolute',top:54,left:12,backgroundColor:'#17242a',padding:8}}><Text style={styles.text}>Benchmark: {MODE_LABELS[mode]} · тестовая симуляция не изменяет кампанию</Text></View>}
    {overlay&&<PerformanceOverlay/>}
    <View style={styles.legend}><Text style={styles.note}>{MODE_LABELS[mode]}{(mode==='Diplomatic'||mode==='Relations')?` · ${state.countries[selectedCountryId??'']?.name??'Выберите страну'}`:''}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:9}}>{legend.map(item=><View key={item.label} style={{flexDirection:'row',alignItems:'center',gap:4}}><View style={{width:10,height:10,backgroundColor:item.color}}/><Text style={styles.note}>{item.label}</Text></View>)}</ScrollView></View>
  </View>;
});
const styles = StyleSheet.create({
  frame: { flex: 1, backgroundColor: '#101f2b', overflow: 'hidden' },
  toolbar: { position: 'absolute', top: 12, left: 12, right: 60, flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  button: { backgroundColor: '#17242aee', borderWidth: 1, borderColor: '#485953', paddingHorizontal: 12, paddingVertical: 10,minHeight:44,justifyContent:'center', borderRadius: 5 },
  text: { color: '#dddcca', fontSize: 11, fontWeight: '600' },
  zoomText: { color: '#dddcca', fontSize: 20, textAlign: 'center' },
  zoomControls: { position: 'absolute', right: 10, bottom: 108, gap: 6 },
  settings: { zIndex: 10, position: 'absolute', left: 12, top: 60, width: 420, maxWidth: '65%', maxHeight:'75%', backgroundColor: '#17242af5', borderRadius: 6, borderWidth: 1, borderColor: '#485953' },
  heading: { color: '#98a79e', fontSize: 10, letterSpacing: 1 }, options: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  option: { padding: 10,minHeight:44,justifyContent:'center', backgroundColor: '#2a383d', borderRadius: 4 }, active: { backgroundColor: '#625b40' },
  legend: { position: 'absolute', left: 12, bottom: 54, width:'55%',maxWidth:600,backgroundColor:'#17242acc',padding:4,borderRadius:6 }, note: { color: '#c1c7b6', fontSize: 9, backgroundColor: '#17242acc', padding: 5, alignSelf: 'flex-start' },
});
