# Expansion continuation — 2026-10-10 checkpoint

Main remains `dbb354ab038713c3e54b969b34a6fc88bf2de11f`. Actual tested runtime `efd1f3d4b63d737001ab6301b65bd151609b76af`, build/long/native run **37991163050**. Source audit and full authorized scope stay in RECOVERY_AUDIT_EXPANSION_2026-10-09.md / EXPANSION_SCOPE.md. Only this repository and existing Dominion backend; no deployment/data writes, schema12/world/design/geometry and previous caches retained.

- **Stage 0 DONE.** Recovered exact main, recent commits, engine/UI/server/save/release architecture and baseline.
- **Stage 1 PARTIAL / gate REJECTED.** Original runtime passed 182 JS / strict TS / 10 Python / production Hermes export, fresh 10,000 ticks + ten exact restores. Original paired camera capture ended on auxiliary UIAutomator exit137, hence incomplete. Same-APK replay **37995443161** / harness `037b44e` retained all nine scenarios and failed the real panel-closed P95 gate: histogram **117 -> 200ms**. Pinch histogram **500 -> 400ms**, raw P95 **516.80 -> 409.92ms**, but raw P99 **881.22 -> 1051.44ms**; no claim of complete microstutter elimination. Every comparison uses one paired run, not cross-run baselines. Complete compact review/artifact hashes in EXPANSION_NATIVE_EFD1F3D_REVIEW.json.
- **Stage 2 implemented / native touch checks PASS.** Full job **114032296159 SUCCESS**: actual marker repeat tap deselects while retaining order; Back retains order; foreign flag opens diplomacy and clears capture; reselect and separate movement cancel work. Original authoritative/order/save/actor regression tests pass. Native simulator runs **1835.67s** render/simulation/autosave stress; 31 PSS samples **449,209–513,689 KiB** (sampled memory, not continuous peaks), no matched fatal logs. These are emulator observations, not physical Redmi performance or new Diplomacy 2.0 acceptance.
- **Stages 3–11 NOT STARTED / full scope retained.** No expansion authoritative fields, migration, espionage, focus or 19 new paintings yet. No final v2 APK exists. The 0.8.1 checkpoint binary is standalone and verified but performance-rejected, so not delivered as v2.

**Current source revision:** replace per-frame reactive telemetry/deadline counters with one Worklets UI-host Shareable, mutable only on the UI runtime; ordinary fixed histogram is sampled/copied once per second to JS. Web keeps local single-runtime state. Map transform/gesture/paint and accepted selection implementation retained. This removes reactive dirty flags/listeners/serialization from private counters; it is a source-level cost reduction, not proven explanation of every native stall. Native measurement required before acceptance. Official Worklets Shareable docs and installed 0.10 implementation checked; no dependency upgrade.

**Next exact action:** build and review new sampler runtime against the same 0.8.1 APK on one emulator; unchanged 10% pinch / 20% other moving-scenario P95 gates, actual paint/army taps/Back/saves, fresh TS/JS/Python/10k/Hermes checks. Fix any remaining regression before Stage 3. Then extend existing diplomatic reducer/treaty/CAS paths to all 18 actions, missions, real transfers, access, proposals, reasons/history and AI. Do not shorten EXPANSION_SCOPE.md. Physical Redmi P50/P95/P99 remains unmeasured.

---

# Dominion Expansion 2.0 — active continuation, stages 0–2 checkpoint

User reopened the gameplay roadmap on 2026-10-09. This section supersedes older stop instructions below. Baseline main `dbb354ab038713c3e54b969b34a6fc88bf2de11f`; previous release/runtime `47b0db4` / 0.8.1. Work branch `expansion-v2`, created from that exact main. Resolve latest checkpoint SHA from git log; current main remains the accepted prior release until the expansion passes its release gates.

- **Stage 0 DONE:** RECOVERY_AUDIT_EXPANSION_2026-10-09.md contains actual system statuses and missing functionality. EXPANSION_SCOPE.md preserves the complete authorized roadmap. TS / original 175 JS tests PASS. Official Paradox guide/announcement and the AoH3 developer's Steam page reviewed; the latter succeeded after retry. Backend/world/schema/signature unchanged.
- **Stage 1 PARTIAL, implementation and host regressions PASS:** phase-preserving camera deadline, fixed bounded UI callback histogram P50/P95/P99, gesture activity pairing, quiet-camera autosave and bounded 1.5s deferral of local ticks. Manual/background save remains immediate. Existing renderer/rasters/caches/geometry/LOD retained. EXPANSION_FRAME_PACING.json contains exact synthetic old/new 60/90/120Hz callback replay; 90Hz/60 target changed 45→60 camera updates per second. This is algorithm behavior, **not physical FPS**. New native comparison/gesture worklets require CI verification. Autosave still has synchronous encode/validation; now scheduled outside active gestures, not claimed fully parallel.
- **Stage 2 PARTIAL, implementation and host regressions PASS:** marker priority before orders, repeated own-army tap deselects, separate Cancel Movement, foreign visible flag/country-label tap wins over selected army, targeted diplomacy panel, empty-map clear, Back priority clears army selection, internal army-list selection unified with campaign selection. Exact glyph/hit layout shares painted/culling/label budgets; bounded licensed offline flags, revised to cached CPU rasters after the rejected benchmark. Selected-army disappearance clears stale UI. Full native touch scenario still pending.
- **Stages 3–11 NOT STARTED in expansion:** inherited partial diplomacy/economy/military/technology are not counted as completed Expansion 2.0. Espionage/focus systems absent; 19 new artworks not generated. No new authoritative fields or schema migration yet.

First candidate passed strict TS + **181/181 JS**, fresh **10/10 Python** with pinned Shapely, production Metro/Hermes export and focused 17 selection/order/camera/pacing/layout regressions. Added tests use actual map-intent/back/glyph functions and real server reducer/save codec, including active order preservation and authority failure. Fresh **10,000 ticks / ten exact restores PASS** in job 114007528528; verified artifact 11644210655, EXPANSION_STAGE12_LONG_SIMULATION.json. Counts match unchanged authoritative rules: 9,157 battles / 10,906 peace settlements, 799s, host tick p95 100.85ms (not Android latency). These are stability regressions, not acceptance of future expansion balance. Native checkpoint **37985852569**, runtime **056a5b2d0c23276e31d407d21b371ec19436d52a**, finished FAILURE against accepted **0.8.1 run 37971350100**; native rejection is detailed below. Branch builds do not publish a final release.

**Exact next action:** run/review expansion-v2 checkpoint build, fresh Python/10k simulation, actual native selection/gesture/paint checks and same-emulator 0.8.1 comparison. Correct any regression before Stage 3. Then implement Diplomacy 2.0 atop existing treaty/peace/CAS paths with bounded event history, directional diplomatic missions, real gifts, durations/access/trade, consent/AI and strictly validated offers. Preserve topology, previous optimizations and old saves. No final Expansion 2.0 APK exists yet; checkpoint APK is not the final requested Dominion-grand-strategy-v2-release.apk.

Native QA history: original smoke and reuse run 37988156572 stopped on harness caption-height filtering (13px text inside a visible 58px route button), not a proven game failure. Actual XML/PNG reviewed. The harness now taps the clickable route container and refreshes the recruited army row text. Byte-identical APK reuse run **37988897374**, harness commit **eb4dccfd8712bb0ffa62ffeb426a9a8eb182b89d** on `expansion-qa`, finished FAILURE on the cluster-anchor assumption detailed below. Its workflow refuses changed game source and unsuccessful build/10k gates; it cannot reuse the old APK for the new runtime revision.

**Latest gate result: checkpoint 056a5b2 REJECTED.** Paired native camera job 114014785973 failed the unchanged 10% pinch gate: full histogram p95 550→700ms; local pan also regressed. All nine scenarios/threads/caches are preserved in EXPANSION_CAMERA_REJECTED_056a5b2.json. The APK binary is verified in EXPANSION_STAGE12_APK_VERIFICATION.json but must not be delivered as accepted. Reuse run 37988897374 passed real movement and repeated-marker deselection, then stopped because deselection moved the weighted cluster anchor by ~61px, beyond the harness's 50px search; change the test to follow matching army IDs. Remaining native Back/foreign-flag/reselect/cancel/soak checks are unverified.

Revision prepared with **182 JS / strict TS / production Hermes export PASS**: packed scalar histogram (active only for overlay/benchmark), one sample callback per second, bounded CPU flag rasters rather than SVG replay, future-phase deadlines after short stalls, inertia/animation motion gating, corrected native baseline metadata, all moving-scenario p95 gates added without weakening pinch. Source schema/world/authoritative rules unchanged. **Exact next action is build and review this revised candidate, then fix any remaining native performance/interaction failure. Stages 3–11 remain blocked.** Attribute performance causes only after measurement; the revised candidate is not yet accepted.

---

# Dominion camera and illustrations — 0.8.1 release complete (2026-10-09)

Latest tested release/runtime commit: **`47b0db4f8b220e9ea89998afaac035239b64f5e0`**, version **0.8.1 (9)**, workflow **37971350100 SUCCESS**. Latest saved evidence checkpoint: **`213298265ba1175fa1a2742c2004cefc9d8467c0`**; this final report commit is its child, titled `docs: record verified camera and illustrated Android 0.8.1 release [skip ci]` (resolve its SHA from main/git log; report-only changes do not alter the APK). Illustration integration: `6c292db1894f2ccfe8047d62afca191de8478e15`. Recovery checkpoint: `0a23da07cdcb7244c51c53e6e27b9518cbb0b281`; exact recovered runtime: `61b77f4f4eb03fa01b710c9d34ee306a5359012d`; original published main: `0ea39eca80dac8d68d379968f3a7275b874b56ae`. Recovery stash/patch/raw results and local duplicate/checkpoint tags were retained. Final 19-block status table and original recovery point: `RECOVERY_AUDIT_CAMERA_2026-10-09.md`.

Recovery found saved camera/renderer work already integrated; the previous session stopped at native acceptance. Retained transferable raster tiles, native path/border caches, conservative coverage/culling, prepared pinch LOD, stable gestures, batched glyphs and army stacks were inspected and preserved. Real unfinished UI gaps were commander portraits, technologies and open-war art. They now reuse ready original portrait/building/military paintings with stable visual-only commander seeds and lazy active-panel mounting outside map Canvas. No duplicated asset generation or new image bytes, backend/game-rule/save-field changes. World/schema remain **195 countries / 2,924 provinces / 5,411 cities / modern-world-v2 / schema12**; authoritative simulation, selection/orders/pathfinding/combat/economy/construction/diplomacy/AI/save/reconnect/multiplayer are retained. Only this repository/existing backend was used; no backend deployment or production-data writes in this pass.

Final gates PASS: React/native component review, strict TS, **175 JS / 10 Python**, 15-art hashes, map/world/paired-host camera/visual benchmarks, **10,000 ticks / ten exact restores** (9,157 battles; artifact `11638021146`, host tick p95 99.74ms / 798s, not Android latency). All five CI jobs PASS: build `113958490313`, long simulation `113958490336`, paired camera `113966823910`, native smoke `113966823944`, publication `113985697002`. Actual native commander assignment/assigned and free portraits, technology/university/research, ruler/government/religion/construction/menu/diplomacy/map/layout PNGs reviewed. Network-disabled standalone launch/first Start tap, commands, four presets/twelve modes/five layouts, density/cutout, detached benchmark and process/reboot saves PASS. Native soak **1,867.83s**, **31 PSS samples / 441,449–525,094 KiB**, zero matched fatal JS/native / ANR / OOM patterns. Samples do not establish continuous peaks or universal leak absence. Native harness does not independently automate a full distant-target click-to-move battle or a fresh live two-player session; shared path/command/combat/authority/transport regressions, long simulation and inherited unchanged-backend live QA provide that coverage. Review: `NATIVE_CAMERA_081_SMOKE_REVIEW.json`. No introduced unresolved BLOCKER/CRITICAL/HIGH detected by completed gates.

Release artifact **11636503809** downloaded/extracted with CRC/hash checks. Final **Dominion-camera-optimized-illustrated.apk**, **140,949,889 bytes**, SHA256 **`7d27c4f7c3e5e6a9ad14549e435559baad960d48d3b84bab9cc264b30436b060`**. Embedded Hermes **10,463,744 bytes**, binary non-debuggable 0.8.1(9), landscape/min24/target36, dedicated backend, all four ABI Hermes/Skia and exact 15 packaged WebP hashes verified; no Metro/USB/Expo development server required. Retained valid sideload signature. Public release/tag **v0.8.1-camera-illustrated** targets `47b0db4`; publisher unauthenticated public APK download/byte comparison PASS. Release: https://github.com/elcin31/grand-strategy-multiplayer/releases/tag/v0.8.1-camera-illustrated . Both final APK and ZIP are verified and successfully saved at `/workspace/scratch/5dfbb8019a0d/Dominion-camera-optimized-illustrated.apk` and `/workspace/scratch/5dfbb8019a0d/Dominion-camera-optimized-illustrated.zip` for the final chat links. Chat ZIP is the **60,873,762-byte** outer artifact, SHA256 `ab7b0524ac9d53ffddee288fac2b9f3b548c848dcae3431b00acee30c50025fb`; public APK-only ZIP is **59,516,745 bytes**, digest `7fdb490f19ef0de42e3c83800b6f4fb4bc721fad5de36dcd62bb4ec7c7e930fb`. Both contain the exact same APK but differ in extra files/compression. Binary/publication details: `RELEASE_REPORT.md`, `RELEASE_CAMERA_081_LOCAL_VERIFICATION.json`, `RELEASE_CAMERA_081_INTEGRITY.txt`, `RELEASE_CAMERA_081_PUBLICATION.json`. User-side download/installation remains unverified.

Current bottleneck / remaining work: **physical Redmi Note 12 camera validation OPEN; performance block 16 PARTIAL**. Final same-emulator old0.7→new0.8.1 histogram p95: medium pan **500→150ms**, world **800→117ms**, pinch **600→350ms**; raw pinch p95 **624.92→375.47ms**. Software jank still **80.22–92.92%**, pinch JS mean **19.55→21.45%**, final main UI mean **73.73%**. Pinch preparation/settling and real-device frame pacing require physical evidence. Path/cache counters and host coverage/string allocations confirm retained architecture; cold host panel costs also remain reported. No achieved hardware FPS/thermal/battery/smoothness claim. Exact paired/host/long evidence uses `_081` filenames; `_080` and older sections below are historical.

Exact next task: the user installs this delivered **0.8.1** and compares Balanced camera pan/rapid pan/pinch/global/regional/local/mode switching and panels on Redmi Note 12. If severe lag persists, capture that exact device/workload and target the measured pinch preparation/settling or frame pacing; preserve this release/source/evidence. **Do not restart renderer development, regenerate ready art, build another APK or reopen a gameplay roadmap without new evidence.** All code, release and direct-file preparation for this update are complete; the final response attaches the saved APK and ZIP. No CI/build waits remain.

---

# Camera / map pass — archived accepted 0.8.0 checkpoint (2026-10-09)

Runtime candidate `61b77f4f4eb03fa01b710c9d34ee306a5359012d` on camera-fix, release workflow `37962664267`. Recovered main `0ea39eca80dac8d68d379968f3a7275b874b56ae`. Only this Grand Strategy repository/existing backend used; no backend deployment or production-data writes. User authorized the reopened camera symptom, illustration expansion, release build and direct APK delivery; older stop checkpoints below are historical.

Retained native paths/border chunks and transferable raster tiles, coverage-based camera commits, stable gestures, prepared pinch detail, bounded glyph pictures/army stacks. Exact geometry/hits/orders/world/game systems preserved: 195 countries, 2,924 provinces, 5,411 cities, modern-world-v2/schema12. Five original paintings add ruler/building/government/religion cards and port loading art; lazy panel mounting, 15 WebPs / 2,188,634 bytes.

First native candidate's pooled-layout crash and second candidate's transparent-map/pinch regression were caught before publication and fixed. Do not reuse their speed figures as valid acceptance. Release gate requires native map paint plus paired pinch timings, full startup/gameplay/layout/save smoke, 10k ticks and 30-minute native soak.

Local typecheck / 175 JS / 10 Python / art checks PASS. Historical workflow **37962664267 all five jobs PASS**, including native paired comparison, smoke/1,839.26-second soak and publication. Its actual ZIP/APK/images/logs and 30 PSS samples were reviewed; `NATIVE_CAMERA_080_SMOKE_REVIEW.json` preserves that evidence. The final 0.8.1 checkpoint above supersedes this intermediate.

Historical remaining operations were completed for 0.8.0; its checked binary is an intermediate, not the final file for this reopened task. Final 0.8.1 direct delivery and physical next step are recorded above. Do not start another gameplay roadmap. Physical Redmi smoothness remains unverified until the user's retest.

---

# VISUAL UPDATE — CODE, QA AND RELEASE COMPLETE (2026-10-09)

Alternative Android download: **https://github.com/elcin31/grand-strategy-multiplayer/releases/download/v0.7.0-visual-update/Dominion-visual-update-release.zip**, ZIP **58,446,169 bytes**, SHA256 e0f3aaa79f4a4b0e67126369520b4523766654de7aed12622a8f1dad1bb8e694. Publisher run 37935645382/job 113836879926 PASS: public unauthenticated ZIP download/CRC verified; enclosed 140,113,723-byte APK remains exactly SHA256 d90a8aca6993de2d69db42e75eb2791bc7f50c1efd3425028c5ee0a1e1205a1f. User reports direct APK transfer stuck at 100%; root cause not diagnosed. Offer ZIP extraction/opening APK, then collect exact browser/installer error if failure persists. No game/runtime/backend/signature change or rebuild.

Only elcin31/grand-strategy-multiplayer/existing backend dfjsnjxnyjspwugjguhq used; AssetMind untouched. Recovered main 9dc0dec and prior v4 instead of restarting. Logical implementation commits: 16b0520 menu/art/design; dc92084 city migration/render/performance; 7d00b2f release CI; 73b907a native-save awaiting; a36cbbd background/stat fixes; c758ed7 safe-area feedback. Accepted runtime **c758ed78f586268809a2184a064ae7fdadc5156e**, Android run **37918487336 ALL PASS**. Subsequent reports do not alter APK runtime. Final accepted reports/source fast-forwarded to main; visual-update preserved.

Six original paintings/nine WebPs 1,370,604 bytes, complete lazy landscape menu, shared tokens/compact game panels/vector rulers/heraldry, GPU political colours/coasts/labels/capitals/shield army counters. Existing Skia/LOD/batching/worklet camera/terrain/AI schedule/server authority retained. No new mechanics. Credits/design in ASSET_CREDITS.md/VISUAL_DESIGN.md.

7,214→5,411 cities (-24.993%); all 195 capitals/2,225 regional centers/195 countries/2,924 provinces retained. Urban population 2,332,963,370 and province/country population 7,632,252,811 exact. Protected balanced deterministic pruning, same-province migration/stable survivor IDs, schema 12/ownership/development/growth reserve/literal wire city links. Native .before-city-v12.backup byte-exact; no user saves deleted; all 29 original server rooms backed up exactly; existing v1-topology restriction unchanged. Compressed server persistence stores full JSON.

City tiers/indexes/immutable culling, budgets 6/18/42/70, no political gradients in Performance/Balanced, deferred world/codec/menu metadata/latched feedback. Local paired seed 101/100 ticks/1,200 cameras: query p95 0.535→0.185ms/tick p95 75.818→56.907ms. Final CI 0.285→0.092ms/75.808→61.918ms. Initial snapshot 3,671,090→3,297,031 bytes; markers 18,476→13,951. These are host CPU measurements, not Android FPS.

TS/167 JS/3 Python/world/map/art PASS. 10,000 ticks/ten exact restores/9,157 battles/10,906 peace settlements PASS. Existing game-room v21/game-command v23 active, live QA 37911320238 PASS. Exact QA room d224a5eb-3715-4c77-9657-98bb6028ca8d cleaned with UUID/name guard; zero related rows, original 29 backups remain. Locally blocked HTTP not counted.

Native API35 job **113787009485 PASS**, evidence **11613239385**. Exactly one Singleplayer tap and one Start tap; disabled Continue without save, menu/pages/Back, visible launch feedback, real campaign commands, four presets/twelve map modes, pan/double-tap, five layouts, density/cutout, process/reboot recovery and detached 12-tick benchmark pass. Actual final menu/new-campaign/loading/map/economy/diplomacy/government/dense screenshots reviewed. Native assertions enforce full painting coverage and un-clipped statistics. Continuous render/simulation/autosave soak **1,836.65 seconds**, no fatal JS/native logs.

Final **Dominion-visual-update-release.apk**, **140,113,723 bytes**, SHA256 `d90a8aca6993de2d69db42e75eb2791bc7f50c1efd3425028c5ee0a1e1205a1f`, embedded JS 10,447,040 bytes. Release artifact 11611437585/long11610974406/native11613239385. Actual ZIP/APK CRC/hash/bundle/Hermes/Skia/nine art hashes verified; non-debuggable 0.7.0(7), landscape, production endpoint/valid retained sideload signature.

Exact accepted APK saved successfully with identity/metadata for direct download at /workspace/scratch/d974873ac49c/final-visual-release/Dominion-visual-update-release.apk. Local executor disconnected after successful file saving/verification; final evidence reports published through GitHub API. Code/accepted binary already preserved.

Public APK delivery fixed: **https://github.com/elcin31/grand-strategy-multiplayer/releases/download/v0.7.0-visual-update/Dominion-visual-update-release.apk**. GitHub release v0.7.0-visual-update contains the exact accepted 140,113,723-byte APK, SHA-256 d90a8aca6993de2d69db42e75eb2791bc7f50c1efd3425028c5ee0a1e1205a1f. Publisher run 37929726099/job 113817204085 PASS, including unauthenticated download/checksum verification. New .github/workflows/publish-visual-release.yml republishes only this accepted binary with CI/hash guards; no runtime/backend change. ChatGPT cross-site URL failed on user Android browser; use this permanent public APK URL.

Next exact operation: deliver the public direct APK link above. Do not repeat implementation/build older artifacts. After delivery await user's Balanced hardware observations; physical FPS/touch/thermal/battery unmeasured. SwiftShader/PSS limits in PERFORMANCE_REPORT.md; no achieved 60 FPS claim or unrelated roadmap.

---

# COMPLETED PASS 3 — optimized v4, 2026-10-08

Only elcin31/grand-strategy-multiplayer and dedicated backend dfjsnjxnyjspwugjguhq used. AssetMind untouched. Runtime source a9df2395800d4ec09fdac25fea4cd35975221893; later QA/report changes do not change the accepted APK runtime. All requested v4 changes are summarized in PERFORMANCE_REPORT.md and RELEASE_REPORT.md.

4,386 → 2,924 provinces; 195 countries/7,214 cities/exact initial population preserved. Multi-step server-authoritative army orders with route line/cancel/current-permission checks, building catalogue and production/admin ledger, relations cooldown UI, staged startup, bounded trace and deterministic AI staggering implemented. Schema 11 / modern-world-v2 explicitly rejects old v1 topology; original saves remain and need v3. User must start a new v4 campaign.

Release run 37725176471 ALL PASS: 161 JS regressions, strict TS, Python suite, map/world benchmarks, 10,000 ticks/10 restores, native one-tap startup, construction, process/reboot recovery, 12-tick benchmark and 1,846.65-second soak. Backend game-room v20/game-command v22; live QA 37725884194 final attempt PASS (first attempt network heartbeat timeout, unchanged repeat passed). All three exact QA rooms cleaned; zero residual rooms/players/receipts.

Verified file: Dominion-optimized-v4-release.apk, 138,882,758 bytes, SHA-256 d727ab8bc136a18d65b3f9f2fa8f57c72a2aa9888cd3a94d73728dd3557ffcce. Artifact 11527528153; native evidence 11529720645; long evidence 11527911078. Embedded JS 10,589,176 bytes, all ABI Hermes/Skia, non-debuggable release, existing signing key, production endpoint and landscape verified.

Deliver exact APK directly and stop. Await user's Balanced real-device checks; do not infer Redmi FPS from emulator UI callback cadence. SwiftShader frame times/jank remain poor and are documented explicitly. Native does not independently automate the full distant-target combat gesture; reducer/live HTTP regressions cover route/combat/authority as documented.

---

# COMPLETED PASS 2 — optimized v3, 2026-10-07

User reopened performance work after testing v2 on Redmi Note 12. Base a9d1d78. Branch performance-pass-2. Work only in elcin31/grand-strategy-multiplayer. AssetMind untouched.

Implemented: fixed launch dock/latch/loading and one-tap native test; deep campaign tree clone; 195-country merged render LOD (all 4,386 gameplay provinces retained with explicit rationale in PERFORMANCE_REPORT); ownership/controller selectors, immutable city index reuse, text/label budgets, AI indexed garrison/urgency, developer input timing. 0.5.0 (5) release workflow names file Dominion-optimized-v3-release.apk; 30-minute native soak. No backend schema/deployment change required; dedicated production endpoint unchanged.

Final runtime source: 416b0b70374ffc2f9eb84e238213bc389f19782f. Release workflow 37576520835 all gates PASS (native repeat job 112740679221); artifact 11463536915; native evidence 11478246984. 156 JS tests, strict TS, 3 Python tests, 10,000 ticks/10 restores, 1,847.95-second native stress. Dedicated live backend QA 37607813987 PASS and its isolated room cleaned. APK verified and saved for direct delivery: Dominion-optimized-v3-release.apk, SHA-256 b40976297cf5ad91cde6ec0ae761b3d56596fd53f06090ac393fb71d5f6d55ab. Reports after runtime source do not change the APK. Stop after delivery; await user Balanced benchmark from real Redmi Note 12. Do not claim real-device FPS or province/save-count reduction.

# PERFORMANCE OPTIMIZATION SESSION — COMPLETED 2026-10-07

The Android performance completion session is closed at the code/CI/native-emulator level. Do not restart the performance roadmap or create new phases from this checkpoint.

Final source HEAD validated by release CI: **859747dc80832adf3d66ade62a4b69854bd97d3c**. The final smoke-harness commits only fixed test interaction races around deferred map loading and clipped ScrollView controls; they did not add gameplay systems.

Implemented performance work remains intact: cached/spatial GPU rendering, three geometry LODs, edge/city/label indexes, army clustering, UI-thread camera pacing, four graphics presets, adaptive quality, performance overlay/benchmark, AI indexing/scheduling, dynamic multiplayer snapshots, bounded telemetry/memory, deferred map loading and exited-campaign cleanup.

Final workflow **37564792672 PASS**:

- build-apk: PASS; strict typecheck; **149/149 JS tests**; Python suite PASS; release binary verification PASS;
- long-simulation: **10,000 ticks PASS** with **10 exact save/restore cycles**;
- android-smoke: PASS on API 35 with network disabled/no Metro; real campaign flow, 12 map modes, four presets, restart/reboot persistence, detached **12-tick benchmark**, and **1,200-second** render/simulation/autosave soak PASS.

Final artifact: **dominion-optimized-release**, ID **11458334028**. Extracted user-facing file: **Dominion-optimized-v2-release.apk**, 138,651,290 bytes, SHA-256 `cd1bd79edf4a5083b13b5ed970ab53876336457382c2604146969153def4c288`. Embedded JS bundle: 10,357,708 bytes. Version **0.4.0 (4)**.

Reports: PERFORMANCE_REPORT.md and RELEASE_REPORT.md contain exact evidence. Android smoke evidence artifact: **11460625490**; long-simulation evidence artifact: **11459875290**.

Physical Redmi Note 12 FPS/thermal/battery behavior is **not claimed as verified**. The original real-device lag report can only be accepted or rejected by testing this new APK on physical hardware. No additional gameplay scope is opened here.

---

# Development handoff — final hardening complete, 2026-10-06

## ORIGINAL ROADMAP

**PHASE 1–21: COMPLETED.** Recovery started from main 701c37a, checked against source and previous CI. Prior detailed feature-phase handoff remains in that commit. Only elcin31/grand-strategy-multiplayer and its dedicated Supabase dfjsnjxnyjspwugjguhq were used.

## FINAL HARDENING — COMPLETED THIS SESSION

1. **Performance: completed.** Profiled the actual full world. Indexed capital lookup once per AI tick, made strategic context lazy, removed duplicate decoding of unchanged multiplayer snapshots and preserved checksum-stable presence. Existing Skia/cached geometry/batching/culling/LOD retained. PERFORMANCE_REPORT.md records CPU samples and device limitations. Commit 7e516c1.
2. **Hard Bug Hunt: completed.** Fixed AI tick crash when pending peace terms become unaffordable before AI takes control. Failing-then-passing regression added; gameplay/normalization/saves/authority regression coverage retained. Commit b455a59.
3. **Fuzz/Chaos/Security: completed.** Bounded streamed HTTP JSON to 32 KiB; strict session/envelope validation before DB work; early authenticated rate check with transactional authority retained. Added modern-world intent/spoof invariants, six durable replay cases and six action-race CAS cases. Live eight-player QA and direct rollback SQL passed. Commit 994ee5f.
4. **Long Simulation: completed.** Initial runs found province IDs with literal `+`/`?` rejected at tick 1,850, then stale post-AI-peace population growth/religious unity at the 2,000-tick save checkpoint. Fixed both without renaming IDs or breaking schema 10; added regressions. Fresh CI passed 10,000 ticks and ten exact atomic save/restore cycles. Commit f9a413a. Raw final metrics: LONG_SIMULATION_RESULTS.json.
5. **Android Release: completed.** Version 0.3.0 (3), standalone assembleRelease gated on 10,000 ticks. Packaged manifest/signature/backend/bundle checks; native smoke includes saved campaign after process restart and emulator reboot without network/Metro. Artifact downloaded/extracted and SHA-256 verified locally. Release pipeline/version commit 49ce9e9. File: Dominion-final-release.apk.

## CURRENT PROJECT STATUS / NEXT ACTION

Original feature roadmap and five final technical blocks are closed. **Stop here. No Phase 27 or new feature roadmap.** APK delivery is the final user-facing action. Physical-device FPS/thermal acceptance and Play Store signing are explicit limitations, not claims of completed physical testing.

## CI / TEST RESULTS

- TypeScript strict: PASS.
- JavaScript: **134/134 PASS** locally and in release CI.
- Python: **3/3 PASS** locally and in release CI.
- Fuzz/chaos/security and dedicated DB rollback RPC checks: PASS. Controlled harness coverage and live coverage are distinguished in RELEASE_REPORT.md.
- Live backend workflow **37410899062 PASS**; malformed HTTP, 8-player capacity, authority/idempotency/version/concurrency, persistent construction/research, treaty consent, snapshot recovery, host departure, AI takeover and same-country return. QA room 5b1af212-84a4-4ccf-b786-2f5e7f8f6ad5 removed with original-host-name guard; zero room/membership rows verified.
- Android final release workflow **37410899043 PASS**, source **49ce9e90c3155e4b76dae9f57371d9bda04d1049**. All three jobs: long-simulation, build-apk, android-smoke PASS.
- Simulation: **10,000 ticks**, 195 countries / 4,386 provinces / 7,214 cities, ten restores, 9,744 peace settlements, 9,480 battles, maximum snapshot 4,903,485 bytes, maximum 2,317 armies. Longest war is deliberately idle human USA versus Mexico awaiting consent; diagnostic continuation through 7,000 confirmed AI-only wars at most 11 ticks in that interval.
- Native acceptance: API 35 emulator; landscape layouts, density/cutout, all twelve map modes, commands, process restart, emulator reboot, persistent paused campaign, Back/exit handling, no fatal app logs. No physical-device testing claim.
- Artifact **dominion-final-release**, ID **11390416081**; actual APK **138,622,502 bytes**, embedded bundle **10,328,920 bytes**. Evidence artifact **11390881738**. RELEASE_REPORT.md and RELEASE_INTEGRITY.txt contain SHA-256, SDK, signing and exact checks.

## BACKEND / COMPATIBILITY

Dedicated deployed functions: **game-command v20**, **game-room v18**. Existing schema 10, centralized normalizers, campaign saves and command-receipt migration retained. Server remains authoritative; client sends intents. Tokens remain in SecureStore and server secrets never enter the client. No backend from another project was used.

## BUGS

No known unresolved BLOCKER / CRITICAL / HIGH after recorded checks. Remaining MEDIUM/LOW issues and design limitations are documented in BUG_REPORT.md and RELEASE_REPORT.md: physical FPS unverified (software emulator has significant jank), pre-tribute HUD budget, allied-land transit absent, dormant all-offline clock with bounded catch-up, lifetime receipt retention, same-install credentials, procedural geography/resources and narrow-card text clipping. Existing test signing certificate is retained for sideload compatibility; not a Play Store signing setup.

## LAST COMMITS

- **7e516c1** — profile full world; targeted AI/poll optimization.
- **b455a59** — obsolete AI peace terms cannot abort a tick.
- **994ee5f** — bounded HTTP, authority/replay/chaos tests.
- **f9a413a** — imported province IDs and post-peace save equivalence; long simulation.
- **49ce9e9** — standalone 0.3.0 pipeline gated on simulation and reboot recovery.
- Final report-only commit contains this handoff, release/integrity report and raw simulation results; locate by message `docs: record verified final Android release and hardening results`. It does not alter APK runtime sources.

Git Data API publication preserved these logical boundaries and verified identical trees before a fast-forward main update. No force push. Historical failed simulations and earlier native-checkpoint reports remain in history; they are not mislabeled as passing.
