# Dominion 2.3 — Stage A checkpoint

Only `elcin31/grand-strategy-multiplayer` is in scope. AssetMind, other repositories, production campaigns, multiplayer rooms, database/auth/storage and previous releases have not been modified. No backend rollout or new Supabase project.

## Recovered baseline

- Branch head recovered: `dominion-2.2.1-performance-hotfix`, `25fb66de948dc061262148b25f4094f25c160932`.
- Actual compiled inputs: `278fbbd1140300a95673d5ff62445b98b592826a`. Subsequent successful binary/native verification: `444df39893e4a395cf71b13bb972cc146ae982e8`, run `38407524181`. Runtime input diff between these checkpoints and recovered hotfix HEAD is empty.
- APK: [Dominion-2.2.1-performance-hotfix.apk](https://github.com/elcin31/grand-strategy-multiplayer/releases/download/v2.2.1-performance-hotfix/Dominion-2.2.1-performance-hotfix.apk), 174187014 bytes, SHA256 `a44c54b3fcbe31dd7c23d5fea13782244436a6e47a7fa3ddf50be1204e846cbb`, version 2.2.1/code15.
- Main and earlier performance branches were inspected. `performance-pass-3` is an ancestor of the recovered hotfix, not a newer optimization checkpoint. The 2.2 geography and all previous cache/decode/LOD/gesture improvements are retained.

## Implemented and measured

- New detached, checksum-validated schema25 fixtures: peace; war with existing soldiers, real battle/siege records, unchanged geography. Constant-speed real-pointer pan; rapid zoom in/out; pinch+pan; repeated LOD thresholds; terrain; military; active daily simulation; approximately five minutes of repeated modes and camera movement. Monthly supplement starts at day25 and crosses actual budget/AI accounting.
- Native measurements: polled actual SurfaceFlinger presentation timestamps, gfxinfo completed frames, PSS, thread CPU samples, Perfetto scheduler/callstacks and Android FrameTimeline. UI callback FPS is never treated as displayed FPS. The CSV ring's truncation and trace setup warnings are retained.
- Baseline-only successful run: `38415364801`, artifact `11824738221`. API35 x86_64 Pixel2 emulator, SwiftShader, wm720x1280/density160/landscape, Balanced, adaptive off, overlay on, seed101. No physical Redmi Note12 test or fixed handset FPS claim.
- Residual dominant observed work is native rendering/presentation on the UI thread, including EGL/virtual graphics transport. JS and WebP decoding were not dominant in the scoped motion traces. About 36000 prepared border segments are replayed at the medium European zoom, including overscan.
- Border implementation: cached native pictures per immutable chunk; bounded supersampled visible snapshots prepared by the existing serial quiet-camera queue. Original strokes and vector fallback remain available. Oversized/pressure-rejected snapshots keep vectors. No live image is explicitly disposed. Additional decoded snapshot caps: Balanced12MiB, Performance6MiB; High/Ultra use vectors. Existing atlas/tint budgets remain unchanged.

## First candidate: rejected performance gate

- Runtime `bc099feda1b6445d0b54b12380267324d9024d57`, version 2.3.0-dev.1/code16. Built APK 174190790 bytes, SHA256 `4b6907428bea58d585b18ff9929e78a2ad7307a0d50ed217c419c033a3445b31`.
- Build and matched A-I run `38421201124`: build artifact `11828270888`, native artifact `11830351281`.
- Full comparison is in `DOMINION_23_PERFORMANCE_DEV1_REJECTED.json`. Zoom-out and active simulation improved, but pinch+pan, repeated LOD and the initial extended block had tail regressions. **Do not accept this binary as the Phase1 gate or publish it as Dominion2.3.**
- Immutable upgrade/interaction/monthly run `38424555865`, artifact `11829875101`, passed: cold launch, in-place 2.2.1 save preservation, modes, province/army selection, confirmed march, save/restart, no fatal logs. Monthly actual presentation P95 266.110744→126.619264ms; P99 366.297506→289.916211ms; PSS 462994→463478KiB. This does not override the failed full matrix.

## Second candidate: measured supplements, incomplete matrix

- Compiled runtime inputs: `161258ea6f4e5d303b24ad677134b22db92c746a`, version 2.3.0-dev.2/code17. It retains ready border snapshots through small zoom reversals and batches publication while quiet. APK 174191914 bytes, SHA256 `5100f24f3b6050ef82b028bdcb636c9d4ce6baa9b3923caa463f55b66fafff57`.
- Build job of `38430202571` passed, artifact `11831677196`. Its native comparison failed on the **baseline** APK after A-H when ADB went offline during a read-only saved-directory pull. Candidate comparison had not started.
- Run `38433985211` passed upgrade and interaction smoke, artifact `11833331431`. Its monthly baseline crossed day25→44/tick1/month2. Candidate HUD also advanced to February, but a fixed 2s save wait found only old paused generations; the monthly save check failed. Harness `61392fd642fc3c50f56c1b9e27bc81fe865dd350` now requires HUD acknowledgement and a completed durable paused save outside motion captures. Repeat `38446235787` is pending.
- Successful staged LOD supplement: run `38436366112`, artifact `11832459739`, API35 Pixel2 SwiftShader/3072MiB. Complete actual App FrameTimeline P95 159.744148→158.956664ms, P99 211.278179→192.116916ms; 188→204 scoped frames. Intentional .8s preparation gaps are excluded from synthetic stutter claims. Trace setup warnings remain visible. This supplement does not pass the full matrix by itself.
- Full matrix `38436360332` stopped at its 25min CI limit during candidate extended session. Baseline A-I completed; candidate A-H/I0 recorded several adverse tail values. All partial data are retained in `DOMINION_23_PERFORMANCE_DEV2_EVIDENCE.json`, artifact `11835220239`. **Incomplete and unaccepted.** Repeat `38446228488` uses the same immutable APK, paired day25 fixtures and a 45min job limit.
- Source checks for dev2: TypeScript, 52 renderer/lifetime tests, 73 unchanged gameplay/authority/save checks, 70 Python camera harness checks passed. No new 10000-step simulation or live two-client multiplayer acceptance has been run.

## Current source and continuation

- Source `eb549df19185af8918d466627d7fec4849a1eb1d`, version 2.3.0-dev.3/code18. Border styles now retain their prepared zoom through active pinch and zoom-out culls, then refine through the existing cancellable quiet-camera queue. High/Ultra, authoritative hit geometry and terrain/political pipelines are unchanged. TypeScript and 52 renderer/lifetime tests passed; camera telemetry tests 7/7 passed.
- Build/native run `38446818950` is pending. Do not infer a candidate APK hash, completed install or metric acceptance before collecting this run's actual artifacts. It uses paired 3072MiB emulators and enforces `compare-camera23.py --check` after all captures.
- `dominion23-validation.yml` can reuse a compiled candidate only after a runtime-input diff. Use `apk_run_id=38446818950` after its build job succeeds for upgrade/monthly and `lod_only=true` validation. Earlier dev2 runs remain tied to their captured SHA, not current dev3 source.
- Package remains `com.elcin31.grandstrategymultiplayer`; certificate SHA256 remains `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; four ABI and embedded Hermes/all atlas/launcher verification are required on each compiled APK.
- **Stage A is in progress.** Do not begin StageB or new gameplay mechanics until tail regressions, visual/interaction checks and memory concerns are resolved. StagesB–G (engine improvements, gameplay gaps, typed events/scenarios, integrations/migrations, 10000 steps, live multiplayer, final camera regression and complete release APK) remain unfinished. Existing persistent AI/trust/industry/focus systems should be audited and extended rather than duplicated.
- No Dominion2.3 GitHub Release has been published. Older releases are intact. Keep exact runtime SHA and binary identity when continuing; scripts/documentation-only commits do not require recompilation.
