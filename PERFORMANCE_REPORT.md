# Expansion 2.0 — native revision review, 2026-10-10

Runtime `efd1f3d` passes build / 10,000 ticks / full Android touch smoke + 1835.67s stress. Same-APK camera replay 37995443161 **REJECTED**: panel-closed histogram P95 117 -> 200ms; pinch P95 500 -> 400ms does not override the failed scenario or worse raw P99. Verified paired/native/APK hashes, all quantiles and sampled PSS in EXPANSION_NATIVE_EFD1F3D_REVIEW.json; long simulation EXPANSION_LONG_EFD1F3D.json. Current UI-host private-counter revision needs fresh native acceptance. No physical Redmi FPS, no completed Expansion 2.0, no final v2 APK claimed. Stages 3–11 remain fully authorized and pending.

Auxiliary CSV re-analysis (EXPANSION_CAMERA_STAGE_TIMINGS_EFD1F3D.json) locates panel-closed raw UI-work P95 **53.04 -> 100.23ms**, vsync-delay P95 **50.00 -> 83.33ms**, render-completion P95 **41.39 -> 44.67ms**. No new rasters built in that scenario; sampled JS CPU 3.45 -> 3.54%, native main UI 47.13 -> 53.32%. This describes a UI-path stall; exact attribution to new counters is a hypothesis under native test. Recent CSV counts are bounded samples, not whole-capture unique dropped display frames. Genuine >=5s non-flagged frames are now retained rather than silently filtered; sentinel/uncompleted rows remain excluded. Official Android timestamp definitions reviewed: https://android.googlesource.com/platform/frameworks/base/+/562ae3a/docs/html/training/testing/performance.jd and https://developer.android.com/tools/dumpsys.

Cold host persistence probe of the unchanged existing codec: 3,298,611-byte initial snapshot, serialize 96.42ms / checksum 145.99ms / encode+decode validation 618.58ms. One cold sample, not an Android result or paired improvement (EXPANSION_PERSISTENCE_BASELINE_D7C3D59.json). Quiet-camera scheduling reduces overlap at save start, but filesystem-read continuations still run synchronous validation; investigate staged/cooperative save processing while retaining checksums, corrupt-save refusal and atomic generations. No validation was removed.

---

# Expansion 2.0 — stage 1 implementation / native validation pending

**Checkpoint 056a5b2 rejected; do not accept or deliver it.** Same-emulator run 37985852569 / paired artifact 11645185137 found pinch full histogram p95 **550→700ms**, raw recent-window p95 **596.02→720.31ms**, p99 **916.82→1300.14ms**. Main UI mean CPU **77.36→83.42%**; JS mean **23.27→14.65%**. Local pan raw p95 **116.93→207.51ms** also regressed. World topology and static path counts stayed equal; reduced JS/cull counts do not prove improved presentation. EXPANSION_CAMERA_REJECTED_056a5b2.json preserves all nine scenarios and corrects the report's stale 0.7 metadata to the actual downloaded 0.8.1 baseline/run. No physical-device claim.

Revision under test: pack histogram counters in eight scalar shared values; sample distributions only for the overlay/benchmark and transfer in the existing once-per-second callback. Cache country flags as bounded 60×42 CPU rasters (up to 1.88MiB for 195 flags), avoiding repeated SVG display-list replay and retained SVG documents. Preserve raster CPU ownership to avoid cross-context GPU images. Advance expired deadlines directly to the next future phase, including short stalls. Pair motion start/settle notifications, covering inertia/toolbar camera animations while preserving bounded local-tick deferral. These target plausible measured overhead; attribution and improvement require the fresh native comparison. Existing pinch ≤110% gate retained; all other moving-scenario full histogram p95 gates now ≤120% of the identical baseline. No threshold weakened.

Baseline main dbb354ab, accepted native runtime 47b0db4 (0.8.1). New fixed-deadline camera pacing avoids clock drift; identical deterministic callback replay in EXPANSION_FRAME_PACING.json uses 20 seconds at 60/90/120Hz. At a 90Hz display and target60, old gate issues 900 updates / 20s versus 1200 after (45→60/s); target30 with ±0.9ms jitter issues 450 versus 600 (22.5→30/s). These isolate the algorithm, **not presented GPU frames or measured handset FPS**. Native CPU, frame latency and actual display smoothness require fresh paired CI/hardware evidence.

Added bounded UI interval histogram (23 buckets, at most one sample transfer per second), P50/P95/P99 upper bounds and counts >50/>100ms. Camera graphics transforms stay on UI thread; new game systems remain tick/event based. Gesture callbacks pair starts/finalization including cancellation; automatic saves wait for 750ms camera quiet, local ticks defer for at most1.5s, and manual/background saves remain durable. The first checkpoint tracked finger gestures only; the pending revision also tracks inertia and camera animations. No save write/schema behavior changed. Heavy save validation/JSON/checksum can still cause a JS stall once scheduled; physical results are unclaimed.

Renderer, static geography, province/city counts and existing LOD/caches unchanged. New country flags are recorded into the retained glyph picture from bounded existing licensed offline SVGs; no per-frame flag decoding. Touch glyph and hit bounds share the same layout and only visible painted labels have country targets. Fresh same-emulator 0.8.1 paired camera test configured, not yet completed. Earlier results below remain historical.

---

# Dominion 0.8.1 (9) — final paired native camera evidence

Tested runtime `47b0db4f8b220e9ea89998afaac035239b64f5e0`, main, workflow `37971350100`. Renderer implementation remains the recovered `61b77f4` work; the final follow-up integrates existing original artwork into commander cards, technology branches and the open war panel. No new image bytes, world reduction, gameplay/backend/save changes or new infrastructure. The architecture and rejected intermediate candidates are detailed in the archived 0.8.0 section below.

## Exact final paired workload

Final camera comparison job `113966823910` PASS; artifact `11638014235`, 6,058,342 bytes, SHA256 `5318ae6d204208fab98af9293499fc90108ee580c1ff67b29c4e97687e7cb818`. Download/CRC/hash, actual PNGs and all profile fatal logs independently reviewed. Same API35 SwiftShader emulator, 1280×720, Balanced/adaptive off, offline paused Germany at tick 5, identical real-pointer driver and nine scenarios for the accepted old 0.7.0 APK and final 0.8.1. Campaigns are created separately, so serialized states are not asserted byte-identical. All three broad geography-paint gates pass; idle/pinch/global/local/terrain/military/panel screenshots show actual geography and bounded markers.

Whole-capture HWUI histogram quantiles follow. Moving samples last 11.35–11.52 seconds after; 114–275 frames reported, recent CSV retains 114–120. Raw and histogram quantiles are different measurements. Idle has zero completed frames in both builds; no idle frame latency/FPS is inferred.

| Scenario | p50 before → after, ms | p95 before → after, ms | p99 before → after, ms | Jank before → after |
|---|---:|---:|---:|---:|
| Medium pan | 200 → 97 | 500 → 150 | 600 → 250 | 93.85% → 90.10% |
| Pinch | 200 → 105 | 600 → 350 | 900 → 750 | 93.22% → 91.23% |
| Whole-world pan | 350 → 97 | 800 → 117 | 1000 → 133 | 97.22% → 92.92% |
| Local labels / armies | 200 → 77 | 550 → 97 | 800 → 113 | 94.64% → 80.77% |
| Terrain pan | 250 → 81 | 550 → 109 | 650 → 133 | 97.73% → 86.17% |
| Military overlay | 150 → 77 | 250 → 105 | 350 → 133 | 94.51% → 80.36% |
| Panel open | 150 → 89 | 350 → 113 | 350 → 117 | 93.75% → 81.93% |
| Panel closed | 150 → 81 | 250 → 97 | 350 → 113 | 96.12% → 80.22% |

Raw recent-frame p95 for pinch is **624.92 → 375.47ms**, while its full histogram is **600 → 350ms**. Pinch passes the explicit no-regression acceptance gate, but remains the most costly motion scenario. After-capture software jank is still **80.22–92.92%**; no achieved physical 30/60 FPS or completely eliminated Redmi lag is claimed. Absolute timings differ from the separate 0.8.0 run (both its old baseline and candidate were faster); cross-run values are not a controlled 0.8.0-versus-0.8.1 regression comparison. Full raw frame/thread/resource evidence is `CAMERA_NATIVE_PAIRED_081.json`; the earlier raw pair is preserved as `_080`.

Paired PSS samples: **415,232–769,351 KiB before / 343,011–439,320 KiB after**. These are samples, not continuous memory peaks. Mean JS-thread CPU (fraction of one emulator core): medium pan **17.45% → 4.91%**, whole-world pan **24.45% → 1.18%**. Pinch JS mean is **19.55% → 21.45%**, and the new main UI mean is **73.73%**; reduced frame latency does not mean every thread measurement improves. RenderThread CPU is not GPU execution time. Pinch preparation/settling and software frame pacing remain the bottleneck requiring physical evidence.

Native resource counters show no path rebuild during medium pan (1,633 before/after) or whole-world pan (1,743 before/after). Raster build count remains 220 between panel-open and panel-closed samples. Sampled retained RGBA cache tops at 33,438,464 bytes, below 32MiB; this is not a total native/GPU memory limit. The overlay's 60 callback FPS is not completed GPU presentation FPS. `renderFeatures` is catalogue size, bounded label counts are estimates, and active raster/stack counters do not change authoritative armies/cities.

## Final paired host benchmark

`BENCHMARK_CAMERA_081_CI.json`: exact seed101 fixture, 1,200 frames / 20 seconds, 2,924 provinces / 5,411 cities / 182 armies / 1280×720. Selector/coverage/string CPU only; no native raster, React reconciliation, GPU or handset FPS claim. Pinch coverage commits **50 → 18**, selector total **284.63 → 72.56ms**, constructed geometry/border strings **45.55 → 2.11MB**. Local selector **53.40 → 16.48ms**, terrain **53.84 → 22.41ms**, world military **214.50 → 39.17ms**. Medium pan **19.84 → 18.17ms**. Cold panel-open **14.72 → 17.84ms** and panel-closed **13.76 → 18.74ms** are higher after; these cold costs are retained in the raw evidence rather than omitted. Other pan trajectories make seven old coverage commits versus one new host commit; this is the host fixture, not a count of native React updates.

## Images and final validation

All 15 original WebPs remain **2,188,634 bytes** with exact source-to-APK hashes; commander/technology/war use existing portrait/building/military images. Active panel mounting is lazy and stays outside the map Canvas. No repeated generation or extra compressed art bytes. Binary manifest, bundle and native/archive checks are in `RELEASE_CAMERA_081_LOCAL_VERIFICATION.json` and `RELEASE_CAMERA_081_INTEGRITY.txt`.

Strict TS / 175 JS / 10 Python / 15-art / map/world/paired-host gates PASS locally and final build CI. Final long simulation job `113958490336`, artifact `11638021146`: **10,000 ticks / ten exact restores**, 10,912 observed wars, 10,906 peace settlements, 9,157 battles, max 3,406 armies / 4,082,061-byte snapshot. Tick p95 **99.74ms**, elapsed **798s** on this Node runner, not Android frame latency. Raw final data: `LONG_SIMULATION_CAMERA_081_RESULTS.json`.

Final native smoke job **113966823944 PASS** (workflow **37971350100: all five jobs PASS**). Evidence artifact **11639851749**, 28,964,864 bytes, SHA256 `aa2888c401af7f1556a2dba4418030b607aa2137c3643d4f5a3dbd7ca27605a3`, downloaded with exact hash/CRC and reviewed. Network-disabled launch, one Singleplayer/Start tap, actual commander assignment and painted portrait, university/technology images and research, ruler/religion/government/building/menu/diplomacy images, commands, four presets/twelve modes/five layouts, density/cutout, detached benchmark and save/process/reboot checks PASS. Actual PNGs show painted map and panels, including the assigned commander and free commander cards. The soak ran **1,867.83 seconds**; **31 PSS samples** span **441,449–525,094 KiB** (first 490,445 / last 503,012). Both gameplay and stress logs have zero matched fatal JS/native, ANR or OOM patterns. Samples are not continuous peaks or a universal leak guarantee. Activity launch TotalTime values 2,029 / 969 / 1,847ms exclude full menu/campaign readiness; the harness's menu-to-campaign duration includes fixed waits and capture overhead. Raw review: `NATIVE_CAMERA_081_SMOKE_REVIEW.json`.

This native harness does not independently automate a full distant-target click-to-move battle or a live two-player production-room session. Shared path/command/combat/authority/save/transport regressions, the 10,000-tick simulation and inherited accepted unchanged-backend live QA remain the evidence for those systems. No new online production-room test or hardware battery/thermal result is claimed.

Physical Xiaomi Redmi Note 12 pan/pinch/thermal/battery acceptance remains **OPEN** until the user tests this exact APK. Code/native gates and hardware smoothness are separate statuses; final recovery status is recorded in `RECOVERY_AUDIT_CAMERA_2026-10-09.md`.

---

# Camera / map pass — archived 0.8.0 evidence (2026-10-09)

Recovered main `0ea39eca80dac8d68d379968f3a7275b874b56ae`; prior accepted APK runtime `c758ed78f586268809a2184a064ae7fdadc5156e`. Candidate runtime `61b77f4f4eb03fa01b710c9d34ee306a5359012d`, release workflow 37962664267. Only elcin31/grand-strategy-multiplayer and its existing backend are in scope. World/schema remain 195 countries / 2,924 provinces / 5,411 cities / modern-world-v2 / schema12. Gameplay, AI, economy schedule, server authority, saves and reconnect were not rewritten or deployed.

## Root cause and profiling

The confirmed physical symptom is camera pan/zoom/navigation. Old standalone APK reproduces poor frame pacing in an offline **paused** campaign: the map/render/input path contributes independently of simulation. Source and paired host profiling identify frequent React coverage commits (100ms, 96px/10% zoom thresholds), border/path string construction and native parsing, geometry/batch replacement during motion, animated inverse transforms on individual glyphs and an unbounded army-counter node count. The existing Reanimated UI-thread camera and Skia renderer were already present; this pass does not claim a new engine migration.

Intermediate native builds were rejected: a deferred viewport updater captured a pooled layout event, then JS-thread GPU snapshots failed to paint reliably in the Canvas context and cold detail changes worsened pinch p95. No speed result from the missing-map candidate counts as improvement. The current design captures layout primitives synchronously, retains transferable raster images, keeps prepared detail during zoom-in and refines at gesture settle. Zoom-out can lower detail to bound fine-tile coverage. Skia 2.6.2's own Offscreen helper uses a non-texture image when crossing contexts; this implementation uses bounded raster surfaces directly and lets Canvas upload immutable images in its own render context.

## Camera and renderer changes

Gesture transforms, focal pinch, clamps, inertia, current-coordinate hit testing and original selection geometry remain on the existing UI path. A stable delegate prevents gesture rebinding on recull. Camera coverage uses 288px overscan / 24px guard / 160ms crossing gate / 1.32 zoom ratio, with exact settled snapshots. No full-world geometry work occurs per finger pixel.

Static compiled paths, terrain and ownership-classified 64-world-unit border chunks are retained. Viewport selection precedes native nodes and painting. Four fixed raster grids have cells/scales 160/2, 96/4, 64/8 and 48/12 (maximum 576px plus 4px gutter). One bounded tile is prepared per deferred slice; the retained RGBA image LRU is 32MiB / 96 entries, with at most 96 pictures and cleanup on campaign exit. CPU image bytes are budgeted; device GPU copies and displayed/evicted image lifetime require native memory evidence, not a claim that total renderer memory equals 32MiB.

Intact political overview countries use merged silhouettes; changed countries retain exact province fallback. Geometry-array identity is reused across zoom returns, including mutable-owner callers. World detail omits internal province borders; local detail returns them. High/Ultra country fill gradients no longer incur per-frame map work. Treasury, selection, panels and army movement with unchanged political colors preserve static resources. Actual owner/color generation changes invalidate appearance caches; this is a generation key, not a per-changed-province tile invalidator.

Selection, controller occupation batches, war boundaries, routes, movements, battle rings and marker pictures stay separate. Visible IDs constrain provinces, cities, occupations, armies and battle markers; at most eight battle rings are drawn. One retained glyph picture replaces per-label/per-army animated groups. Balanced label budgets are 8/14/22 and army stacks 24/36/48 by scale, prioritizing selected objects, country/capital/major-city information. Clustering preserves every army ID, owner and troop total; authoritative units/orders are unchanged.

## Measurements and limits

Native protocol: same API35 SwiftShader emulator, old/new standalone APKs, offline paused Germany campaign, Balanced, adaptive off, verified overlay toggle, identical real one/two-pointer input. Nine captures cover idle, medium pan, pinch, whole-world pan, local labels/armies, terrain, military, panels open/closed. Completed-frame timestamps, whole-capture HWUI histograms/jank, active per-thread CPU, PSS, PNGs, accessibility and fatal logs are retained. Three broad political-map pixel checks reject transparent geography even when labels/markers remain.

Android CSV is a bounded recent-frame ring: report raw and whole-capture histogram quantiles together when truncated. Zero completed idle frames means no scheduled paint, not a 4,950ms frame. CPU percentages are fractions of one emulator core; RenderThread CPU is not GPU execution time. Overlay callback FPS is not GPU presentation FPS. Candidate accessibility counters record prepared-coverage province IDs, bounded label estimates/army stacks, coverage commits, path builds/time, raster builds/time/cache bytes/tiles and map/layer renders. renderFeatures is the geometry catalogue length, not a claim that every catalogue feature draws; label estimates are budget-capped rather than a GPU glyph trace. Raster tiles and path-build counters describe the retained native resources. Full Android allocation stacks, physical GPU/thermal/battery measurements are unavailable; host path-string bytes and native resource/PSS counters are proxies.

Paired comparison job **113937051395 PASS**, artifact **11634175847**, ZIP SHA-256 `24d29835411fef669fea7fb1aa2c009bf91f84847abcf60cff9c43b303ead215`. Both APKs use an offline Germany campaign paused at tick 5, same topology, Balanced, adaptive off, viewport, emulator and real gesture driver. Campaigns are created separately; serialized states are not asserted byte-identical. The pure-host comparison additionally fixes seed 101 and the exact state fixture. All three broad map-paint checks pass; actual political/global/local/pinch/panel PNGs were reviewed. No fatal JS/native error appears in either final profile log.

The table reports whole-capture HWUI histogram quantiles in milliseconds. Each moving capture lasts about 11.25–11.41 seconds. New captures produce 157–350 reported frames while the raw recent-frame ring retains only 117–120, so whole-capture histogram and raw quantiles must not be conflated. Idle schedules zero completed frames in both APKs and has no meaningful frame quantile.

| Scenario | Histogram p50 before → after, ms | Histogram p95 before → after, ms | Histogram p99 before → after, ms | Jank before → after |
|---|---:|---:|---:|---:|
| Medium pan | 150 → 81 | 300 → 109 | 350 → 113 | 95.79% → 86.49% |
| Pinch | 150 → 81 | 300 → 250 | 500 → 350 | 94.19% → 91.72% |
| Whole-world pan | 250 → 81 | 650 → 101 | 800 → 113 | 100.00% → 85.16% |
| Local labels / armies | 150 → 65 | 300 → 81 | 400 → 81 | 95.56% → 65.78% |
| Terrain pan | 150 → 61 | 350 → 81 | 450 → 89 | 96.34% → 64.55% |
| Military overlay | 109 → 61 | 150 → 81 | 150 → 89 | 98.61% → 66.29% |
| Panel open | 129 → 65 | 200 → 85 | 250 → 97 | 99.24% → 65.34% |
| Panel closed | 113 → 61 | 150 → 81 | 200 → 93 | 95.51% → 64.04% |

Paired profile PSS samples range **442,738–756,785 KiB before / 336,174–445,156 KiB after**, not a continuous peak or full allocation trace. Medium-pan sampled JS-thread mean CPU **14.73% → 2.91%** of one emulator core; world pan **20.91% → 0.91%**. Pinch mean JS CPU **17.73% → 12.14%**; new pinch max remains 28%, and main UI mean remains 78.67%. RenderThread CPU rises as the new renderer completes more frames and transfers work; this is not physical GPU utilization. Counters confirm retained paths/tiles stay reused across world/local pan and image cache bytes stay below the 32 MiB budget.

Raw recent-ring p95 remains **339.75 → 316.46ms for pinch**, compared with the full histogram **300 → 250ms**. This candidate passes the explicit no-regression pinch gate, but pinch cold preparation/settling and software frame pacing remain bottlenecks. Even improved SwiftShader captures still report 64.04–91.72% jank. No achieved 30/60 FPS or complete elimination of hardware lag is claimed. Raw captures and thread/resource data: `CAMERA_NATIVE_PAIRED_080.json`; full PNG/CSV/logs remain in the named artifact.

Paired pure-host camera benchmark covers 11 paths with 1,200 frames / 20 seconds / seed101. It measures selector/coverage preparation and string allocations, not raster painting, React reconciliation, GPU completion or handset FPS. Cold medium/panel paths can be higher even while repeated pinch/local/overview work falls. Final CI output in `BENCHMARK_CAMERA_080_CI.json`: pinch coverage commits **50 → 18**, selector CPU **351.29 → 83.65ms**, constructed geometry/border strings **45.55 → 2.11 MB**. Local selector work **64.49 → 19.45ms**, terrain **71.51 → 26.53ms**, world military **224.87 → 49.09ms**. Medium pan is **22.44 → 25.41ms** and panel-open **15.88 → 19.44ms** including cold preparation. These are different measurements from native raster painting and must not be converted into handset FPS.

## Illustration loading

Five original paintings supply ruler, ten-building, government and respectful religion atlases plus a new port loading scene. All 15 WebPs total 2,188,634 bytes; additional compressed assets are 818,030 bytes. Atlas variants share their panel bitmap, mount lazily in the active section and remain outside the map canvas. Loading chooses one background once per mount and one preset-appropriate resolution. No per-pan image decoding or eager load of all large art. SHA/dimension/existence/category checks and original provenance are in ASSET_CREDITS.md.

Local and candidate build gates passed: strict TypeScript, 175 JS tests, 10 Python tests, exact 15-art checks and map/world/paired-host camera/visual benchmarks. Accepted-candidate long simulation (workflow 37962664267/job 113929273065, artifact 11631804097) completed 10,000 ticks and ten exact restores; 10,912 observed wars, 10,906 peace settlements, 9,157 battles, maximum 3,406 armies and 4,082,061-byte snapshot. Host tick p95 100.82ms / 792s elapsed describe that runner, not an Android frame result. Raw results: LONG_SIMULATION_CAMERA_RESULTS.json. All five 0.8.0 jobs subsequently passed, including the paired camera comparison and 1,839.26-second soak / 30 PSS samples; historical review: `NATIVE_CAMERA_080_SMOKE_REVIEW.json`. Final 0.8.1 measurements and delivery supersede this intermediate release above.

Physical Xiaomi Redmi Note12 camera smoothness remains **OPEN** until the user installs and tests the delivered APK. Software-emulator improvements do not establish achieved physical FPS or complete elimination of lag.

---

# Dominion visual update — paired software benchmark and native release evidence

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

Markers -24.49%, initial state -10.19%, city query p95 -65.45%, tick p95 -24.94% in this sample. Simulation/growth rules and server authority retained. Final same-seed 100-tick dynamic payload: 3,062,702→2,877,473 bytes (-6.05%), including literal v12 city references; BENCHMARK_VISUAL_FINAL.json. Sidecar native commits explicitly await Expo File.move and replace only optional metadata; campaign generations remain no-overwrite. New dynamic snapshot carries literal province cityIds to prevent old static catalogues re-inserting removed IDs; wire checksums/version/CAS unchanged.

Actual changes: weak-keyed capital/major/all tier point indexes avoid querying all points at global zoom; immutable visible city catalogue memoization avoids repeated culling on population-only ticks; marker budgets Performance/Balanced/High/Ultra 6/18/42/70; no political batch gradients on Performance/Balanced; existing camera transforms stay on UI thread. New menu imports no world/simulation/codec until launching; lightweight metadata sidecars avoid decoding multi-MB saves on menu entry (stale/missing sidecars fall back safely). Loading state is set before latched world work, followed by two animation-frame callbacks. Existing AI staggering, geometry/border batching, autosave coalescing and bounded traces retained rather than reimplemented.

Nine WebP files for six original paintings total **1,370,604 bytes**. Menu/campaign/loading use 960px Performance/Balanced or 1600px High/Ultra; panel banners 640px. Only current art is mounted/decoded; static backdrops, no video/live blur. Images have RIFF length, SHA-256 and dimensions checked by scripts/verify-art.py.

Strict TS/167 JS/3 Python/world/map/art gates PASS locally and final workflow 37918487336. Final CI paired sample (BENCHMARK_VISUAL_CI.json): city-query p95 **0.285→0.092ms (-67.75%)**, tick p95 **75.808→61.918ms (-18.32%)**, identical marker/state-byte counts. Each comparison uses the same host/workload; absolute host timing varies. Final 10,000-tick run passed ten exact saves/restores, 10,906 peace settlements/9,157 battles; tick p95 **75.17ms**, elapsed 592s/max 4,082,061-byte snapshot. Checkpoint heap 39.3–50.1MB/RSS 320.8–423.2MB are host observations, not Android peaks.

Native API35 job **113787009485 PASS**, evidence **11613239385**. Exactly one Singleplayer tap and one Start tap; disabled Continue without save, menu/pages/Back, visible launch feedback, real campaign commands, four presets/twelve map modes, pan/double-tap, five layouts, density/cutout, process/reboot recovery and detached 12-tick benchmark pass. Actual final menu/new-campaign/loading/map/economy/diplomacy/government/dense screenshots reviewed. Native assertions enforce full painting coverage and un-clipped statistics. Continuous render/simulation/autosave soak **1,836.65 seconds**, no fatal JS/native logs.

| Software-emulator observation | Accepted v4 | Visual update |
|---|---:|---:|
| Three activity TotalTime samples, ms | 1325 / 423 / 1212 | 1647 / 674 / 1835 |
| 30-sample PSS range, KiB | 538,434–811,674 | 593,072–981,108 |
| Cumulative frame p50/p95/p99, ms | 150 / 250 / 350 | 105 / 200 / 400 |
| Cumulative janky frames | 92.69% | 84.37% |

Raw baseline/final observations: NATIVE_VISUAL_BASELINE.json/NATIVE_VISUAL_RESULTS.json. Baseline artifact 11529720645; final11613239385. Old v4 smoke had no new menu; workloads, compilation and host contention differ. These native samples are **not a controlled paired GPU, menu-readiness or peak-memory comparison**; no improvement percentage inferred. Menu-to-campaign-seconds.txt includes hierarchy dumps/screenshots/fixed harness waits and is not startup latency. Startup is structurally isolated from world/codec.

Software SwiftShader gfxinfo p50/p95/p99 **105/200/400ms**, **84.37% jank**. Thirty PSS samples **593,072–981,108 KiB**, first 700,306, last 631,847. Activity TotalTime **1647/674/1835ms** measures Android activity launch, not full menu readiness or touch latency. These are software-emulator observations, not physical FPS, peak memory or a leak-free guarantee. Redmi Note 12 frame pacing/FPS, pinch/touch latency, thermal and battery acceptance remain unmeasured. Native smoke does not independently automate full distant-target combat or two-finger pinch; reducer/live HTTP regressions cover route/combat/authority and existing camera worklets remain unchanged.

Software optimization/regression/native-emulator release gates complete. Physical 30/45–60/60 FPS remain targets pending user measurement.

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
