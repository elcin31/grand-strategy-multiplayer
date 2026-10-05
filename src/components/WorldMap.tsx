import {mapLegend} from '../map/modes';
import {armyCounters,constructionProgress,occupationFeatures,warBorderPath} from '../map/overlays';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Canvas, Circle, Fill, Group, LinearGradient, Path, Rect, Text as MapText, Skia, matchFont, vec } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { cancelAnimation, runOnJS, useAnimatedReaction, useDerivedValue, useSharedValue, withDecay, withRepeat, withTiming } from 'react-native-reanimated';
import { countryFor, type CountryId, type GameState, type Province } from '../types/game';
import { boundedCamera, Camera, clamp, TILT, visibleBounds, zoomAt } from '../map/camera';
import { featurePath, Point } from '../map/geometry';
import { mapSceneFor, type MapScene } from '../map/worldScene';
import { borderPaths, buildProvinceColors, cityLabelPlacements, countryLabels, troopsByProvince, visibleCities } from '../map/scene';
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
const nativeScenes = new WeakMap<MapScene, { paths: Map<string, ReturnType<typeof Skia.Path.Make>>; contextPath: ReturnType<typeof Skia.Path.Make> }>();
function nativeScene(scene: MapScene) {
  const cached = nativeScenes.get(scene);
  if (cached) return cached;
  const paths = new Map(scene.features.map(f => [f.id, Skia.Path.MakeFromSVGString(featurePath(f))!]));
  const contextPath = Skia.Path.Make();
  scene.features.filter(f => !f.provinceId).forEach(f => contextPath.addPath(paths.get(f.id)!));
  const result = { paths, contextPath }; nativeScenes.set(scene, result); return result;
}
const linePath = (points: Point[]) => points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join('');
const riverPath = rivers.map(linePath).join('');
const mountainPath = terrainPatches.filter(t => t.type === 'mountain').flatMap(t => t.points.map(p => `M${p.x - 1.8},${p.y + 1.1}L${p.x},${p.y - 1.8}L${p.x + 1.8},${p.y + 1.1}Z`)).join('');
const forestPath = terrainPatches.filter(t => t.type === 'forest').flatMap(t => t.points.map(p => `M${p.x - 1},${p.y + 1.6}L${p.x},${p.y - 1.5}L${p.x + 1},${p.y + 1.6}Z`)).join('');
const desertPath = terrainPatches.filter(t => t.type === 'desert').map(t => linePath(t.points)).join('');
const compact = (v: number) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1e3)}K`;
const defaults: Camera = { x: 800, y: 160, zoom: 3.5 };

export function WorldMap({ selectedArmyId,selectedCityId,onSelectArmy,onSelectCity,settingsOpen=false,onSettingsChange, state, selectedCountryId, selectedProvinceId, onSelectProvince, onLongPressProvince, focusCountryId }: WorldMapProps) {
  const scene = useMemo(() => mapSceneFor(state), [state.dataset]);
  const { features, spatialIndex, provinceGeometry, cities: mapCities } = scene;
  const { paths, contextPath } = useMemo(() => nativeScene(scene), [scene]);
  const [viewport, setViewport] = useState({ width: 1, height: 1 });
  const [snapshot, setSnapshot] = useState<Camera>(defaults);
  const [preset, setPreset] = useState<GraphicsPreset>('Medium');
  const [mode, setMode] = useState<MapMode>('Political');
  const setSettingsOpen=(value:boolean)=>onSettingsChange?.(value);
  const x = useSharedValue(defaults.x), y = useSharedValue(defaults.y), zoom = useSharedValue(defaults.zoom);
  const startX = useSharedValue(0), startY = useSharedValue(0), startZoom = useSharedValue(1);
  const pinchX = useSharedValue(0), pinchY = useSharedValue(0), pinching = useSharedValue(false);
  const lastCull = useSharedValue(0), cullX = useSharedValue(defaults.x), cullY = useSharedValue(defaults.y), cullZoom = useSharedValue(defaults.zoom), pulse = useSharedValue(0.6);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
    return () => { cancelAnimation(pulse); cancelAnimation(x); cancelAnimation(y); cancelAnimation(zoom); };
  }, [pulse, x, y, zoom]);
  useAnimatedReaction(() => ({ x: x.value, y: y.value, zoom: zoom.value }), camera => {
    const now = Date.now();
    const moved = Math.hypot(camera.x - cullX.value, camera.y - cullY.value) * camera.zoom > 96;
    const scaled = Math.abs(Math.log(camera.zoom / cullZoom.value)) > 0.1;
    if ((moved || scaled) && now - lastCull.value > 100) {
      lastCull.value = now; cullX.value = camera.x; cullY.value = camera.y; cullZoom.value = camera.zoom;
      runOnJS(setSnapshot)(camera);
    }
  });
  const transform = useDerivedValue(() => [{ translateX: viewport.width / 2 }, { translateY: viewport.height / 2 }, { scaleX: zoom.value }, { scaleY: zoom.value * TILT }, { translateX: -x.value }, { translateY: -y.value }]);
  const inverseScale = useDerivedValue(() => [{ scaleX: 1 / zoom.value }, { scaleY: 1 / (zoom.value * TILT) }]);
  const borderScale = useDerivedValue(() => GRAPHICS[preset].borderWidth / zoom.value);
  const outerScale = useDerivedValue(() => borderScale.value * 2);
  const selectionScale = useDerivedValue(() => borderScale.value * 2.7);
  const bounds = useMemo(() => visibleBounds(snapshot, viewport, 300), [snapshot, viewport]);
  const visible = useMemo(() => spatialIndex.query(bounds).filter(f => f.provinceId), [bounds]);
  const visibleIds = useMemo(() => new Set(visible.map(f => f.provinceId!)), [visible]);
  const borders = useMemo(() => borderPaths(state, visibleIds, scene.edges), [state.provinces, visibleIds, scene]);
  const warBorders=useMemo(()=>warBorderPath(state,visibleIds,scene.edges),[state.provinces,state.wars,visibleIds,scene]);
  const occupations=useMemo(()=>occupationFeatures(state,visible),[state.provinces,visible]);
  const counters=useMemo(()=>armyCounters(state,visibleIds),[state.armies,visibleIds]);
  const legend=useMemo(()=>mapLegend(state,mode),[state.provinces,mode]);
  const troops = useMemo(() => troopsByProvince(state), [state.armies]);
  const provinceColors = useMemo(() => buildProvinceColors(state, mode, troops, selectedCountryId??undefined), [state.countries, state.provinces, state.diplomacy,state.wars,selectedCountryId, mode, troops]);
  const provinces = useMemo(() => new Map(state.provinces.map(p => [p.id, p])), [state.provinces]);
  const currentMapCities = useMemo(() => {
    const populations = new Map((state.cities ?? []).map(c => [c.id, c.population]));
    return mapCities.map(c => ({ ...c, population: populations.get(c.id) ?? c.population }));
  }, [mapCities, state.cities]);
  const cities = useMemo(() => visibleCities(currentMapCities, bounds, snapshot.zoom, preset), [currentMapCities, bounds, snapshot.zoom, preset]);
  const font = useMemo(() => matchFont({ fontFamily: 'sans-serif', fontSize: 11, fontWeight: '600' }), []);
  const counterFont = useMemo(() => matchFont({ fontFamily: 'sans-serif', fontSize: 10, fontWeight: 'bold' }), []);
  const nationFont = useMemo(() => matchFont({ fontFamily: 'sans-serif', fontSize: 13, fontWeight: 'bold' }), []);
  const armyLabelBlockers = useMemo(() => snapshot.zoom < 1.5 ? [] : [...troops.keys()].filter(id => visibleIds.has(id)).flatMap(id => {
    const feature = provinceGeometry.get(id);
    return feature ? [{ ...feature.anchor, halfWidth: 27 / snapshot.zoom, halfHeight: 12 / (snapshot.zoom * TILT) }] : [];
  }), [troops, provinceGeometry, visibleIds, snapshot.zoom]);
  const cityLabels = useMemo(() => cityLabelPlacements(cities, snapshot.zoom, TILT, name => font.measureText(name).width, armyLabelBlockers, visibleBounds(snapshot, viewport, 0)), [cities, snapshot, viewport, font, armyLabelBlockers]);
  const selectAt = useCallback((px: number, py: number, cx: number, cy: number, z: number, long: boolean) => {
    const world = { x: (px - viewport.width / 2) / z + cx, y: (py - viewport.height / 2) / (z * TILT) + cy };
    const cityHit = visibleCities(currentMapCities, visibleBounds({ x: cx, y: cy, zoom: z }, viewport, 0), z, preset).find(c => Math.hypot((c.point.x - world.x) * z, (c.point.y - world.y) * z * TILT) < 12);
    const nearby = z >= 1.5 ? state.armies.map(a => ({ a, g: provinceGeometry.get(a.provinceId) })).find(({ g }) => g && Math.abs((g.anchor.x - world.x) * z) < 25 && Math.abs((g.anchor.y - world.y) * z * TILT) < 20) : null;
    const hit = nearby?.g ?? (cityHit ? provinceGeometry.get(cityHit.provinceId) : null) ?? spatialIndex.hit(world);
    const province = hit?.provinceId ? provinces.get(hit.provinceId) : null;
    if(!long&&nearby&&onSelectArmy){onSelectArmy(nearby.a.id,nearby.a.provinceId);return;}
    if(!long&&cityHit&&onSelectCity){onSelectCity(cityHit.id,cityHit.provinceId);return;}
    if (province) (long ? onLongPressProvince ?? onSelectProvince : onSelectProvince)(province);
  }, [viewport, provinces, state.armies, onSelectProvince, onLongPressProvince,onSelectArmy,onSelectCity, preset, scene, currentMapCities]);

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
  const colors = useMemo(() => {
    const batch = new Map<string, ReturnType<typeof Skia.Path.Make>>();
    for (const f of visible) { const color = provinceColors.get(f.provinceId!) ?? '#37423f'; const path = batch.get(color) ?? Skia.Path.Make(); path.addPath(paths.get(f.id)!); batch.set(color, path); }
    return [...batch.entries()];
  }, [visible, provinceColors, paths]);
  const selectedPath = useMemo(() => { const path = Skia.Path.Make(); visible.filter(f => selectedProvinceId ? f.provinceId === selectedProvinceId : provinces.get(f.provinceId!)?.ownerId === selectedCountryId).forEach(f => path.addPath(paths.get(f.id)!)); return path; }, [visible, selectedProvinceId, selectedCountryId, provinces, paths]);
  const shadowPath = useMemo(() => { const path = Skia.Path.Make(); colors.forEach(c => path.addPath(c[1])); return path; }, [colors]);
  const labelZoom = Math.exp(Math.round(Math.log(snapshot.zoom) * 4) / 4);
  const labels = useMemo(() => {
    const blockers = [
      ...cities.map(c => ({ ...c.point, halfWidth: 7 / labelZoom, halfHeight: 7 / (labelZoom * TILT) })),
      ...[...cityLabels.values()].map(label => label.box),
      ...armyLabelBlockers,
    ];
    return countryLabels(features, new Map(state.provinces.map(p => [p.id, p.ownerId])), blockers, {
      height: 22 / (labelZoom * TILT), widths: new Map(Object.values(state.countries).map(c => [c.id, (nationFont.measureText(c.name).width + 12) * 1.7 / labelZoom])),
    }, new Set(visible.map(f => provinces.get(f.provinceId!)?.ownerId).filter((id): id is string => Boolean(id))));
  }, [state.provinces, state.armies, state.countries, cities, cityLabels, armyLabelBlockers, nationFont, labelZoom, scene, visible, provinces]);
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

  return <View style={styles.frame} onLayout={e => setViewport({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
    <GestureDetector gesture={gestures}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Fill color="#101f2b" />
        {GRAPHICS[preset].water && <Rect x={0} y={0} width={viewport.width} height={viewport.height}><LinearGradient start={vec(0, 0)} end={vec(viewport.width, viewport.height)} colors={['#101c27', '#1e3543', '#12212e']} /></Rect>}
        <Group transform={transform}>
          <Path path={contextPath} color="#354440" fillType="evenOdd" />
          <Path path={contextPath} style="stroke" color="#65736b" strokeWidth={borderScale} opacity={0.4} />
          {GRAPHICS[preset].shadows && <Group transform={[{ translateX: 0.9 }, { translateY: 1.2 }]}><Path path={shadowPath} color="#030b12" opacity={0.5} /></Group>}
          {colors.map(([color, path]) => <Path key={color} path={path} color={color} fillType="evenOdd">{mode==='Political'&&<LinearGradient start={vec(720, 70)} end={vec(900, 310)} colors={[color, '#455252']} />}</Path>)}
          {terrain && (mode==='Political'||mode==='Terrain') && <>
            <Path path={mountainPath} color="#d1cfbc" opacity={0.32} />
            <Path path={mountainPath} style="stroke" color="#273b36" strokeWidth={0.3} opacity={0.8} />
            <Path path={forestPath} color="#183f32" opacity={0.5} />
            <Path path={desertPath} style="stroke" strokeWidth={6} strokeCap="round" color="#c4b185" opacity={0.3} />
            <Path path={riverPath} style="stroke" color="#6594a5" strokeWidth={0.4} opacity={0.7} />
            {lakes.map((lake, i) => <Circle key={i} cx={lake.point.x} cy={lake.point.y} r={lake.radius} color="#203c4c" />)}
          </>}
          <Path path={borders.inner} style="stroke" color="#273638" strokeWidth={borderScale} opacity={0.65} />
          <Path path={borders.outer} style="stroke" color="#131f24" strokeWidth={outerScale} />
          {occupations.map(f=><Group key={'occupied-'+f.id}><Path path={paths.get(f.id)!} color={state.countries[provinces.get(f.provinceId!)!.controllerId!]!.color} opacity={.28}/><Path key={'occupation-'+f.id} path={paths.get(f.id)!} color={state.countries[provinces.get(f.provinceId!)!.controllerId!]!.color} opacity={.55} style="stroke" strokeWidth={selectionScale}/></Group>)}
          {warBorders!==''&&<Path path={warBorders} style="stroke" color="#ed7f72" strokeWidth={selectionScale} opacity={pulse}/>}
          {(state.movements??[]).filter(m=>state.tick-m.tick<=2&&(visibleIds.has(m.from)||visibleIds.has(m.to))).map((m,i)=>{const from=provinceGeometry.get(m.from)?.anchor,to=provinceGeometry.get(m.to)?.anchor;if(!from||!to)return null;return <Path key={'movement-'+i} path={`M${from.x},${from.y}L${to.x},${to.y}`} style="stroke" strokeWidth={selectionScale} color={state.countries[m.ownerId]!.color} opacity={pulse}/>;})}
          {!selectedPath.isEmpty() && <Path path={selectedPath} style="stroke" color="#f0db9e" strokeWidth={selectionScale} opacity={pulse} />}
          {snapshot.zoom < 8 && labels.filter(label => label.anchor.x >= bounds.left && label.anchor.x <= bounds.right && label.anchor.y >= bounds.top && label.anchor.y <= bounds.bottom).map(label => {
            if (label.blocked) return null;
            const country = countryFor(state, label.countryId as CountryId);
            const fullWidth = nationFont.measureText(country.name).width;
            const name = label.width * snapshot.zoom / (fullWidth + 12) < 0.8 ? country.shortName : country.name;
            const width = nationFont.measureText(name).width;
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
          {counters.filter(()=>snapshot.zoom>=1.5).map(counter=>{const {provinceId:id,troops:count}=counter;const selected=counter.ids.includes(selectedArmyId??'');
            const f=provinceGeometry.get(id)!;
            return <Group key={id+'|'+counter.ownerId} transform={[{ translateX: f.anchor.x }, { translateY: f.anchor.y }]}><Group transform={inverseScale}>
              <Rect x={-24} y={-8} width={48} height={18} color="#172329" />
              <Rect x={-24} y={-8} width={48} height={18} style="stroke" strokeWidth={selected?2.5:.8} color={selected?'#ffe5a1':state.countries[counter.ownerId]!.color} />
              <Path path="M-19,-4L-10,5M-10,-4L-19,5" color="#bec5b6" style="stroke" strokeWidth={0.8} />
              <MapText x={-7} y={5} text={compact(count)} font={counterFont} color="#eff0e3" />
            </Group></Group>;
          })}
          {(state.constructions??[]).filter(c=>visibleIds.has(c.provinceId)).slice(0,60).map(c=>{const f=provinceGeometry.get(c.provinceId);if(!f)return null;return <Group key={c.id} transform={[{translateX:f.anchor.x},{translateY:f.anchor.y}]}><Group transform={inverseScale}><Rect x={-18} y={16} width={36} height={5} color="#182633"/><Rect x={-18} y={16} width={36*(constructionProgress(state,c.provinceId)??0)} height={5} color="#dbc58a"/></Group></Group>;})}
          {state.battleLog.filter(b => state.tick - b.tick <= 1).slice(0, 8).map(b => {
            const f = provinceGeometry.get(b.provinceId); if (!f) return null;
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
      <Text style={styles.heading}>КАЧЕСТВО ГРАФИКИ</Text><View style={styles.options}>{(Object.keys(GRAPHICS) as GraphicsPreset[]).map(p => <Pressable key={p} style={[styles.option, preset === p && styles.active]} onPress={() => setPreset(p)}><Text style={styles.text}>{p}</Text></Pressable>)}</View>
    </ScrollView>}
    <View style={styles.legend}><Text style={styles.note}>{MODE_LABELS[mode]}{(mode==='Diplomatic'||mode==='Relations')?` · ${state.countries[selectedCountryId??'']?.name??'Выберите страну'}`:''}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:9}}>{legend.map(item=><View key={item.label} style={{flexDirection:'row',alignItems:'center',gap:4}}><View style={{width:10,height:10,backgroundColor:item.color}}/><Text style={styles.note}>{item.label}</Text></View>)}</ScrollView></View>
  </View>;
}
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
