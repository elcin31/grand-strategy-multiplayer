# Expansion 2.0 — quiet raster preparation correction, 2026-10-10

Current renderer correction (commit titled `perf: prepare world raster tiles only during camera quiet`) retains the autosave continuation guard and every accepted army-selection interaction. It addresses a source-confirmed expensive fallback: first uncached world tiles replay vector Pictures while the bounded raster queue prepares images. This is a plausible source of pinch stalls, not a proven sole explanation of all frame-time variation.

MapRasterLayer now prepares low-LOD Political world tiles only after750ms camera quiet, in50ms slices, one small CPU surface per slice. Visible raster jobs run first; background/inactive app, gestures/inertia/toolbar motion and foreground queue defer preparation. Cleanup cancels timers. Existing32MiB/96-image LRU is retained: cold inserts require free capacity and never evict foreground entries; they are evicted first unless actually displayed. Background preparation adds no Canvas nodes or React updates. Cached foreground images bypass unnecessary vector Picture recording. Existing vector fallback remains for genuine cache misses; no geography, province/city count, quality preset, hit geometry or map detail is removed. GPU upload/frame completion still requires native measurements; individual synchronous CPU phases are not claimed fully parallel. `rasterPrewarmBuilds/rasterPrewarmMs` are diagnostic counters, not FPS.

Local strictTS / **188 JS** / production Android Hermes export **PASS**; final export1598modules (verified from bundler log) and15 existing optimized art assets, embedded AppEntry228001d91dcc94433a418f1511d18e81. Four new regressions cover free-capacity/cold eviction priority, promotion on real use, gesture/quiet/foreground deferral, one item per slice, timer cancellation and stale callback refusal. Required native camera/paint/army/saves/30min stress and fresh10k gates are pending for this renderer. React skill review: hook order stable, dependencies explicit, stable activity callback/refs, timer/resource cleanup, no UI touch or accessibility changes, bounded memory/work outside graphical frames.

Previous runtime **3cfd43f** is **performance rejected**, including the stronger fixed byte-identical world: run38027062613 forward all9 captured, histogram pinchP95 **450→600ms**, rawP95 **482.14→637.30**, rawP99 **682.13→849.77**. Reverse pair did not run after the unchanged gate failed. Verified artifact11660658177 SHA76a80a9d5d3c274473893bb6c08a57b93bfded7133c206008c753d97b6709b04; EXPANSION_CAMERA_FIXED_REJECTED_3CFD43F.json preserves all quantiles/stages/CPU. UIworkP95 **213.32→180.13** improves, while vsyncP95 **333.33→433.33** and renderCompletionP95 **36.94→60.41** worsen. JSmean6.36% both, pathcount364both/raster110→111. Its original independent-world pinch rejection is also retained. Do not dismiss either failed gate as campaign variance; do not lower10%/20% thresholds. 3c full native smoke/stress114138817620 completed SUCCESS at06:02:21UTC in38025683396. This does not override either camera rejection; Verified EXPANSION_NATIVE_3CFD43F_REVIEW.json: artifact11661556179 SHA5189c302d458564bc4fe8da5b9c2353420d2bc8bba4eab29ff1073679609d4be, ZIP hash/CRC checked;1847.46s stress,30 sampledPSS369550–518140KiB, no matched fatal/ANR/OOM logs, unchanged8% paint gate passed with land0.1268. Actual army-deselected/foreign-flag/world-reset PNGs inspected; map intact.

**Main dbb354ab038713c3e54b969b34a6fc88bf2de11f unchanged. Stage0 DONE; stage1 PARTIAL/requires corrected-runtime acceptance; stage2 implemented with d7 full native PASS; stages3–11 pending in full.** Existing Dominion backend/schema12/world195/2924/5411 unchanged. No expansion fields, schema13 migration or19 new illustrations yet; no final v2 APK. Next exact action: preserve code/tests in a logical commit and run fresh release/native gates for this renderer, then fixed-world A/B/B/A from its exact APK and inspect all tails/phase/CPU/memory/paint evidence. Resolve actual regressions before beginning all18 diplomacy actions in DIPLOMACY_IMPLEMENTATION_CONTRACT.md. Physical Redmi unmeasured. All authorized scope remains in EXPANSION_SCOPE.md.

---

# Current gate correction — original 3c camera rejection

Fresh runtime3cfd43f original camera job114138817610 in38025683396 **FAILED** at the unchanged pinch gate: rawP95 **450.67→633.54ms**, full histogram **400→600**; rawP99 **592.73→887.49**. All9 scenarios were captured and the verified original ZIP/PNGs/phases are retained in EXPANSION_CAMERA_REJECTED_3CFD43F.json. MainUI dominates; UIworkP95 **171.39→190.87ms**, JSmean **12.36→12.18%**. Staticgeometry1743 both/cache≈32MiB both; rasterbuilds116→129. The original independently generated campaigns and inherited unreset pinch camera are not byte-identical workloads. This is an investigation constraint, **not a proven explanation or dismissed failure**. Fixed-world A/B/B/A run38027062613 and own full native smoke/stress remain pending. Stage3 is blocked until the actual regression/comparability issue is resolved and required gates pass. No threshold is weakened; no final v2 APK exists.

---

# Expansion 2.0 — verified recovery and native evidence, 2026-10-10

Current game runtime **3cfd43f16678345ce0e55016775c7efb95d0e8cf** on expansion-v2; current main **dbb354ab038713c3e54b969b34a6fc88bf2de11f**, unchanged. Only the existing Dominion repository/backend is used. Schema12, 195 countries / 2924 provinces / 5411 cities and accepted map caches/design remain. Stage0 DONE; stage1/2 implemented with fresh runtime native acceptance pending; stages3–11 pending in their full authorized scope. No final v2 APK exists. Older checkpoint entries below are historical and superseded by this section.

Fresh run **38025683396**: build/strict TS/**184 JS /19 Python**/original15 WebP checks/production Hermes/standalone integrity **PASS**. Fresh10,000 ticks and10 exact codec restores **PASS**, host tickP95 **58.07ms** and460s; unchanged-engine outcomes match prior checkpoints (10,912 wars /10,906 settlements /9,157 battles). EXPANSION_LONG_3CFD43F.json records the verified artifact. This checks codec restoration, not native IO scheduling. Long-war age5871 and runaway 834-year treasury growth remain inherited balance concerns for stages4/5/10; no new expansion-balance acceptance is claimed.

Downloaded intermediate APK artifact11659354544 ZIP SHA b832e7608f74096a8fcac884075d7bba4d68914e1a97a8ce48fe7de68bf3db1a; CRC/hash verified. APK **140,964,517bytes**, SHA **7c25c90802d21df7f343b3f3cdce5db41b1cc054ebc023f83c41505e174eb2cd**, embedded Hermes **10,478,372bytes**, retained0.8.1(9)/landscape/nondebuggable/signature/dedicated backend. EXPANSION_SAVE_GUARD_APK_VERIFICATION.json retains exact CI metadata. This is not the final Expansion2.0 release and is not renamed/delivered as v2. Its own native camera job114138817610 and full smoke/stress114138817620 remain in progress. A fixed-world forward/reverse comparison of this new runtime is the next QA action.

Previous runtime **d7c3d59** now passed full same-APK native run **38023398108**: actual repeated army marker/Back deselect preserve orders, foreign flag wins, reselect and separate movement cancel; offline cold launch, command panels, presets/modes, five layouts, density/cutout, save/kill/reboot restoration and **1866.43s** continuous render/simulation/autosave stress. Verified artifact11660625545 SHAfa8c99b0683301202d9d057e82851696b013e83adf6d0e364e78f8f48063ea54; actual PNGs show intact map, deselection and diplomacy. 31 sampledPSS **429,059–536,538KiB**, first486,822/last510,244; no matched fatal/ANR/OOM logs. EXPANSION_NATIVE_D7C3D59_ACCEPTED.json. The unchanged8% paint gate passed after world overview reset; no paint threshold weakened.

Previous runtime fixed-save forward/reverse run **38024943471** also **PASS**, all9 scenarios in both orders, same byte-identical schema12 seed101 save/checksum. Artifact11659019576 SHA92ddd66b1ba4b24893e0f553b61562206760308fd7cc3dc6218c208581f9ce94 CRC/hash verified. Forward pinch histogramP95 **600→550ms**, rawP95 **616.86→569.16**, rawP99 **949.36→750.21**. Reverse histogramP95 **650→500**, rawP95 **683.54→522.39**, rawP99 **1180.42→1183.75**. Full quantiles/phase/CPU/memory/paint summaries in EXPANSION_CAMERA_REPEATED_D7C3D59_REVIEW.json. Original run's worse pinchP99 is retained; samples≤120/recent CSV ring and software-rendered emulator variability prevent universal tail-improvement claims. Physical Redmi has not been measured. Completed genuine≥5s frames are not discarded; HWUI events overlap and are not uniquely dropped display frames.

Recovery AI reproduction: EXPANSION_OCCUPIED_AI_BASELINE.json records a real pending human peace offer handed to AI at tick12. With64 controlled French provinces it settles on tick13; with0 it remains pending. runStrategicAI skips event responses before !home.length. This inherited defect is reserved for stage4; the cause of long-simulation maxWarAge5871 remains unproven. Fixed-world autosave QA **38027062613**, source1076a50dc4e033eeef4f81794fa75ba4d651c8a1, is now running against exact3c APK in both orders with unchanged gates.

**Next exact action:** verify fresh3c own smoke/stress and camera results plus fixed-world repeat without weakening gates. If an actual performance regression appears, fix it before stage3. Once required stage1/2 gates pass, implement every action in DIPLOMACY_IMPLEMENTATION_CONTRACT.md on the existing reducer/CAS/save/movement paths; preserve compatibility and keep schema13 off production until coordinated release. Autosave quiet continuations are fixed, but individual CPU serialization/validation phases remain synchronous and contradictory host save timings remain fully recorded in EXPANSION_SAVE_GUARD_BENCHMARK.json.

---

# Expansion 2.0 — autosave continuation correction, 2026-10-10

Stage1 code now rechecks camera quiet **after each asynchronous save read and before heavy validation/serialization**. This closes the recovered gap where a new gesture began while IO was outstanding. Manual/background save releases pending quiet waits, never waits for a camera gesture and keeps the existing atomic queue; effect cleanup lets old snapshots finish without late UI updates. The metadata sidecar reuses already verified metadata, without a second full JSON parse or holding decoded GameState over later file awaits. Manual saves avoid added scheduling awaits. Private snapshot capture and individual checksum/validation/serialization phases remain synchronous once begun; this is not a claim of completely parallel saves or elimination of every stall.

Strict TS, full184JS, final focused15 save/city/order regressions and19Python passed. Final production Android Metro/Hermes export PASS, 1597modules/15original WebP assets. Final strictTS and8 focused save tests PASS after the manual-fastpath adjustment; release build/native QA pending. New tests cover old/pending reads finishing during a gesture, corruption refusal, manual/lifecycle flush of parked autosave, captured snapshot immutability and metadata/generation consistency. All old backup/checksum/atomic-generation tests retained. EXPANSION_SAVE_GUARD_BENCHMARK.json stores **all** host probes including contradictory timings; no stable CPU/Android speedup is established. scripts/benchmark-save-store.ts is reproducible from the d7 historical store and current shared codec, cleans only its own temporary file and asserts every resulting state/index.

Previous game runtime **d7c3d593802f2edf27894f92fe10928341df0080** still has original independent-world and fixed-world nine-scenario P95 PASS; fixed-world pinch P99 remains investigated. Repeat run38023545936 stopped after7 baseline scenarios on interactive UIAutomator exit137, before candidate capture; it is **incomplete**, not accepted or evidence of candidate performance. Downloaded artifact11660181010 SHAe355a7dcb7ddf000a703f5ec85b17a6b1ccc1977d94d1ff6d764abe6ffb79db9 CRC/hash verified. New bounded accessibility helper retries only137/timeout with unchanged live game PID and no fatal logs; missing controls/process changes/fatals/other errors/persistent failures still reject. All P95/paint gates unchanged. Reverse-order rerun **38024943471**, QA **d3d3dfd4a39069a4a4e3dc0977ed1aaae30d735f**, and full native smoke **38023398108** on byte-identical d7 APK are pending. These do not substitute for fresh QA of the autosave correction.

**Stage0 DONE; Stage1 PARTIAL; Stage2 implemented/native touch subset PASS; stages3–11 pending in full.** Main dbb354ab unchanged, dedicated Dominion backend unchanged/no production writes, schema12/195countries/2924provinces/5411cities retained. No19new paintings or new expansion gameplay fields yet. No final v2 APK. Next exact action: complete fresh release build/camera/native/save/stress gates for this autosave runtime and review d7 forward/reverse tail evidence; correct any actual regression, then implement all18 diplomacy actions according to DIPLOMACY_IMPLEMENTATION_CONTRACT.md. All scope remains in EXPANSION_SCOPE.md. Physical Redmi results remain unmeasured.

---

# Expansion 2.0 — verified sampler checkpoint, 2026-10-10

Actual runtime **d7c3d593802f2edf27894f92fe10928341df0080**, build/long/camera run **38021043667**. Main remains **dbb354ab038713c3e54b969b34a6fc88bf2de11f**. Stage 0 complete; Stage 1 investigated/optimized with P95 gates passing but remaining pinch tail concern; Stage 2 implemented and real native marker/order/Back/foreign-flag/reselection/cancel checks passed before the full smoke stopped on a geography-crop false positive. Stages 3–11 remain pending with all scope preserved in EXPANSION_SCOPE.md. No final v2 APK exists.

- **Strict TS / 182 JS / 10 Python / original 15 art / production Hermes / release integrity / 10,000 ticks with ten exact restores PASS in original build CI.** Latest test harness adds four Python regressions (14 local PASS). Long simulation 471s, host tick P95 61.11ms; host timing is not Android performance or an attributable UI improvement. Numeric/world/battle outcomes match the unchanged engine; prior balance concerns remain.
- **Original nine-scenario independent-campaign-v1 camera PASS.** Native raw pinch P95 371.12 -> 316.76ms, panel-closed 100.18 -> 84.73ms. EXPANSION_CAMERA_D7C3D59_REVIEW.json records P50/P95/P99, memory and frame stages.
- **Stronger fixed-save-reset-v2 nine-scenario camera PASS**, run **38022207120**, QA source **dbe8a1e1927c16f97378a17f80bf1d637cd53766**. Both release APKs loaded the byte-identical paused schema12 seed101 world (SHA3882257a66e558a529dd2cd8005e782243a7b07adf1a54576564465402288dc5, checksum e8befae1); camera reset before each workload and final stored state checked exactly. Full histogram P95 pinch550 ->550ms / world150 ->150 / panel-closed101 ->101. Raw P95 pinch600.18 ->594.78 / panel-closed105.61 ->101.34. **Pinch P99 worsened**: histogram800 ->1100ms, raw839.57 ->1144.85; do not hide this behind P95 or claim universal improvement. No >=5s completed frame was discarded. Sampled PSS before329162–426706 / after336089–406038KiB. EXPANSION_CAMERA_FIXED_D7C3D59_REVIEW.json preserves all scenarios and the older exporter metadata correction.
- **Full Android smoke job114125259526 stopped** after actual touch/commands/research/build/economy/treaty/presets/modes checks at the free-camera screenshot paint gate: left crop land0.0623<0.08. Downloaded artifact11658924540, SHA835513d73fc14acfe5f9e0c2029f1ff3bebfe270532b68ab1745ba6daaa8863f. Original PNG visually shows intact Americas/borders/provinces/markers with Pacific in the measured crop. Harness now retains that original image/statistic, resets to world overview and applies the unchanged8% paint gate there. A same-APK full rerun is required; density/cutout/reboot/30min stress on d7 remain pending. Prior efd full native stress passed but does not substitute for this rerun.

Checkpoint APK SHA9b1346892404fb11d51cc4232afe0c8d3165e9944603d10da41fec9e8a3f96c9, 140961717bytes, embedded Hermes10475572bytes, nondebuggable0.8.1(9), landscape, only dedicated Dominion backend and unchanged sideload signing certificate verified. EXPANSION_SAMPLER_APK_VERIFICATION.json / EXPANSION_LONG_D7C3D59.json hold verified artifacts. This is an intermediate binary, not Dominion-grand-strategy-v2-release.apk. No main/backend/production-data changes, no AssetMind access, no province/city reduction, no schema changes. Physical Redmi performance unmeasured.

**Next exact action:** complete same-APK full native rerun on expansion-qa and investigate fixed-world pinch tail using raw stage timings/replicates; preserve all original gates. Persistence continuation concern remains: cold host encode+decode ~619ms and asynchronous file reads may resume synchronous validation during camera movement. Retain corrupt-save refusal/checksums/atomic generations. Do not begin the next major stage until required prior regression checks pass. Then extend existing diplomacy/treaty/CAS/order paths to all18 real actions, gradual missions, transfers/access/consent, reasons/history and AI.

---

# Expansion 2.0 — release remains blocked, 2026-10-10

Runtime `efd1f3d` passes build / 10,000 ticks / full Android touch smoke + 1835.67s stress. Same-APK camera replay 37995443161 **REJECTED**: panel-closed histogram P95 117 -> 200ms; pinch P95 500 -> 400ms does not override the failed scenario or worse raw P99. Verified paired/native/APK hashes, all quantiles and sampled PSS in EXPANSION_NATIVE_EFD1F3D_REVIEW.json; long simulation EXPANSION_LONG_EFD1F3D.json. Current UI-host private-counter revision needs fresh native acceptance. No physical Redmi FPS, no completed Expansion 2.0, no final v2 APK claimed. Stages 3–11 remain fully authorized and pending.

---

# Dominion Expansion 2.0 — release NOT READY

Stages 0–2 checkpoint only; stages 3–11 remain scoped in EXPANSION_SCOPE.md. Existing main/runtime release below is historical. Main remains `dbb354ab038713c3e54b969b34a6fc88bf2de11f`; expansion work is isolated on `expansion-v2` in the same repository.

First checkpoint run `37985852569` built a non-debuggable standalone release and passed 181 JS / strict TS / 10 Python / 10,000 ticks with ten exact restores. Its APK was downloaded, CRC/SHA/bundle/production-endpoint checked; metadata and retained certificate are recorded in EXPANSION_STAGE12_APK_VERIFICATION.json. Nevertheless, the paired native pinch gate FAILED (550 → 700ms full-histogram P95), and full native smoke is incomplete. Therefore that binary is REJECTED for delivery, regardless of successful packaging. No Expansion 2.0 APK has been published or delivered.

Next revision requires a fresh build, unchanged performance gates, real army/order/deselect/Back/foreign-flag UX and complete native soak before stage 3. Final version/name **Dominion-grand-strategy-v2-release.apk** will be assigned only after all requested systems, migrations, authority and integration gates are complete. No physical Redmi FPS is claimed.

---

# Dominion 0.8.1 (9) — verified standalone camera and illustrated release

Only `elcin31/grand-strategy-multiplayer` and its existing dedicated backend. Tested source/main commit `47b0db4f8b220e9ea89998afaac035239b64f5e0`; final workflow **37971350100**. Recovery checkpoint `0a23da0`, illustration integration `6c292db`, release/QA `47b0db4` are separate logical commits. The saved camera implementation `61b77f4` and all earlier optimization/game systems were continued rather than replaced.

- Final APK: **Dominion-camera-optimized-illustrated.apk**, **140,949,889 bytes**.
- APK SHA256: `7d27c4f7c3e5e6a9ad14549e435559baad960d48d3b84bab9cc264b30436b060`.
- Release artifact **11636503809**, outer ZIP **60,873,762 bytes**, SHA256 `ab7b0524ac9d53ffddee288fac2b9f3b548c848dcae3431b00acee30c50025fb`.
- Outer ZIP and APK CRC/SHA checked; complete APK extracted, exact CI hash matched. Independent binary AXML review confirms non-debuggable application, package `com.elcin31.grandstrategymultiplayer`, version **0.8.1 (9)**, landscape, min24/target36.
- Embedded **10,463,744-byte Hermes bundle**, bytecode magic and existing dedicated production endpoint verified. Hermes/Skia present in arm64-v8a, armeabi-v7a, x86, x86_64; all 15 source WebP hashes found in packaged resources. No Metro/USB/computer/Expo development server dependency. Actual native installation/offline launch is a required release gate.
- CI apksigner V2 PASS with retained sideload certificate SHA256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; exact APK SHA matches local review. Its historical certificate name is Android Debug; the APK application is non-debuggable assembleRelease. Existing update compatibility retained, no Play Store signing claim.

Binary evidence: `RELEASE_CAMERA_081_INTEGRITY.txt`, `RELEASE_CAMERA_081_LOCAL_VERIFICATION.json`. The chat ZIP fallback is the verified outer release artifact and contains the exact APK plus small integrity/benchmark files; the permanent GitHub release separately packages an APK-only ZIP.

Completed source/build gates: strict TS, **175 JS / 10 Python**, map/world/host camera/visual benchmarks, 15 optimized original-art checks. Final **10,000 ticks / ten exact restores** PASS; 9,157 battles / 10,906 peace settlements, unchanged 195 countries / 2,924 provinces / 5,411 cities / modern-world-v2 / schema12. Raw final simulation: `LONG_SIMULATION_CAMERA_081_RESULTS.json`; unchanged backend/gameplay/transport/save diffs checked. No backend deployment, migration or production-room changes in this camera/illustration pass.

Final paired camera job **113966823910 PASS**, evidence **11638014235**; actual maps/PNG/frame/thread/PSS/logs reviewed. Medium-pan histogram p95 **500 → 150ms**, world **800 → 117ms**, pinch **600 → 350ms** on the same software emulator. All final scenarios/raw-ring limits and higher pinch JS-thread CPU are reported in PERFORMANCE_REPORT.md; no achieved Redmi FPS or completely eliminated camera lag claim.

Original painting reuse completes commander choices/assigned portraits, real technology branches and the open war panel. All ruler/religion/government/building/army/economy/diplomacy/menu/campaign/loading integrations retained; **15 WebPs / 2,188,634 bytes**, lazy active-panel mounting outside map Canvas. No duplicate art generation or added compressed image bytes.

Final native job **113966823944 PASS**, artifact **11639851749** (28,964,864 bytes, SHA256 `aa2888c401af7f1556a2dba4418030b607aa2137c3643d4f5a3dbd7ca27605a3`) downloaded/CRC/hash checked. Actual commander assignment/painted portrait, university and technology branch images/research, ruler/religion/government/construction/menu/diplomacy/map/layout PNGs independently reviewed. Standalone network-disabled launch, first Singleplayer/Start tap, gameplay commands, four presets/twelve modes/five layouts, density/cutout, detached benchmark and save/process/reboot recovery PASS. Continuous native soak **1,867.83 seconds**, **31 PSS samples / 441,449–525,094 KiB**, zero matched fatal JS/native / ANR / OOM logs. Samples are not continuous memory peaks or proof of universal leak absence. Review: `NATIVE_CAMERA_081_SMOKE_REVIEW.json`. Full distant-target click-to-move combat and a fresh live two-player session are not independently automated by this native harness; shared command/path/combat/authority regressions, the long simulation and inherited accepted unchanged-backend live QA retain that coverage.

Workflow **37971350100 concluded SUCCESS**: build `113958490313`, long simulation `113958490336`, paired camera `113966823910`, native smoke `113966823944`, publication `113985697002`. Published tag **v0.8.1-camera-illustrated** targets tested runtime `47b0db4`; publication independently downloads the public APK without authentication and compares its bytes with the built binary. Public APK size/digest match the verified local APK. Release: https://github.com/elcin31/grand-strategy-multiplayer/releases/tag/v0.8.1-camera-illustrated . Metadata: `RELEASE_CAMERA_081_PUBLICATION.json`.

Both final files are successfully saved for direct chat attachment:

- `/workspace/scratch/5dfbb8019a0d/Dominion-camera-optimized-illustrated.apk` — 140,949,889 bytes, SHA256 `7d27c4f7c3e5e6a9ad14549e435559baad960d48d3b84bab9cc264b30436b060`.
- `/workspace/scratch/5dfbb8019a0d/Dominion-camera-optimized-illustrated.zip` — verified outer build artifact, 60,873,762 bytes, SHA256 `ab7b0524ac9d53ffddee288fac2b9f3b548c848dcae3431b00acee30c50025fb`; CRC checked, includes the exact APK plus small integrity/benchmark files. Extract/open the APK as the alternative to the direct APK download.

Permanent public APK: https://github.com/elcin31/grand-strategy-multiplayer/releases/download/v0.8.1-camera-illustrated/Dominion-camera-optimized-illustrated.apk . The separate public **APK-only ZIP** is https://github.com/elcin31/grand-strategy-multiplayer/releases/download/v0.8.1-camera-illustrated/Dominion-camera-optimized-illustrated.zip — **59,516,745 bytes**, GitHub digest `7fdb490f19ef0de42e3c83800b6f4fb4bc721fad5de36dcd62bb4ec7c7e930fb`. Its size/digest are release metadata; local CRC review applies to the chat artifact ZIP. These ZIPs contain the same APK but different additional files/compression and must not be compared as identical ZIP bytes. User-side download/installation acceptance remains unverified.

Physical Redmi Note12 acceptance stays OPEN: install this exact APK, compare Balanced pan/rapid pan/pinch/world/local/modes and inspect panels. No game-rule or backend rewrite for frame rate. The final chat response delivers both saved files; next work depends on the user's device result.

---

# Dominion 0.8.0 (8) — archived accepted intermediate release

Candidate runtime `61b77f4f4eb03fa01b710c9d34ee306a5359012d`, release workflow `37962664267`. Required standalone release name: `Dominion-camera-fix-illustrated-release.apk`. No Metro/Expo dev server dependency. Main recovery source `0ea39eca80dac8d68d379968f3a7275b874b56ae`; prior comparison APK source `c758ed78f586268809a2184a064ae7fdadc5156e`.

Camera/rendering changes: retained transferable map rasters, cached native paths/border chunks, conservative pre-render coverage/culling, prepared pinch detail, stable selection delegate, label and army budgets/stacking, separate dynamic overlays. Original ruler/building/government/religion cards and additional loading painting; full existing army/economy/diplomacy/campaign/menu illustrations retained. GameState/schema/world/server/transport/gameplay unchanged.

Historical acceptance completed: all five jobs in workflow **37962664267** passed, including native smoke/soak and publication. Verified intermediate APK 140,948,773 bytes, SHA256 `097601520271591ef123cd708c2536c3927c70eae6906c8fe087bc31c90c47ee`, embedded Hermes 10,462,624 bytes, non-debuggable 0.8.0(8). Historical evidence: `RELEASE_CAMERA_080_INTEGRITY.txt`, `NATIVE_CAMERA_080_SMOKE_REVIEW.json`, `CAMERA_NATIVE_PAIRED_080.json`. Final delivery is 0.8.1 above, not this intermediate APK.

Required gates: TS, 175 JS, 10 Python, map/world/host camera/visual checks, 15 exact WebP checks, 10,000 ticks and ten exact restores, native API35 smoke/paint/pan/pinch/modes/presets/layout/save/reboot/art checks and 30-minute soak. Final paired native camera quantiles and actual PNGs must be reviewed. Failed intermediate releases are excluded.

Binary checks must inspect embedded Hermes JS, all ABI Hermes/Skia, non-debuggable packaged manifest, version 0.8.0(8), landscape, existing dedicated production endpoint and verified retained sideload certificate. Hash/CRC/public byte identity and direct chat attachment follow successful CI completion. The existing certificate may be named Android Debug; this refers to the retained signing key, not a debuggable or development build.

No achieved FPS or completely fixed Redmi lag claim. User retest: install, main menu, singleplayer, pan/navigation, zoom in/out, compare smoothness, then inspect ruler/religion/government/economy/army/construction art and report the change. Stop after delivery.

---

# Dominion visual update 0.7.0 (7) — verified standalone release

Alternative Android download: **https://github.com/elcin31/grand-strategy-multiplayer/releases/download/v0.7.0-visual-update/Dominion-visual-update-release.zip**, ZIP **58,446,169 bytes**, SHA256 e0f3aaa79f4a4b0e67126369520b4523766654de7aed12622a8f1dad1bb8e694. Publisher run 37935645382/job 113836879926 PASS: public unauthenticated ZIP download/CRC verified; enclosed 140,113,723-byte APK remains exactly SHA256 d90a8aca6993de2d69db42e75eb2791bc7f50c1efd3425028c5ee0a1e1205a1f. User reports direct APK transfer stuck at 100%; root cause not diagnosed. Offer ZIP extraction/opening APK, then collect exact browser/installer error if failure persists. No game/runtime/backend/signature change or rebuild.

Accepted runtime **c758ed78f586268809a2184a064ae7fdadc5156e**. Final Android workflow **37918487336 all PASS**: build-apk, long-simulation, android-smoke. Subsequent commits change reports/evidence only. Only elcin31/grand-strategy-multiplayer and its existing dedicated backend dfjsnjxnyjspwugjguhq used; AssetMind untouched.

- File: **Dominion-visual-update-release.apk**, **140,113,723 bytes**.
- APK SHA-256: `d90a8aca6993de2d69db42e75eb2791bc7f50c1efd3425028c5ee0a1e1205a1f`.
- Release artifact **11611437585**, ZIP SHA-256 `40fa1ddebd7164e2786cce1deee978b7897d2cf73e9a8caad14dca275ab11396`.
- Actual artifact downloaded/extracted and CRC/hash checked. Embedded Hermes JS **10,447,040 bytes**, all four ABI Hermes/Skia libraries and all nine WebP hashes independently verified.
- Non-debuggable assembleRelease, package com.elcin31.grandstrategymultiplayer, **0.7.0 (7)**, min API24/target36, landscape, embedded production backend. No Metro/Expo development server required. Valid V2 signature and existing sideload certificate retained; not Play Store production signing. Binary evidence: RELEASE_VISUAL_INTEGRITY.txt.

Implemented: full lightweight landscape main menu; six original historical paintings/nine optimized WebPs; unified tokens/compact panels/heraldry/vector portraits; softer political colours/coasts/labels/capitals/shield army counters; safe-area feedback, latched launch, deferred world/codec and metadata-only save listing. Existing Skia/worklet camera, terrain, server authority and gameplay retained.

Cities **7,214→5,411 (-24.993%)**, exact round(count×0.75). All 195 countries/2,924 provinces/195 capitals/2,225 regional centers retained, exact population conserved. Schema12 migration preserves surviving IDs, ownership, population/development/growth carry and provincial links. Native old bytes retained as .before-city-v12.backup; no user saves deleted. Existing older v1-topology restriction unchanged. Backend gzip persistence stores full JSON before normalization.

Strict TypeScript, **167 JS / 3 Python** tests and world/map/art checks PASS locally and final build CI. Final **10,000 ticks/10 exact save restores**, 10,906 peace settlements, 9,157 battles, max 3,406 armies/max 4,082,061-byte snapshot; tick p95 75.17ms, elapsed 592s on CI. Long evidence11610974406; LONG_SIMULATION_VISUAL_RESULTS.json. Paired host metrics and native limitations: PERFORMANCE_REPORT.md.

Existing backend game-room **v21** / game-command **v23** deployed together; custom authentication/server authority unchanged. All 29 existing rooms have byte-exact additive pre-v12 JSON/compressed backups. Live backend QA **37911320238 PASS**: malformed/oversize/auth/capacity/idempotency/CAS guards, movement/cancellation, buildings/research/units/diplomacy, reconnect/host migration/server clock/AI recovery. Exact guarded QA room d224a5eb-3715-4c77-9657-98bb6028ca8d removed; zero related room/membership/receipt rows; original 29 backups remain. Locally blocked HTTP attempt is not counted as pass.

Native API35 job **113787009485 PASS**, evidence **11613239385**. Exactly one Singleplayer tap and one Start tap; disabled Continue without save, menu/pages/Back, visible launch feedback, real campaign commands, four presets/twelve map modes, pan/double-tap, five layouts, density/cutout, process/reboot recovery and detached 12-tick benchmark pass. Actual final menu/new-campaign/loading/map/economy/diplomacy/government/dense screenshots reviewed. Native assertions enforce full painting coverage and un-clipped statistics. Continuous render/simulation/autosave soak **1,836.65 seconds**, no fatal JS/native logs.

Software SwiftShader gfxinfo p50/p95/p99 **105/200/400ms**, **84.37% jank**. Thirty PSS samples **593,072–981,108 KiB**, first 700,306, last 631,847. Activity TotalTime **1647/674/1835ms** measures Android activity launch, not full menu readiness or touch latency. These are software-emulator observations, not physical FPS, peak memory or a leak-free guarantee. Redmi Note 12 frame pacing/FPS, pinch/touch latency, thermal and battery acceptance remain unmeasured. Native smoke does not independently automate full distant-target combat or two-finger pinch; reducer/live HTTP regressions cover route/combat/authority and existing camera worklets remain unchanged.

Delivery: permanent public APK **https://github.com/elcin31/grand-strategy-multiplayer/releases/download/v0.7.0-visual-update/Dominion-visual-update-release.apk**. Release v0.7.0-visual-update; publisher run 37929726099/job 113817204085 PASS. Public unauthenticated download rechecked against exact accepted SHA-256 and 140,113,723-byte size; no rebuild. Earlier ChatGPT download URL failed with a cross-site restriction and is superseded by this public URL. Target 30 FPS low-end/45–60 mid-range/60 high-end are goals, not achieved Redmi claims. Earlier visual APKs/runs are superseded.

---

# Dominion 0.6.0 (6) — optimized v4 verified release

Runtime source **a9df2395800d4ec09fdac25fea4cd35975221893**, tree 97e965007cd38ebc94769363f0f48e0fc85f14d7. Release run **37725176471**: build-apk, long-simulation and android-smoke all PASS. Later commits change only QA scripts/workflows and reports, not the APK runtime.

- File: **Dominion-optimized-v4-release.apk**, 138,882,758 bytes.
- APK SHA-256: `d727ab8bc136a18d65b3f9f2fa8f57c72a2aa9888cd3a94d73728dd3557ffcce`.
- Release artifact **11527528153**, ZIP SHA-256 `4766899edd20e8885a9bb3adc952c5754607de899900f9530520e69e411021eb`.
- Embedded Hermes JS bundle: **10,589,176 bytes**; Hermes/Skia in all four ABIs verified locally. CI verifies non-debuggable release manifest, version 0.6.0 (6), landscape, production endpoint and valid V2 signature. Existing sideload signing certificate retained (certificate is named Android Debug; build itself is non-debuggable release).
- 161 JavaScript regressions, strict TypeScript, Python suite, map/world benchmarks PASS. 10,000 deterministic authoritative ticks, 10 exact save restores; p95 tick 57.29ms on CI, elapsed 452s; maximum 3,406 armies and 4,492,903-byte snapshot. Raw v4 evidence: LONG_SIMULATION_PASS3.md; historical LONG_SIMULATION_RESULTS.json is v3.
- Actual gameplay graph **4,386 → 2,924 provinces**, all **195 countries / 7,214 cities** retained. New topology is modern-world-v2/schema 11. Old v1 campaigns are retained but require v3 to open; start a new campaign in v4. No silent contested-save migration.

Dedicated backend **dfjsnjxnyjspwugjguhq**: game-room v20 and game-command v22 deployed from accepted runtime. Live QA **37725884194**, final job **113144676872**, PASS: eight players, ninth rejected, authorization/spoof guards, idempotency/CAS, persisted multi-step army order and cancellation, forged client route rejected, construction/research, diplomacy, reconnect, host migration and server clock. First local attempt timed out establishing the proxy connection; first CI attempt timed out waiting for concurrent heartbeat responses. The unchanged repeat passed. All three isolated QA rooms removed with exact UUID plus WORLD ECONOMY QA membership guards; remaining rooms/players/receipts all zero. No user campaigns changed.

Native job **113144846787** PASS; evidence **11529720645**, ZIP SHA-256 `22e134dad9e51b94918276168250e08cf0a54e84d0544aa7055a852584257d03`. Exactly one Singleplayer tap and one Start tap, offline cold launch, actual queued Farm construction, campaign commands, four presets/twelve map modes, camera/layout checks, process/reboot recovery and built-in 12-tick benchmark PASS. Real combat at a distant ordered enemy target is covered by authoritative reducer regression; live HTTP verifies persisted route/security/cancellation. Native smoke does not independently automate the full distant-target combat gesture.

Continuous render/simulation/autosave stress lasted **1,846.65 seconds** with no fatal JS/native logs. Thirty PSS samples: **538,434–811,674 KiB**, first 770,905, last 604,538; no monotonic increase in this window. SwiftShader cumulative gfxinfo p50/p95/p99: **150/250/350ms**, **92.69% jank**. The overlay's sampled UI callback cadence of 60 FPS is NOT completed GPU FPS; these graphics results do not pass a physical smoothness target. Redmi Note 12 FPS, frame pacing, thermal and battery acceptance remain unverified until the user tests Balanced. Startup trace is instrumented; two animation-frame callbacks allow feedback to commit but are not a direct GPU paint measurement.

Delivery: attach the exact verified APK above. User check: Balanced, single first tap/launch time, pan/zoom, own army → distant target/movement/battle, construction, Improve Relations, benchmark report.

---

# Dominion 0.5.0 (5) — optimized v3 verified release

Runtime source: 416b0b70374ffc2f9eb84e238213bc389f19782f, branch performance-pass-2.
Release workflow 37576520835: all three jobs PASS. Final native job 112740679221 passed on repeat; native artifact 11478246984 (ZIP SHA-256 e73a426f0150638a8bf93247da0299dc8a39765778f53ee2ade954fbb003b356). The first attempt lost the emulator connection (`adb: device offline`) and is not counted as a pass. The repeat tested the unchanged APK from source 416b0b7.

- File: Dominion-optimized-v3-release.apk.
- Artifact 11463536915; ZIP SHA-256 ffa413bb60c6e5aaecf0729fc2f3aa497b3e34748cd4b58deb744128d690353f.
- APK: 139,684,422 bytes; SHA-256 b40976297cf5ad91cde6ec0ae761b3d56596fd53f06090ac393fb71d5f6d55ab.
- Embedded JS: 11,390,840 bytes; all four ABI Hermes/Skia libraries verified locally by scripts/verify-apk.py.
- CI binary gate: non-debuggable release, version 0.5.0 (5), landscape, valid v2 signature, dedicated production endpoint dfjsnjxnyjspwugjguhq.supabase.co. Existing signing certificate retained for sideload updates.
- Local/CI regressions: 156 JS tests; strict TypeScript; 3 Python tests; map/world benchmarks.
- Full simulation: 10,000 ticks, 10 save/restore equality checks, 9,744 peace settlements, 9,480 battles, max 2,317 armies. Seeded gameplay totals equal the earlier preserved long-run baseline. Final report in LONG_SIMULATION_RESULTS.json.
- Host tick p95 151.53ms; elapsed 1,178 seconds. Observed checkpoint heap 45.8–58.1MB and RSS 394.7–462.3MB. These are software-host measurements, not Android FPS, native peak memory, battery or thermal tests.
- Gameplay graph remains 4,386 provinces / 7,214 cities / 195 countries. Render-only LOD reduces world silhouettes to 195; no campaign data migration or save-size reduction is claimed.

Dedicated production backend QA: run 37607813987 PASS (eight players, auth/spoof/input guards, idempotency/CAS, economy, diplomacy, save/reconnect and host recovery). Exact isolated room 6256f243-4506-4504-90af-eeae26412ef2 removed with a WORLD ECONOMY QA membership guard; room/player/receipt counts verified zero. No user rooms touched.

- Native acceptance: exactly one singleplayer tap and one Start tap; all four presets/twelve modes, camera inputs, commands, five layouts, offline process/reboot recovery and detached 12-tick benchmark PASS. Continuous render/simulation/autosave stress: 1,847.95 seconds; reached campaign tick 1,473; no fatal JS/native logs.
- Thirty emulator PSS samples: 579,918–849,556 KiB; first 739,331, last 676,190. No monotonic growth in this window; not proof of absence of all leaks or physical peak RAM.
- Software SwiftShader emulator remained slow: final cumulative gfxinfo p50/p95/p99 150/300/450ms and 92.92% janky frames; benchmark overlay sampled UI 8 FPS / 122.2ms. These are recorded limitations, not Redmi or GPU FPS and not a claim of smooth frame pacing. Physical Balanced acceptance remains pending user testing.

Native screenshots confirm launch controls are fully visible outside scrollable content; logs contain exactly one singleplayer tap and one Start tap before entering the running campaign.

---

# Dominion 0.4.0 (4) — optimized release report

## Build

- Repository: elcin31/grand-strategy-multiplayer.
- Source commit: **859747dc80832adf3d66ade62a4b69854bd97d3c**. The commits after the performance runtime changes only harden the Android smoke harness; the APK was built by the final workflow from this exact HEAD.
- Workflow: **Android optimized release**, run **37564792672**, all three jobs PASS: build-apk, long-simulation, android-smoke.
- Artifact: **dominion-optimized-release**, ID **11458334028**. Extracted APK: **138,651,290 bytes**.
- APK SHA-256: `cd1bd79edf4a5083b13b5ed970ab53876336457382c2604146969153def4c288`.
- Android package: com.elcin31.grandstrategymultiplayer; versionName **0.4.0**, versionCode **4**; min API 24; target/compile API 36; landscape; arm64-v8a / armeabi-v7a / x86 / x86_64.
- Gradle **assembleRelease**. Embedded `assets/index.android.bundle`: **10,357,708 bytes**; Hermes and Skia verified. Production multiplayer backend is embedded. V2 APK signature verified.
- Signing remains the existing Android test certificate for sideload compatibility. This is a self-contained release variant, not Play Store production signing.

## Final validation

- Strict TypeScript: PASS.
- JavaScript regression suite: **149/149 PASS**.
- Python suite: PASS.
- Map geometry benchmark: query p95 **0.027 ms**.
- Full-world build benchmark: tick p95 **152.24 ms**.
- Full-world long simulation: **10,000 authoritative ticks PASS**, **10 exact atomic save/restore cycles**, 195 countries / 4,386 provinces / 7,214 cities. Final run tick p95 **217.92 ms**, total **1,700 s**, maximum snapshot **4,903,485 bytes**, maximum armies **2,317**, 9,744 peace settlements and 9,480 battles.
- Native API 35 smoke: PASS with network disabled and no Metro dependency. Covered cold launch, landscape, real campaign flow/commands, population progression, four graphics presets, all twelve map modes, camera, five layouts, density/cutout, process restart, persisted paused campaign, emulator reboot, Back/exit handling and fatal-log checks.
- Built-in performance benchmark: **12 detached simulation ticks PASS**; benchmark does not mutate the active campaign.
- Continuous software render/simulation/autosave soak: **1,200 seconds PASS** with no fatal JS/native crash.
- Android smoke evidence artifact: **11460625490**. Long-simulation evidence artifact: **11459875290**.
- The artifact ZIP was downloaded and extracted after the green run; APK SHA-256 matched the CI integrity report and the embedded JS bundle was independently confirmed in the archive.

## Performance limitation

This release completes the code-level optimization, regression, emulator/native validation and standalone APK delivery. It does **not** prove a specific FPS, thermal or battery result on the physical Redmi Note 12 or any other handset. Physical-device acceptance remains a separate empirical check using this APK.

---

# Dominion 0.3.0 (3) — release report

## Build

- Repository: elcin31/grand-strategy-multiplayer.
- Source commit: **49ce9e90c3155e4b76dae9f57371d9bda04d1049**. Later report-only commits do not change this APK.
- Workflow: **Android final release**, run **37410899043**, all three jobs PASS (10,000-tick gate, build-apk, android-smoke).
- Artifact: **dominion-final-release**, ID **11390416081**. Extracted file: **Dominion-final-release.apk**, **138,622,502 bytes**.
- APK SHA-256: `9a744de9c7c87861a93e18bdabfd38c10cc37ca4020b98b1450e1c6dde104b6c`.
- Android package: com.elcin31.grandstrategymultiplayer; versionName 0.3.0, versionCode 3; minimum API 24 (Android 7), target/compile API 36. Emulator acceptance: API 35.
- Gradle **assembleRelease**, non-debuggable packaged manifest, landscape; four native ABIs. Embedded `assets/index.android.bundle`: **10,328,920 bytes**; native Hermes and Skia verified.
- Production multiplayer endpoint: **dfjsnjxnyjspwugjguhq.supabase.co**. No server secrets on client.
- Signing: existing Expo Android test certificate retained for sideload update compatibility. This is a release variant with embedded JS, **not a Play Store signing configuration**. Certificate details and binary verification are in RELEASE_INTEGRITY.txt.

## Validation actually performed

- Strict TypeScript: PASS. JavaScript: **134/134 PASS**. Python: **3/3 PASS** with pinned world-import dependency. All also passed in build CI.
- Fuzz/security: existing 5,000 malformed-payload run and long paused-order regressions retained; added 240 modern-world intents plus 240 authority-spoof attempts with invariants. Streamed 32 KiB HTTP boundary, invalid root/token/UUID/enum/amount/extra-state fields covered.
- Chaos: six critical intent kinds survive lost response/restart/replay without double application. Six competing reducer/CAS scenarios cover recruitment, shared target, mutual attack, move/combat, diplomacy/war and competing peace. These are controlled fault/CAS tests, not an internet packet-loss experiment.
- Dedicated PostgreSQL rollback-only checks: receipt atomicity, duplicate payload collision, stale writer, rate limit, expiry and client RPC privilege denial PASS.
- Live backend run **37410899062 PASS**: ten malformed HTTP requests; eight players/ninth rejection; invalid token and player spoof; duplicate/stale/concurrent recruitment; persisted building/research; human treaty consent; snapshot recovery; host timeout, AI replacement and human return. Exact QA room removed with original-host guard; zero room/membership rows remain.
- **10,000 authoritative ticks PASS**, full world (195 countries, 4,386 provinces, 7,214 cities), invariants every 50 ticks, **10 exact atomic save/restore cycles**. Real AI decisions: 9,744 peace settlements, 9,480 battles; maximum 2,317 armies; snapshot maximum 4,903,485 bytes; only two countries experienced bankruptcy. See LONG_SIMULATION_RESULTS.json.
- Longest war (5,865 ticks) is Mexico versus the deliberately idle human USA. Diagnostic continuation through tick 7,000 confirmed Mexico offered WhitePeace and was waiting for human consent; AI-only wars observed in that continuation lasted at most 11 ticks. Human peace acceptance is not automated.
- APK downloaded, ZIP digest checked against GitHub artifact metadata, extracted binary digest matched CI, archive integrity and native libraries/bundle rechecked locally. Signature, non-debuggable manifest, version, orientation and production backend passed the CI binary gate.
- Installed APK ran with network disabled and no Metro/Expo development server. Native smoke exercised real campaign commands, twelve map modes, four graphics presets, camera, five landscape layouts, phone density/cutout, saved paused tick after recreation, process kill/relaunch and **emulator reboot**; Back/exit behavior and fatal-log checks PASS. Evidence artifact **11390881738**.

## Performance evidence and known limits

PERFORMANCE_REPORT.md contains measured CPU improvements. CI long-run tick p95: 154.14ms; 1,203 seconds total. Sampled post-GC heap 45.5–57.0 MB; RSS 395–444 MB. This is bounded observed growth, not a universal leak-proof claim.

Native emulator cold activity launch times: 1,251 / 521 / 1,144ms (activity launch, not full-world readiness). PSS before/after reboot: 381,395 / 283,822 KiB. Software-rendered emulator camera sample reports 25 janky frames of 31 (80.65%); it does **not** demonstrate the physical-device 60/30 FPS targets. Physical FPS, thermal and battery testing were not performed.

No known unresolved BLOCKER/CRITICAL/HIGH from completed checks. Remaining MEDIUM/LOW issues/limits: pre-tribute budget display, no allied-land transit, poll-driven all-offline campaign dormancy, lifetime command-receipt retention, same-installation credential recovery, procedural terrain/resources, narrow-card text clipping, test signing certificate and physical performance unverified. See BUG_REPORT.md. No new gameplay systems were introduced.
