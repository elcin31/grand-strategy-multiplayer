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

## Current candidate and continuation

- Current compiled runtime inputs: `161258ea6f4e5d303b24ad677134b22db92c746a`, version 2.3.0-dev.2/code17. It retains ready border snapshots through small zoom reversals and batches publication while quiet. Border preparation/build/publication counters are available in diagnostics.
- Run `38430202571` builds this candidate and repeats A-I against the exact 2.2.1 APK. Collect its artifacts and run `python scripts/compare-camera23.py <profile-baseline> <profile-candidate> --check`. A successful workflow capture alone is not performance acceptance.
- `dominion23-validation.yml` reuses a verified compiled candidate only after a runtime-input diff. Run it with `apk_run_id=38430202571` for actual upgrade/interaction/monthly checks. Also run with `lod_only=true`: staged World→Region→Province switching, fixed preparation pauses, complete actual FrameTimeline durations. Intentional idle gaps must not be presented as stutters.
- Source checks for dev2: TypeScript, 52 renderer/lifetime tests, 73 unchanged gameplay/authority/save checks, 70 Python camera harness checks passed. No new 10000-step simulation or live two-client multiplayer acceptance has been run.
- Package remains `com.elcin31.grandstrategymultiplayer`; certificate SHA256 remains `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; four ABI and embedded Hermes/all atlas/launcher verification are required on each compiled APK.
- **Stage A is in progress.** Do not begin StageB or new gameplay mechanics until tail regressions, visual/interaction checks and memory concerns are resolved. StagesB–G (engine improvements, gameplay gaps, typed events/scenarios, integrations/migrations, 10000 steps, live multiplayer, final camera regression and complete release APK) remain unfinished. Existing persistent AI/trust/industry/focus systems should be audited and extended rather than duplicated.
- No Dominion2.3 GitHub Release has been published. Older releases are intact. Keep exact runtime SHA and binary identity when continuing; scripts/documentation-only commits do not require recompilation.
