import {countryRenderFeatures,renderFeaturesFor,countryOutlines} from '../map/countryRender';
import {loadPreferences,savePreferences} from '../performance/preferences';
import {clusterArmies} from '../map/armyClusters';
import {PerformanceControls,PerformanceOverlay} from './PerformancePanel';
import {recordMetrics,getMetrics,resetMetricSamples} from '../performance/telemetry';
import {adaptQuality,initialQuality,targetFrameRate,type FrameRate,type QualityState} from '../performance/quality';
import {visibleChunks,type RenderChunk} from '../map/renderChunks';
import {geometryForLod,selectGeometryLod,type GeometryLod} from '../map/geometryLod';
import {preparedCountryLabels} from '../map/labelIndex';
import {mapLegend} from '../map/modes';
import {armyCounters,constructionProgress,occupationFeatures,warBorderPath} from '../map/overlays';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, PixelRatio } from 'react-native';
import { Canvas, Circle, Fill, Group, LinearGradient, Path, Rect, Text as MapText, Skia, matchFont, vec } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { cancelAnimation, runOnJS, useAnimatedReaction, useFrameCallback, useDerivedValue, useSharedValue, withDecay, withTiming } from 'react-native-reanimated';
import { countryFor, type CountryId, type GameState, type Province } from '../types/game';
import { boundedCamera, Camera, clamp, TILT, visibleBounds, zoomAt } from '../map/camera';
import { featurePath, Point } from '../map/geometry';
import { mapSceneFor, type MapScene } from '../map/worldScene';
import { borderPaths, buildProvinceColors, cityLabelPlacements, troopsByProvince, visibleCities } from '../map/scene';
import { AVAILABLE_MODES, GRAPHICS, GraphicsPreset, MapMode, MODE_LABELS } from '../map/settings';
import { lakes, rivers, terrainPatches } from '../map/terrain';

interface WorldMapProps {
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
const chunkPaths=new WeakMap<LazyPaths,WeakMap<Map<string,string>,Map<RenderChunk,[string,NativePath][]>>>();
function batchChunk(chunk:RenderChunk,colors:Map<string,string>,paths:LazyPaths):[string,NativePath][]{
 let generations=chunkPaths.get(paths);if(!generations){generations=new WeakMap();chunkPaths.set(paths,generations);}let chunks=generations.get(colors);if(!chunks){chunks=new Map();generations.set(colors,chunks);}const cached=chunks.get(chunk);if(cached)return cached;
 const batch=new Map<string,NativePath>();for(const f of chunk.features){const color=colors.get(f.provinceId!)??'#37423f',path=batch.get(color)??Skia.Path.Make();path.addPath(paths.get(f.id)!);batch.set(color,path);}const result=[...batch.entries()];chunks.set(chunk,result);return result;
}
const linePath = (points: Point[]) => points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join('');
const riverPath = rivers.map(linePath).join('');
const mountainPath = terrainPatches.filter(t => t.type === 'mountain').flatMap(t => t.points.map(p => `M${p.x - 1.8},${p.y + 1.1}L${p.x},${p.y - 1.8}L${p.x + 1.8},${p.y + 1.1}Z`)).join('');
const forestPath = terrainPatches.filter(t => t.type === 'forest').flatMap(t => t.points.map(p => `M${p.x - 1},${p.y + 1.6}L${p.x},${p.y - 1.5}L${p.x + 1},${p.y + 1.6}Z`)).join('');
const desertPath = terrainPatches.filter(t => t.type === 'desert').map(t => linePath(t.points)).join('');
const compact = (v: number) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1e3)}K`;
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

export function WorldMap({ selectedArmyId,selectedCityId,onSelectArmy,onSelectCity,settingsOpen=false,onSettingsChange, state, selectedCountryId, selectedProvinceId, onSelectProvince, onLongPressProvince, focusCountryId }: WorldMapProps) {
  const scene = useMemo(() => {const start=performance.now();const scene=mapSceneFor(state);if(!sceneCosts.has(scene))sceneCosts.set(scene,performance.now()-start);recordMetrics({sceneMs:sceneCosts.get(scene)!});return scene;}, [state.dataset]);
  const { features, spatialIndex, provinceGeometry, cities: mapCities } = scene;
  const [viewport, setViewport] = useState({ width: 1, height: 1 });
  const [snapshot, setSnapshot] = useState<Camera>(defaults);
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
  const geometryLod=selectGeometryLod(snapshot.zoom,preset);
  const {paths,contextPath}=useMemo(()=>nativeScene(scene,geometryLod),[scene,geometryLod]);
  const setSettingsOpen=(value:boolean)=>onSettingsChange?.(value);
  const x = useSharedValue(defaults.x), y = useSharedValue(defaults.y), zoom = useSharedValue(defaults.zoom);
  const renderX=useSharedValue(defaults.x),renderY=useSharedValue(defaults.y),renderZoom=useSharedValue(defaults.zoom);
  const frameBudget=targetFrameRate(frameRate,preset),frameClock=useSharedValue(0),sampleClock=useSharedValue(0),frameCount=useSharedValue(0),slowFrames=useSharedValue(0),cameraUpdates=useSharedValue(0);
  const acceptFrameSample=useCallback((fps:number,ms:number,slow:number,updates:number)=>{recordMetrics({uiFps:fps,frameMs:ms,slowFrames:slow,cameraUpdates:updates},true);if(adaptive){quality.current=adaptQuality(quality.current,ceiling,fps,frameBudget,Date.now(),updates>3);if(quality.current.tier!==preset)setPreset(quality.current.tier);}},[adaptive,ceiling,frameBudget,preset]);
  const pulse=useSharedValue(.9);
  const animateEffects=(preset==='High'||preset==='Ultra')&&state.battleLog.some(b=>state.tick-b.tick<=1);
  useFrameCallback(frame=>{const dt=frame.timeSincePreviousFrame;if(dt===null||dt<=0)return;frameCount.value++;if(dt>1000/frameBudget*1.5)slowFrames.value++;if(frame.timestamp-frameClock.value>=1000/frameBudget-.5){frameClock.value=frame.timestamp;pulse.value=animateEffects?.8+.2*Math.sin(frame.timestamp/900):.9;if(renderX.value!==x.value||renderY.value!==y.value||renderZoom.value!==zoom.value){renderX.value=x.value;renderY.value=y.value;renderZoom.value=zoom.value;cameraUpdates.value++;}}if(sampleClock.value===0)sampleClock.value=frame.timestamp;const elapsed=frame.timestamp-sampleClock.value;if(elapsed>=1000){runOnJS(acceptFrameSample)(frameCount.value*1000/elapsed,elapsed/frameCount.value,slowFrames.value,cameraUpdates.value);sampleClock.value=frame.timestamp;frameCount.value=0;slowFrames.value=0;cameraUpdates.value=0;}});
  const startX = useSharedValue(0), startY = useSharedValue(0), startZoom = useSharedValue(1);
  const pinchX = useSharedValue(0), pinchY = useSharedValue(0), pinching = useSharedValue(false);
  const lastCull = useSharedValue(0), cullX = useSharedValue(defaults.x), cullY = useSharedValue(defaults.y), cullZoom = useSharedValue(defaults.zoom);
  useEffect(()=>()=>{cancelAnimation(x);cancelAnimation(y);cancelAnimation(zoom);},[x,y,zoom]);
  useAnimatedReaction(() => ({ x: x.value, y: y.value, zoom: zoom.value }), camera => {
    const now = Date.now();
    const moved = Math.hypot(camera.x - cullX.value, camera.y - cullY.value) * camera.zoom > 96;
    const scaled = Math.abs(Math.log(camera.zoom / cullZoom.value)) > 0.1;
    if ((moved || scaled) && now - lastCull.value > 100) {
      lastCull.value = now; cullX.value = camera.x; cullY.value = camera.y; cullZoom.value = camera.zoom;
      runOnJS(setSnapshot)(camera);
    }
  });
  const transform = useDerivedValue(() => [{ translateX: viewport.width / 2 }, { translateY: viewport.height / 2 }, { scaleX: renderZoom.value }, { scaleY: renderZoom.value * TILT }, { translateX: -renderX.value }, { translateY: -renderY.value }]);
  const inverseScale = useDerivedValue(() => [{ scaleX: 1 / renderZoom.value }, { scaleY: 1 / (renderZoom.value * TILT) }]);
  const borderScale = useDerivedValue(() => GRAPHICS[preset].borderWidth / renderZoom.value);
  const outerScale = useDerivedValue(() => borderScale.value * 2);
  const selectionScale = useDerivedValue(() => borderScale.value * 2.7);
  const bounds = useMemo(() => visibleBounds(snapshot, viewport, 140), [snapshot, viewport]);
  const visible = useMemo(() => spatialIndex.query(bounds).filter(f => f.provinceId), [bounds]);
  const visibleIds = useMemo(() => new Set(visible.map(f => f.provinceId!)), [visible]);
  const owners = useStableColors(useMemo(()=>new Map(state.provinces.map(p=>[p.id,p.ownerId])),[state.provinces]));
  const provinceDetail = snapshot.zoom >= (preset==='Performance'?5:preset==='Balanced'?3.8:2.8);
  const renderFeatures=useMemo(()=>renderFeaturesFor(scene,owners,!provinceDetail&&mode==='Political'),[scene,owners,provinceDetail,mode]);
  const computedBorders = useMemo(() => {const outline=renderFeatures===features?null:countryOutlines(renderFeatures,bounds);return outline===null?borderPaths(state, visibleIds, scene.edges, provinceDetail):{inner:'',outer:outline};}, [owners, visibleIds, scene, provinceDetail,renderFeatures,bounds]);
  const borders=useMemo(()=>computedBorders,[computedBorders.inner,computedBorders.outer]);
  const controllers=useStableColors(useMemo(()=>new Map(state.provinces.map(p=>[p.id,p.controllerId??p.ownerId])),[state.provinces]));
  const warSides=(state.wars??[]).map(w=>w.id+':'+w.attackers.join(',')+'|'+w.defenders.join(',')).join(';');
  const warBorders=useMemo(()=>state.wars?.length?warBorderPath(state,visibleIds,scene.edges):'',[controllers,warSides,visibleIds,scene]);
  const occupations=useMemo(()=>occupationFeatures(state,visible),[state.provinces,visible]);
  const counters=useMemo(()=>clusterArmies(armyCounters(state,visibleIds),provinceGeometry,snapshot.zoom,selectedArmyId),[state.armies,visibleIds,provinceGeometry,snapshot.zoom,selectedArmyId]);
  const legend=useMemo(()=>mapLegend(state,mode),[state.provinces,mode]);
  const troops = useMemo(() => troopsByProvince(state), [state.armies]);
  const provinceColors = useStableColors(useMemo(() => buildProvinceColors(state, mode, troops, selectedCountryId??undefined), [state.countries, state.provinces, state.diplomacy,state.wars,selectedCountryId, mode, troops]));
  const provinces = useMemo(() => new Map(state.provinces.map(p => [p.id, p])), [state.provinces]);
  const cityState = useMemo(()=>new Map((state.cities??[]).map(c=>[c.id,c])),[state.cities]);
  // Query immutable coordinates first. Do not recreate/reindex 7,214 points each tick.
  const cities = useMemo(() => visibleCities(mapCities, bounds, snapshot.zoom, preset).map(c=>({...c,population:cityState.get(c.id)?.population??c.population})), [mapCities, cityState, bounds, snapshot.zoom, preset]);
  const font = useMemo(() => matchFont({ fontFamily: 'sans-serif', fontSize: 11, fontWeight: '600' }), []);
  const counterFont = useMemo(() => matchFont({ fontFamily: 'sans-serif', fontSize: 10, fontWeight: 'bold' }), []);
  const nationFont = useMemo(() => matchFont({ fontFamily: 'sans-serif', fontSize: 13, fontWeight: 'bold' }), []);
  const armyLabelBlockers = useMemo(() => snapshot.zoom < 1.5 ? [] : [...troops.keys()].filter(id => visibleIds.has(id)).flatMap(id => {
    const feature = provinceGeometry.get(id);
    return feature ? [{ ...feature.anchor, halfWidth: 27 / snapshot.zoom, halfHeight: 12 / (snapshot.zoom * TILT) }] : [];
  }), [troops, provinceGeometry, visibleIds, snapshot.zoom]);
  const cityLabels = useMemo(() => cityLabelPlacements(cities, snapshot.zoom, TILT, name => measure(font,name), armyLabelBlockers, visibleBounds(snapshot, viewport, 0)), [cities, snapshot, viewport, font, armyLabelBlockers]);
  const selectAt = useCallback((px: number, py: number, cx: number, cy: number, z: number, long: boolean) => {
    const world = { x: (px - viewport.width / 2) / z + cx, y: (py - viewport.height / 2) / (z * TILT) + cy };
    const cityHit = visibleCities(mapCities, visibleBounds({ x: cx, y: cy, zoom: z }, viewport, 0), z, preset).find(c => Math.hypot((c.point.x - world.x) * z, (c.point.y - world.y) * z * TILT) < 12);
    const marker=counters.find(c=>Math.abs((c.x-world.x)*z)<25&&Math.abs((c.y-world.y)*z*TILT)<20);
    const army=marker?state.armies.find(a=>a.id===(marker.ids.includes(selectedArmyId??'')?selectedArmyId:marker.ids[0])):undefined;
    const nearby=army?{a:army,g:provinceGeometry.get(army.provinceId)}:undefined;
    const hit = nearby?.g ?? (cityHit ? provinceGeometry.get(cityHit.provinceId) : null) ?? spatialIndex.hit(world);
    const province = hit?.provinceId ? provinces.get(hit.provinceId) : null;
    if(!long&&nearby&&onSelectArmy){onSelectArmy(nearby.a.id,nearby.a.provinceId);return;}
    if(!long&&cityHit&&onSelectCity){onSelectCity(cityHit.id,cityHit.provinceId);return;}
    if (province) (long ? onLongPressProvince ?? onSelectProvince : onSelectProvince)(province);
  }, [counters,selectedArmyId,viewport, provinces, state.armies, onSelectProvince, onLongPressProvince,onSelectArmy,onSelectCity, preset, scene, mapCities]);

  const gestures = useMemo(() => {
    const pan = Gesture.Pan().minDistance(5).maxPointers(1).onStart(() => { cancelAnimation(x); cancelAnimation(y); startX.value = x.value; startY.value = y.value; })
      .onUpdate(e => { if (pinching.value) return; x.value = clamp(startX.value - e.translationX / zoom.value, 0, 1440); y.value = clamp(startY.value - e.translationY / (zoom.value * TILT), 0, 720); })
      .onEnd(e => { if (pinching.value) return; x.value = withDecay({ velocity: -e.velocityX / zoom.value, clamp: [0, 1440] }); y.value = withDecay({ velocity: -e.velocityY / (zoom.value * TILT), clamp: [0, 720] }); });
    const pinch = Gesture.Pinch().onStart(e => {
      cancelAnimation(x); cancelAnimation(y); cancelAnimation(zoom); pinching.value = true; startZoom.value = zoom.value;
      pinchX.value = (e.focalX - viewport.width / 2) / zoom.value + x.value;
      pinchY.value = (e.focalY - viewport.height / 2) / (zoom.value * TILT) + y.value;
    }).onUpdate(e => {
      zoom.value = clamp(startZoom.value * e.scale, 0.5, 18);
      x.value = clamp(pinchX.value - (e.focalX - viewport.width / 2) / zoom.value, 0, 1440);
      y.value = clamp(pinchY.value - (e.focalY - viewport.height / 2) / (zoom.value * TILT), 0, 720);
    }).onFinalize(() => { pinching.value = false; runOnJS(setSnapshot)({ x: x.value, y: y.value, zoom: zoom.value }); });
    const doubleTap = Gesture.Tap().numberOfTaps(2).maxDelay(260).onEnd((e, ok) => {
      if (!ok) return;
      const target = zoomAt({ x: x.value, y: y.value, zoom: zoom.value }, 1.7, { x: e.x, y: e.y }, viewport);
      x.value = withTiming(target.x, { duration: 240 }); y.value = withTiming(target.y, { duration: 240 }); zoom.value = withTiming(target.zoom, { duration: 240 }, done => { if (done) runOnJS(setSnapshot)(target); });
    });
    const tap = Gesture.Tap().onEnd((e, ok) => { if (ok) runOnJS(selectAt)(e.x, e.y, x.value, y.value, zoom.value, false); });
    const long = Gesture.LongPress().minDuration(500).onStart(e => runOnJS(selectAt)(e.x, e.y, x.value, y.value, zoom.value, true));
    return Gesture.Race(Gesture.Simultaneous(pan, pinch), long, Gesture.Exclusive(doubleTap, tap));
  }, [viewport, selectAt, x, y, zoom, startX, startY, startZoom, pinching, pinchX, pinchY]);

  const animateCamera = (camera: Camera) => {
    const c = boundedCamera(camera);
    x.value = withTiming(c.x, { duration: 260 }); y.value = withTiming(c.y, { duration: 260 }); zoom.value = withTiming(c.zoom, { duration: 260 }, done => { if (done) runOnJS(setSnapshot)(c); });
  };
  const chunks=useMemo(()=>visibleChunks(renderFeatures,bounds),[renderFeatures,bounds]);
  const colors=useMemo(()=>chunks.flatMap(chunk=>batchChunk(chunk,provinceColors,paths)),[chunks,provinceColors,paths]);
  const selectedPath = useMemo(() => { const path = Skia.Path.Make(); const silhouette=!selectedProvinceId?renderFeatures.find(f=>f.id==='render-country-'+selectedCountryId):undefined;if(silhouette){path.addPath(paths.get(silhouette.id)!);return path;} visible.filter(f => selectedProvinceId ? f.provinceId === selectedProvinceId : owners.get(f.provinceId!) === selectedCountryId).forEach(f => path.addPath(paths.get(f.id)!)); return path; }, [visible, selectedProvinceId, selectedCountryId, owners, paths,renderFeatures]);
  const shadowPath = useMemo(() => { const path = Skia.Path.Make(); if(GRAPHICS[preset].shadows)colors.forEach(c => path.addPath(c[1])); return path; }, [colors,preset]);
  const labelZoom = Math.exp(Math.round(Math.log(snapshot.zoom) * 4) / 4);
  const preparedLabels = useMemo(() => preparedCountryLabels(features,owners),[features,owners]);
  const labels = useMemo(() => {
    const blockers=[...cityLabels.values()].map(label=>label.box).concat(armyLabelBlockers);
    return preparedLabels.filter(label=>label.anchor.x>=bounds.left&&label.anchor.x<=bounds.right&&label.anchor.y>=bounds.top&&label.anchor.y<=bounds.bottom).sort((a,b)=>Number(b.countryId===selectedCountryId)-Number(a.countryId===selectedCountryId)||b.width-a.width).slice(0,preset==='Performance'?10:preset==='Balanced'?18:32).map(label=>{
      const name=state.countries[label.countryId]?.name??'';
      const halfWidth=Math.min(label.width,measure(nationFont,name)/labelZoom)/2;
      return {...label,blocked:blockers.some(b=>Math.abs(b.x-label.anchor.x)<halfWidth+(b.halfWidth??0)&&Math.abs(b.y-label.anchor.y)<11/(labelZoom*TILT)+(b.halfHeight??0))};
    });
  },[preparedLabels,bounds,cityLabels,armyLabelBlockers,nationFont,labelZoom,state.countries,preset,selectedCountryId]);
  useEffect(() => {
    if (!focusCountryId || viewport.width <= 1) return;
    const capitalId = state.countries[focusCountryId]?.capitalCityId;
    const capital = mapCities.find(c => c.id === capitalId);
    if (!capital) return;
    const target = { x: capital.point.x, y: capital.point.y, zoom: 5 };
    x.value = withTiming(target.x, { duration: 260 }); y.value = withTiming(target.y, { duration: 260 });
    zoom.value = withTiming(target.zoom, { duration: 260 }, done => { if (done) runOnJS(setSnapshot)(target); });
  }, [focusCountryId, scene, viewport.width, x, y, zoom]);
  const terrain = GRAPHICS[preset].terrain;
  useEffect(()=>{recordMetrics({renderFeatures:chunks.reduce((n,c)=>n+c.features.length,0),visibleProvinces:visible.length,visibleArmies:counters.length,visibleLabels:cityLabels.size+labels.filter(l=>!l.blocked).length,preset,geometryLod,mapRenders:getMetrics().mapRenders+1});});
  const startBenchmark=async()=>{if(benchmarkRunning)return;const token=++benchmarkToken.current,original={x:x.value,y:y.value,zoom:zoom.value},originalMode=mode;setBenchmarkRunning(true);setSettingsOpen(false);resetMetricSamples();recordMetrics({benchmarkError:'',benchmarkTicks:0});try{for(let i=0;i<AVAILABLE_MODES.length;i++){if(token!==benchmarkToken.current)return;setMode(AVAILABLE_MODES[i]!);const target=i%3===0?{x:720,y:300,zoom:.8}:i%3===1?{x:790,y:170,zoom:7}:{x:1000,y:210,zoom:3};x.value=withTiming(target.x,{duration:1800});y.value=withTiming(target.y,{duration:1800});zoom.value=withTiming(target.zoom,{duration:1800});await new Promise(r=>setTimeout(r,2200));}const {prepareBenchmarkState,advanceBenchmark}=await import('../performance/benchmark');let simulation=prepareBenchmarkState(state);for(let i=0;i<12;i++){if(token!==benchmarkToken.current)return;const started=performance.now();simulation=advanceBenchmark(simulation);recordMetrics({simulationMs:performance.now()-started,benchmarkTicks:i+1});await new Promise(r=>setTimeout(r,20));}}catch(error){recordMetrics({benchmarkError:error instanceof Error?error.message:String(error)});}finally{if(token===benchmarkToken.current){animateCamera(original);setMode(originalMode);setBenchmarkRunning(false);}}};

  return <View style={styles.frame} onLayout={e => setViewport({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
    <GestureDetector gesture={gestures}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Fill color="#101f2b" />
        {GRAPHICS[preset].water && <Rect x={0} y={0} width={viewport.width} height={viewport.height}><LinearGradient start={vec(0, 0)} end={vec(viewport.width, viewport.height)} colors={['#101c27', '#1e3543', '#12212e']} /></Rect>}
        <Group transform={transform}>
          <GeographyLayer contextPath={contextPath} shadowPath={shadowPath} colors={colors} borders={borders} preset={preset} mode={mode} terrain={terrain} borderScale={borderScale} outerScale={outerScale} provinceBorders={provinceDetail}/>
          {occupations.map(f=><Group key={'occupied-'+f.id}><Path path={paths.get(f.id)!} color={state.countries[provinces.get(f.provinceId!)!.controllerId!]!.color} opacity={.28}/><Path key={'occupation-'+f.id} path={paths.get(f.id)!} color={state.countries[provinces.get(f.provinceId!)!.controllerId!]!.color} opacity={.55} style="stroke" strokeWidth={selectionScale}/></Group>)}
          {warBorders!==''&&<Path path={warBorders} style="stroke" color="#ed7f72" strokeWidth={selectionScale} opacity={pulse}/>}
          {(state.movements??[]).filter(m=>state.tick-m.tick<=2&&(visibleIds.has(m.from)||visibleIds.has(m.to))).map((m,i)=>{const from=provinceGeometry.get(m.from)?.anchor,to=provinceGeometry.get(m.to)?.anchor;if(!from||!to)return null;return <Path key={'movement-'+i} path={`M${from.x},${from.y}L${to.x},${to.y}`} style="stroke" strokeWidth={selectionScale} color={state.countries[m.ownerId]!.color} opacity={pulse}/>;})}
          {!selectedPath.isEmpty() && <Path path={selectedPath} style="stroke" color="#f0db9e" strokeWidth={selectionScale} opacity={pulse} />}
          {snapshot.zoom < 8 && labels.filter(label => label.anchor.x >= bounds.left && label.anchor.x <= bounds.right && label.anchor.y >= bounds.top && label.anchor.y <= bounds.bottom).map(label => {
            if (label.blocked) return null;
            const country = countryFor(state, label.countryId as CountryId);
            const fullWidth = measure(nationFont,country.name);
            const name = label.width * snapshot.zoom / (fullWidth + 12) < 0.8 ? country.shortName : country.name;
            const width = measure(nationFont,name);
            const scale = Math.min(1.7, label.width * snapshot.zoom / (width + 12));
            if (scale < 0.55) return null;
            return <Group key={label.countryId} transform={[{ translateX: label.anchor.x }, { translateY: label.anchor.y }]}><Group transform={inverseScale}><Group transform={[{ scale }]}><MapText x={-width / 2} y={4} text={name} font={nationFont} color="#e4e6dc" /></Group></Group></Group>;
          })}
          {cities.map(city => <Group key={city.id} transform={[{ translateX: city.point.x }, { translateY: city.point.y }]}><Group transform={inverseScale}>
            {GRAPHICS[preset].shadows && city.capital && <Circle cx={0} cy={0} r={7} color="#ebd6a1" opacity={0.16} />}
            <Circle cx={0} cy={0} r={city.capital ? 3.2 : 2} color={city.capital ? '#f1dca8' : '#c7cec1'} />
            {city.id===selectedCityId&&<Circle cx={0} cy={0} r={9} style="stroke" strokeWidth={2} color="#ffffff"/>}
            {city.capital && <Circle cx={0} cy={0} r={5} style="stroke" strokeWidth={1} color="#f1dca8" />}
            {cityLabels.has(city.id) && <MapText x={cityLabels.get(city.id)!.dx} y={cityLabels.get(city.id)!.dy} text={city.name} font={font} color="#eee9d8" />}
          </Group></Group>)}
          {counters.map(counter=>{const {troops:count}=counter;const selected=counter.ids.includes(selectedArmyId??'');
            return <Group key={counter.key} transform={[{ translateX: counter.x }, { translateY: counter.y }]}><Group transform={inverseScale}>
              <Rect x={-24} y={-8} width={48} height={18} color="#172329" />
              <Rect x={-24} y={-8} width={48} height={18} style="stroke" strokeWidth={selected?2.5:.8} color={selected?'#ffe5a1':state.countries[counter.ownerId]!.color} />
              <Path path="M-19,-4L-10,5M-10,-4L-19,5" color="#bec5b6" style="stroke" strokeWidth={0.8} />
              <MapText x={-7} y={5} text={compact(count)} font={counterFont} color="#eff0e3" />
            </Group></Group>;
          })}
          {(state.constructions??[]).filter(c=>visibleIds.has(c.provinceId)).slice(0,60).map(c=>{const f=provinceGeometry.get(c.provinceId);if(!f)return null;return <Group key={c.id} transform={[{translateX:f.anchor.x},{translateY:f.anchor.y}]}><Group transform={inverseScale}><Rect x={-18} y={16} width={36} height={5} color="#182633"/><Rect x={-18} y={16} width={36*(constructionProgress(state,c.provinceId)??0)} height={5} color="#dbc58a"/></Group></Group>;})}
          {state.battleLog.filter(b => state.tick - b.tick <= 1).slice(0, 8).map(b => {
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
}
interface GeographyProps{contextPath:NativePath;shadowPath:NativePath;colors:[string,NativePath][];borders:{inner:string;outer:string};preset:GraphicsPreset;mode:MapMode;terrain:boolean;borderScale:ReturnType<typeof useDerivedValue<number>>;outerScale:ReturnType<typeof useDerivedValue<number>>;provinceBorders:boolean}
// Simulation/HUD/selection changes do not reconcile thousands of static GPU paths.
const GeographyLayer=memo(function GeographyLayer({contextPath,shadowPath,colors,borders,preset,mode,terrain,borderScale,outerScale,provinceBorders}:GeographyProps){useEffect(()=>{recordMetrics({geographyRenders:getMetrics().geographyRenders+1});});return <Group>
          <Path path={contextPath} color="#354440" fillType="evenOdd" />
          <Path path={contextPath} style="stroke" color="#65736b" strokeWidth={borderScale} opacity={0.4} />
          {GRAPHICS[preset].shadows && <Group transform={[{ translateX: 0.9 }, { translateY: 1.2 }]}><Path path={shadowPath} color="#030b12" opacity={0.5} /></Group>}
          {colors.map(([color, path],index) => <Path key={index} path={path} color={color} fillType="evenOdd">{mode==='Political'&&<LinearGradient start={vec(720, 70)} end={vec(900, 310)} colors={[color, '#455252']} />}</Path>)}
          {terrain && (mode==='Political'||mode==='Terrain') && <>
            <Path path={mountainPath} color="#d1cfbc" opacity={0.32} />
            <Path path={mountainPath} style="stroke" color="#273b36" strokeWidth={0.3} opacity={0.8} />
            <Path path={forestPath} color="#183f32" opacity={0.5} />
            <Path path={desertPath} style="stroke" strokeWidth={6} strokeCap="round" color="#c4b185" opacity={0.3} />
            <Path path={riverPath} style="stroke" color="#6594a5" strokeWidth={0.4} opacity={0.7} />
            {lakes.map((lake, i) => <Circle key={i} cx={lake.point.x} cy={lake.point.y} r={lake.radius} color="#203c4c" />)}
          </>}
          {provinceBorders&&<Path path={borders.inner} style="stroke" color="#273638" strokeWidth={borderScale} opacity={0.65} />}
          <Path path={borders.outer} style="stroke" color="#131f24" strokeWidth={outerScale} />
</Group>;});
const styles = StyleSheet.create({
  frame: { flex: 1, backgroundColor: '#101f2b', overflow: 'hidden' },
  toolbar: { position: 'absolute', top: 12, left: 12, right: 60, flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  button: { backgroundColor: '#17242aee', borderWidth: 1, borderColor: '#485953', paddingHorizontal: 12, paddingVertical: 10,minHeight:44,justifyContent:'center', borderRadius: 5 },
  text: { color: '#dddcca', fontSize: 11, fontWeight: '600' },
  zoomText: { color: '#dddcca', fontSize: 20, textAlign: 'center' },
  zoomControls: { position: 'absolute', right: 10, bottom: 108, gap: 6 },
  settings: { position: 'absolute', left: 12, top: 60, width: 420, maxWidth: '65%', maxHeight:'75%', backgroundColor: '#17242af5', borderRadius: 6, borderWidth: 1, borderColor: '#485953' },
  heading: { color: '#98a79e', fontSize: 10, letterSpacing: 1 }, options: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  option: { padding: 10,minHeight:44,justifyContent:'center', backgroundColor: '#2a383d', borderRadius: 4 }, active: { backgroundColor: '#625b40' },
  legend: { position: 'absolute', left: 12, bottom: 54, width:'55%',maxWidth:600,backgroundColor:'#17242acc',padding:4,borderRadius:6 }, note: { color: '#c1c7b6', fontSize: 9, backgroundColor: '#17242acc', padding: 5, alignSelf: 'flex-start' },
});
