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
