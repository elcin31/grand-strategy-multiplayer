# Dominion visual update — measured host improvements, native acceptance pending

World: **7,214 → 5,411 cities (-24.993%)**, 195 countries / 2,924 provinces unchanged. All 195 capitals and 2,225 regional centers retained. Exact initial urban population 2,332,963,370 and province/country population 7,632,252,811 preserved. Selection is deterministic, population/density/protected-center ranked with country quotas; per-country counts and provenance in CITY_REDUCTION_VISUAL.json. Removed city state migrates to a retained center in its province; survivor IDs stable, ownership/development/growth carry preserved. Native pre-v12 saves and all 29 existing server rooms backed up before migration.

Paired host workload (BENCHMARK_VISUAL_PAIRED.json): same campaign/seed 101, 100 trusted authoritative ticks, 1,200 camera positions at zoom 0.8/3.5/7/12, 1280×720 Balanced. Original v4 catalogue and culling algorithm compared against reduced catalogue/tier indexes, interleaved on the same Node host. No migrations timed in either tick sequence. Warm/cold earlier baseline samples remain in BENCHMARK_VISUAL_BASELINE*.json; host timings vary and are not Android FPS.

| Measurement | v4 before | Visual update after |
|---|---:|---:|
| Cities | 7,214 | 5,411 |
| p95 city viewport query, ms | 0.535 | 0.185 |
| p95 local tick, ms | 75.818 | 56.907 |
| Markers across 1,200 queries | 18,476 | 13,951 |
| Initial full snapshot bytes | 3,671,090 | 3,297,031 |
| Full snapshot after 100 ticks, bytes | 3,923,731 | 3,518,439 |
| City data source bytes (definitions + points) | 1,573,708 | 1,185,389 |

Markers -24.49%, initial state -10.19%, city query p95 -65.45%, tick p95 -24.94% in this sample. Simulation/growth rules and server authority retained. New dynamic snapshot carries literal province cityIds to prevent old static catalogues re-inserting removed IDs; wire checksums/version/CAS unchanged.

Actual changes: weak-keyed capital/major/all tier point indexes avoid querying all points at global zoom; immutable visible city catalogue memoization avoids repeated culling on population-only ticks; marker budgets Performance/Balanced/High/Ultra 6/18/42/70; no political batch gradients on Performance/Balanced; existing camera transforms stay on UI thread. New menu imports no world/simulation/codec until launching; lightweight metadata sidecars avoid decoding multi-MB saves on menu entry (stale/missing sidecars fall back safely). Loading paints before latched world work. Existing AI staggering, geometry/border batching, autosave coalescing and bounded traces retained rather than reimplemented.

Nine WebP files for six original paintings total **1,370,604 bytes**. Menu/campaign/loading use 960px Performance/Balanced or 1600px High/Ultra; panel banners 640px. Only current art is mounted/decoded; static backdrops, no video/live blur. Images have RIFF length, SHA-256 and dimensions checked by scripts/verify-art.py.

Strict TS/167 JS/3 Python regressions and world/map/art checks pass locally. Software native startup, frame-time, PSS, command/AI/autosave and soak evidence will be recorded after CI; no new memory result yet. Physical Redmi Note 12 FPS, thermal behavior and touch latency remain unmeasured. 30/45–60/60 FPS are targets, not achieved claims. Native QA and complete release are **pending**.

---

# PASS 3 — v4 code/CI/native acceptance complete

Real-device v3 lag is confirmed. Province reduction is now actual gameplay data: **4,386 -> 2,924 (-33.33%, exactly /1.5)**. Deterministic adjacent land unions within countries, at most four source regions, protected capitals/major-center pairs; sea-only links never merged. All 195 countries, 7,214 cities, islands/coastline geometry and 7,632,252,811 initial people retained. Adjacency is the validated symmetric quotient graph, with no dangling/self links; isolated components are not collapsed into newly orphaned nodes. Generator/provenance: scripts/reduce-provinces.py and PROVINCE_REDUCTION_PASS3.json.

Geometry JSON: 3,410,382 -> 2,739,215 bytes (-19.68%). Far political view already used 195 country silhouettes in v3 and still does; no duplicate claimed gain. Local province geometry is reduced. Resource mixes preserve all original deposit types/richness with original income weights. Terrain/religion source composition is retained with dominant classifications (capital religion preserved). Population-weighted development; original aggregate base income calibrated so small-region floors do not vanish at first monthly update. Initial buildings are empty; all city and initial army capital references remapped.

Compatibility: explicit modern-world-v2 / state schema 11. Existing v1 saves/rooms are not silently merged or overwritten: v4 reports that they require v3, and offers creation of a new campaign. Arbitrary contested ownership/buildings/construction/war saves cannot be merged without losing decisions. New saves/orders round-trip and server remains authoritative.

Runtime: staged creation and 64-feature geometry chunks yield between work; first tap mounts loading feedback, same-render latch prevents duplicates. Entry listing reads metadata without validating every full campaign. Local private campaign states validated at creation/restore no longer run all migration/validation passes on every command; public/server reducer defaults retain full validation and commands always validate. Shared empty-building modifiers avoid thousands of hot allocations. AI strategies retain six-tick scheduling; tactical stacks use a deterministic four-tick country rotation (up to ceil(countries/4)*3 stacks/tick), preventing machine-clock nondeterminism. Free commander index replaces nested scans.

Army pathfinding: bounded BFS (uniform one-month edge cost), one route per command rather than per frame, server computes route; dynamic permissions rechecked each step, failed assault stops order, peace clears participant orders. Selected army route is a separate dynamic path. Construction and relations UI expose existing server rules; production/admin budget categories are now explicit. Factories/farms generate output and incur upkeep, not free treasury mutations.

Host observations are in BENCHMARK_PASS3.json and PROFILE_PASS3.json. Initial snapshot in current benchmark: 3,674,236 bytes vs recorded v3 baseline 4,195,254 (-12.42%; different documented fixture IDs). These are not paired physical device measurements or FPS. Final regression: 161 JS tests, strict TS, Python suite and benchmarks PASS. Release run 37725176471 and live backend QA 37725884194 PASS. Full binary and native limitations are recorded in RELEASE_REPORT.md.


## Final PASS 3 evidence

| Measurement | v3 recorded | v4 recorded |
|---|---:|---:|
| Gameplay provinces | 4,386 | 2,924 (-33.33%) |
| Geometry JSON bytes | 3,410,382 | 2,739,215 (-19.68%) |
| Geometry edges | 95,984 | 82,307 |
| Vertices including context | 165,859 | 136,918 |
| Far political country silhouettes | 195 | 195 (unchanged) |
| Seeded initial snapshot bytes | 4,195,254 | 3,674,236 (-12.42%) |
| Embedded JS bundle bytes | 11,390,840 | 10,589,176 |
| CI 10,000-tick p95, ms | 151.53 | 57.29 |
| CI 10,000-tick elapsed, seconds | 1,178 | 452 |
| CI maximum save bytes | 4,903,485* | 4,492,903 |

*The v3 maximum save value comes from historical LONG_SIMULATION_RESULTS.json; no paired percentage is inferred. Host/CI runs are not controlled physical-device comparisons, and evolving AI trajectories/army counts differ. Source details and raw host observations are preserved in BENCHMARK_PASS3.json, PROFILE_PASS3.json and LONG_SIMULATION_PASS3.md. The initial save comparison has documented fixture-ID differences. Static geometry is not transmitted by multiplayer; unchanged polling and existing dynamic-v1 encoding remain intact, without a new delta protocol.

V4 host scene preparation was 261.92ms in BENCHMARK_PASS3.json; create 68.29ms, label preparation 28.55ms, 100-tick server p95 84.48ms. Separate PROFILE_PASS3.json observed trusted local tick p95 69.35ms, AI decision callbacks 23.70ms (not full combat), 12 path queries p95 0.764ms. These are samples rather than portable speed guarantees.

Native release validation and 1,846.65-second soak PASS. Thirty emulator PSS samples 538,434–811,674 KiB, first 770,905/last 604,538; not proof of absence of all leaks. SwiftShader frame p50/p95/p99 150/250/350ms, 92.69% jank: emulator smoothness remains poor and is not hidden behind the UI callback FPS counter. No physical FPS, immediate GPU paint latency or eliminated-Redmi-lag claim. A first tap is accepted once with loading state; regression covers ten rapid taps, slow/failing operations and retry. Native flow makes one tap per launch action without a retry.

---

# PASS 2 — 0.5.0 / optimized v3 (CI/native acceptance complete)

Baseline: main a9d1d78, previously delivered optimized v2 0.4.0. Prior PASS 1 evidence follows unchanged. Physical Redmi Note 12 lag is confirmed; no physical FPS claim.

## Measured decisions

CPU profile of 100 authoritative ticks identified native structuredClone (3.686 seconds self CPU), recalcEconomy (1.345 seconds), AI (0.712 seconds) and GC (0.551 seconds). Creation 73.55ms; scene preparation 389.63ms; tick p95 143.62ms in that profiled host run. These are host measurements, not Android FPS or a controlled speedup estimate.

The world has 4,386 gameplay provinces, 7,214 cities, 95,984 geometry edges and 165,859 vertices including context. Full world view fed 4,386 province features into batches; the sampled Europe view fed 2,229. Province state alone is 2,439,462 bytes of the seeded 4,195,254-byte snapshot. Detailed inputs and sampled viewport/clone timings: PROVINCE_COST_PASS2.json.

**Gameplay province count: 4,386 -> 4,386.** This pass reduces render geometry, not the authoritative campaign graph. Only 157 same-country adjacent pairs have matching initial terrain, religion, resource type and buildings. A 1,500–3,000 campaign graph would require explicit heterogeneous resource/building aggregation and balance changes; blind merging would destroy information. No schema bump, old-save incompatibility, silent migration, city/resource/army deletion or server authority changes are introduced. Save-size/payload reduction from province deletion: **0%**. The existing dynamic-v1 network protocol remains intact.

## Implemented

- Offline-generated render-only country union: **195 silhouettes / 66,666 vertices**, preserving every island/coastline. Political view below detail threshold uses these; changed-owner countries fall back to original provinces. Exact hit geometry, occupation and armies remain separate. All province anchors covered by the union are regression checked.
- Global/regional country outlines use cached merged paths. Internal borders are not generated below detail threshold (Performance 5x, Balanced 3.8x, High/Ultra 2.8x). Original local geometry and all twelve modes remain available.
- Stable ownership/controller selectors prevent unchanged ticks from rebuilding borders/labels. Empty-war worlds do not scan war edges. City culling queries the immutable coordinate index before attaching visible population values; no new 7,214-point index per tick. Bounded text-measurement cache, 10/18/32 country-label budgets, existing city budgets/army clusters retained.
- A JSON-tree clone copies every mutable leaf without the host structuredClone serialization round-trip. It is limited to typed campaign trees. No mutable aliasing or skipped validation. Paired benchmark initially measured median 7.6ms versus 29.3ms; see current reproducible samples in the JSON report. Reducer, offline emissions and save snapshot capture use it. Input/save normalizers and server checks remain.
- AI garrison and urgency queries use the existing per-province army index rather than full army scans. Existing deterministic six-tick strategic schedule and three-stack tactical limit retained. No nondeterministic wall-clock cutoff is added to authoritative game logic.
- Start/singleplayer buttons are outside clipped scroll content. A synchronous latch rejects same-render duplicate taps, loading paints before synchronous world work, failure clears the latch. Saved/remote/new sessions share the latch. Map callbacks are stable across unrelated panel changes.
- Developer report v2 includes tap-to-action and tap-to-mounted-screen timings plus actual batched render feature count. These are JS/UI measurements, not hardware input-to-photon latency. Existing world/Europe/Asia/12-mode benchmark and detached 12-tick AI exercise retained.

## Validation / boundaries

Local combined suite before final packaging: 156 JS tests, strict TS and 3 Python tests. Release CI must independently pass. New regression coverage checks first start, same-render double tap, slow completion, failure/retry, repeat sessions, real LocalTransport startup, no mutable clone aliases, country LOD coverage and ownership fallback.

Native acceptance removes the old four-attempt Start retry. Release pipeline requires one tap, 10,000 authoritative ticks/save restores, all existing multiplayer and campaign tests, release binary verification, native process/reboot recovery, developer benchmark and **1,800 seconds** continuous rendering/simulation/autosave. Completion and exact artifact evidence will be appended only after success.

Final acceptance: run **37576520835**, source **416b0b70374ffc2f9eb84e238213bc389f19782f**, all three jobs PASS. 156 JS regressions, strict TS, 3 Python tests, map/world benchmarks, 10,000 deterministic ticks and 10 exact save restores. Dedicated production backend QA **37607813987** PASS; isolated test data removed. Native evidence **11478246984** verifies single-tap entry/start, all modes/presets, process/reboot restore, 12 benchmark ticks and **1,847.95 seconds** continuous render/simulation/autosave with no fatal logs.

Thirty native emulator PSS samples range 579,918–849,556 KiB (first 739,331; last 676,190); no monotonic growth during this window. SwiftShader remains slow: cumulative frame p50/p95/p99 150/300/450ms, 92.92% jank; sampled benchmark overlay UI 8 FPS. This is a stability/regression pass, not a passed smoothness target or physical FPS result. Do not hide these measurements or infer Redmi performance from them. APK identity and host tick/memory limits are recorded in RELEASE_REPORT.md.

No full GameState normalization rewrite, new gameplay systems, physical RAM/thermal claim, network-delta redesign or 60 FPS assertion. Software PSS/frame samples remain distinct from physical-device acceptance.

---

# PASS 1 — preserved historical evidence

# Android optimization session — 2026-10-07 (optimized CI/native emulator acceptance complete)

The physical Redmi Note 12 lag report is a confirmed HIGH performance issue. No physical-device performance claim is made. Existing Skia GPU rendering is retained; no countries, provinces, cities or gameplay systems are removed.

## Measured bottlenecks and changes

Camera preparation traced country polygons repeatedly, scanned all border edges and recreated visible native color batches. Ownership-generation labels, indexed/cached edge lines, cached low/medium/high geometry, lazy native paths and fixed spatial batches replace those hot paths. Immutable geography is memoized separately from selection/armies; identical derived colors retain their identity. Conservative 140px overscan and bounded chunks preserve offscreen geometry needed during native gestures. City queries use a cached grid. Army counters cluster by owner/screen cell at low zoom, conserve troop totals and isolate selected armies.

Camera transforms remain UI-thread shared values and are sampled at 30/60 FPS (Auto selects 30 for Performance). Decorative battle pulses obey the same budget; idle selections no longer continuously animate the whole canvas. These are camera update limits, not promises of GPU presentation rate. Adaptive quality uses sustained UI callback pressure, a 20-second cooldown and manual quality ceiling. Four presets, persisted preferences, startup-cost/pixel-load defaults, optional overlay, 12-mode benchmark and selectable/shareable report are integrated. UI callback cadence is explicitly distinguished from completed GPU frames. Native memory/thermal/GPU metrics are unavailable in that overlay.

AI retains deterministic staggered evaluation; owner/province army indexes remove repeated full-army scans in tactical candidate evaluation. Movement invalidates its index, recruitment/peace array changes rebuild it. Fixed simulation and network cadence remain independent of rendering. Defensive authoritative cloning/validation are retained: no unsafe mutation optimization.

Unchanged multiplayer polls already carry no snapshot. Changed snapshots now negotiate dynamic-v1, omit matching immutable metadata and restore it from the versioned local world catalog; custom legacy metadata stays on the wire. Dynamic fields, version/CAS, commands, auth and server ownership remain unchanged. Encoded snapshots have a separate checksum; original server checksum remains the unchanged-poll token. Old clients receive the old full format. No geometry polygons were sent before or after. Incremental event replay is not implemented.

Exited local campaigns previously remained in the process-global room map. They are now released after the existing successful save/exit flow. Telemetry retains at most 1,800 primitive samples; geometry/index caches are weak-keyed and bounded by the finite world and three LODs. The loading shell paints before optional map preparation. Autosave remains 10-second/coalesced with important-event saves.

## Before / after evidence

| Measurement | Before | After |
|---|---:|---:|
| Mean borders preparation, Node ms | 33.72 | 17.42 |
| Mean country labels preparation, Node ms | 65.35 | 0.94 |
| Mean culled provinces, same 24 cameras | 2,852.92 | 2,461.08 |
| Live full / dynamic snapshot bytes | 4,199,891 | 3,074,698 |
| 100-tick CPU p95, ms | 116.82 | 124.20 |

Raw camera samples: RENDER_BASELINE.json / RENDER_AFTER.json. The camera samples include the changed overscan and first edge-cache fill; they are CPU preparation measurements, not Android frame times. Tick p95 did not improve in these uncontrolled host samples; no simulation speedup claim is made. Live wire reduction is 26.8%; checksum/hydration of 4,386 provinces/7,214 cities and legacy response verified. Isolated QA room was removed afterwards. Dedicated functions: game-room v19, game-command v21.

Final optimized release CI is complete. Workflow **37564792672**, source **859747dc80832adf3d66ade62a4b69854bd97d3c**, passed all three jobs: build-apk, long-simulation and android-smoke. Build CI passed strict typecheck, **149/149 JavaScript tests**, the Python suite, map benchmark (query p95 **0.027 ms**) and full-world benchmark (tick p95 **152.24 ms**). The final 10,000-tick run passed ten exact save/restore cycles; tick p95 was **217.92 ms**, total time **1,700 s**, maximum snapshot **4,903,485 bytes**, maximum armies **2,317**. Native API 35 smoke passed network-disabled cold launch, landscape, campaign commands, 12 map modes, four presets, camera/layout/density/cutout, process restart, emulator reboot, the detached **12-tick performance benchmark**, and a **1,200-second render/simulation/autosave software soak**. No fatal JS/native crash was recorded. Physical-device FPS, thermal and battery behavior remain unverified and are not inferred from emulator or host timings.

## Optimized Android release evidence

- Final release workflow: **37564792672 PASS** on source **859747dc80832adf3d66ade62a4b69854bd97d3c**.
- Release artifact: **dominion-optimized-release**, ID **11458334028**.
- Extracted APK: **138,651,290 bytes**, SHA-256 `cd1bd79edf4a5083b13b5ed970ab53876336457382c2604146969153def4c288`.
- Version: **0.4.0 (4)**; min API 24, target/compile API 36; landscape; four ABIs; V2 signature; production multiplayer backend embedded.
- Embedded `assets/index.android.bundle`: **10,357,708 bytes**; Hermes and Skia verified.
- Android smoke evidence artifact: **11460625490**. Main native scenario PASS plus detached 12-tick benchmark and **1,200-second** continuous software soak PASS.
- Long-simulation evidence artifact: **11459875290**. **10,000 ticks**, **10 save/restore cycles**, 195 countries / 4,386 provinces / 7,214 cities, state equality preserved.
- This closes the code-level optimization/release session. It does **not** establish Redmi Note 12 FPS, thermals or battery acceptance; that requires a new physical-device test of this APK.

---

# Final block 1 — Performance hardening

Baseline: 701c37a. Full world: 195 countries, 4,386 provinces, 7,214 cities. Existing Skia renderer retained: cached native geometry, color batching, spatial index, viewport culling and zoom-dependent label budgets. Camera transforms run on the native UI thread; JS culling is throttled to 100ms/96px movement. No renderer rewrite.

CPU profiles (`node --cpu-prof --import tsx scripts/benchmark-world.ts 100`) located dominant costs in structuredClone, AI, economy and validation. Targeted changes: index capital cities once per AI tick, compute strategic context only when an evaluation/peace response needs it, and avoid decoding the identical persisted snapshot twice on unchanged heartbeat. Presence regression ensures an unchanged heartbeat cannot alter snapshot/checksum. Defensive state cloning and validation remain intact.

| Sample | Before | After |
|---|---:|---:|
| Tick p95, ms | 238.28 | 155.78 |
| AI function self CPU, 100 ticks, ms | 2327 | 749 |
| Initial JSON bytes | 4198915 | 4198915 |
| Final JSON bytes | 4485261 | 4485261 |

These are same-world CPU samples, not a controlled physical-device comparison. Concurrent host load and profiling overhead affect absolute times. Existing spatial benchmark: 5,000 polygons, 10,000 queries, p95 0.020ms, maximum 266 visible. No 60/30 FPS claim.

`node --import tsx scripts/benchmark-persistence.ts`: JSON 4,199,245 bytes; compressed/base64 706,388 bytes; serialize 18.9ms; checksum 25.8ms; pack 113.1ms; unpack 43.7ms; encode+decode save validation 200.9ms; sampled heap 96.3MB. This is server/Node CPU, not native startup or whole-process peak RAM. Unchanged 1.5s online polls already omit world payload; changed revisions still send authoritative snapshots. Client poll has one request in flight; commands serialize; no authority relaxation. Autosave coalescing from 6bf988f retained.

Strict typecheck and 125 tests pass. Native startup, camera framestats and memory evidence were captured with the final release (below); physical hardware/thermal testing remains unverified.

Final CI long simulation (run 37410899043, source 49ce9e9): 10,000 ticks in 1,203 seconds; tick p95 154.14ms; maximum snapshot 4,903,485 bytes. Post-GC heap samples 45.5–57.0MB and RSS 395–444MB across ticks 1,000–10,000; this shows bounded observed growth, not a proof against every possible leak. Instrumentation also retains sets of observed wars and battles. All ten atomic save/restore equality checks passed. See LONG_SIMULATION_RESULTS.json.

Final native evidence: cold activity launches 1,251/521/1,144ms; PSS before/after emulator reboot 381,395/283,822 KiB. Camera framestats on software-emulated GPU: 31 frames, 25 janky (80.65%). This is a material limitation of available performance evidence: physical 60/30 FPS targets are not established. Native interaction/restart/reboot acceptance passed; it is not a substitute for physical-device profiling.
