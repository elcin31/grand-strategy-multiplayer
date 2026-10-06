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
