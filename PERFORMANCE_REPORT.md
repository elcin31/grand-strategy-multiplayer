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
