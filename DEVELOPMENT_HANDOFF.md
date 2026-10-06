# Development handoff — final hardening checkpoint, 2026-10-06

## Scope and recovered baseline

Only elcin31/grand-strategy-multiplayer and dedicated backend dfjsnjxnyjspwugjguhq. Main 701c37a was verified against source, prior CI and this file. Original feature roadmap PHASE 1–21: COMPLETED. Prior detailed phase history is preserved in 701c37a and Git history. No new feature phase is authorized.

This session is implementing exactly five final technical blocks. **Do not treat this checkpoint as final release acceptance.**

## Completed implementation and current checks

1. Performance hardening: CPU profiles identified repeated AI capital searches, eager strategic context and duplicate snapshot decode. Optimized those paths; retained Skia renderer/cached geometry/LOD/culling. PERFORMANCE_REPORT.md records before/after measurements and limits.
2. Hard bug hunt: fixed AI crash on obsolete unaffordable peace terms, with regression. Existing gameplay/normalization/authority tests retained.
3. Fuzz/chaos/security: bounded streaming HTTP JSON (32 KiB), strict envelope/session validation and early authenticated rate check backed by existing transactional rate/CAS/receipts. Added modern-world hostile commands, malformed payloads, six replay scenarios and six CAS race scenarios. Direct dedicated-DB rollback checks pass. Live HTTP CI pending.
4. Long simulation: full-world 195-country/4,386-province/7,214-city run, invariant checks every 50 ticks, atomic save/restore every 1,000. Found and fixed invalid rejection of literal `+`/`?` province IDs (tick 1,850) and stale population-growth/religious-unity totals after AI territory peace (tick 2,000). Both failing-then-passing regressions added. Fresh 10,000-tick run in progress; completion not yet claimed.
5. Android release: pipeline prepared for version 0.3.0 (3). A mandatory 10,000-tick CI job gates assembleRelease. Release verifier inspects packaged manifest/version/signature/backend; bundle/native verification retained. Native smoke now also reboots the emulator and restores the paused campaign. Final build/run/download/attachment pending.

## Current project status / next action

Original Phase 21 remains the last feature phase. Finish the five hardening blocks and deliver Dominion-final-release.apk. **Do not invent another roadmap or add gameplay features.**

- Inspect the current 10,000-tick run; fix any failures with regressions and rerun.
- Wait for final Android pipeline and live backend QA, inspect evidence and clean only its exact guarded QA room.
- Download artifact dominion-final-release, extract actual APK, verify bundle/non-debuggable manifest/production backend and attach the APK in chat.
- Replace this checkpoint and RELEASE_REPORT.md with actual final commit/run/test counts after success.

## CI / local checks

- Baseline: 124 JS tests; previous native acceptance 37328473081 and live QA 37285016137 passed.
- Current strict TypeScript and 133 tests passed before the latest derived-total regression; final suite is running.
- Python: 3/3 pass with scripts/world-requirements.txt installed.
- Native prebuild and landscape configuration pass locally.
- No physical-device FPS, thermal or battery testing is claimed.
- Local live HTTP attempts hit proxy/network errors and are not counted as passing.

## Backend

Dedicated functions game-command v19 / game-room v17 include HTTP guards and province-ID fix. Latest derived-total fix must be redeployed before final live acceptance. Existing schema 10 and receipt migration retained. No client secrets added. Offline multiplayer remains poll-driven with bounded catch-up and no host dependency.

## Bugs and limits

See BUG_REPORT.md. New long-simulation defects are fixed in source; final rerun remains mandatory. Existing MEDIUM/LOW limits are pre-tribute HUD budget, no allied-land transit, physical performance unverified, campaign-lifetime receipt history, same-installation credentials, procedural terrain/resources and narrow-card text clipping. Release uses the existing test signing certificate for sideload compatibility; it is not a Play Store signing setup.

## Logical commits

Published Git objects (main update pending at checkpoint creation):
- 7e516c1 — performance profiling and targeted optimization (local c611790).
- b455a59 — obsolete AI peace terms fix (local 956efd7).
- 994ee5f — bounded HTTP input and chaos/security regression (local 5c1da57).
- Local 2381901 — long-simulation province-ID and save-equivalence fixes, script and bug evidence.
- Release pipeline/version/documentation follows separately; final remote SHAs will be recorded after publication.
