# Dominion visual update 0.7.0 (7) — verified standalone release

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
