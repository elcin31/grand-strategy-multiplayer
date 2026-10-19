# Dominion 2.3 — verified Android release delivered

## Final delivery — verified APK and ZIP published (2026-10-19)

- [Complete ZIP](https://github.com/elcin31/grand-strategy-multiplayer/releases/download/v2.3.0-playtest.4/Dominion-2.3.0-playtest.4.zip):198243081 bytes, SHA256 `83faa3411aa938838257257f9e9c21391b81f5bd590d38efebfe0eeb7cac890f`.
- [Standalone APK](https://github.com/elcin31/grand-strategy-multiplayer/releases/download/v2.3.0-playtest.4/Dominion-2.3.0-playtest.4.apk):174268850 bytes, SHA256 `bd575f012f1ff94c976a7e5adabe19654315fc56b8e77c22514056bcb52eb20a`; [SHA256SUMS](https://github.com/elcin31/grand-strategy-multiplayer/releases/download/v2.3.0-playtest.4/SHA256SUMS.txt).
- Publication39236494028 passed:2679 approved files and all23 native camera pairs reproduced; two CI ZIPs and the independently built local ZIP are byte-identical. GitHub asset digests match, direct downloads verified without authentication, tag resolves to compiled `3d5ad0016dc7c62acabc1376feec3a88f7f38450`. Source archive/evidence `8be568b2b7b4e603225565463885864cbc1e01aa`; no later game-code changes. Full proof: `DOMINION_23_RELEASE.json`.
- All15 mandatory gates passed:409 source tests, TypeScript/content, Python138 pass/1 skip, daily10000/monthly10000 with ten exact restores each, actual APK upgrade/interaction/monthly/LOD/gameplay/save/restart,500-army stress, three live HTTP clients and signed native online/reboot/reconnect. Existing Dominion backend, user saves/rooms, package/signature, graphics2.2 and older releases preserved.
- Physical Redmi Note12 performance remains unmeasured. This emulator-tested playtest makes no handset FPS or indefinite-memory guarantee. All original adverse camera results remain available.

## Historical dev12 checkpoint — superseded, rejected diagnostic binary

The record below describes only the earlier dev12 archive. Its failures and unfinished state are preserved as history; use the verified playtest4 release above.

Repository: `elcin31/grand-strategy-multiplayer` only.

This archive is **not a completed Dominion 2.3 update**. It contains an actual standalone experimental APK and evidence. New gameplay systems have not been developed because the user's first native performance gate remains open.

- ZIP: [Actions artifact11890304616](https://github.com/elcin31/grand-strategy-multiplayer/actions/runs/38557678673/artifacts/11890304616). The GitHub artifact wrapper contains the inner ZIP and SHA256 file.
- Inner filename: `Dominion-2.3-playtest-checkpoint.zip`,91521430 bytes.
- Inner SHA256: `e9b12b899476776d8cad7ccc5f3248168d27902188efe27fb1e1996a4b5997f3`.
- APK filename: `Dominion-2.3.0-dev.12-playtest.apk`,174187310 bytes.
- APK SHA256: `3fd231a32817e382538a2a7766433f9d73f6e7bb77c805a1365eba4ed9409b41`.
- Compiled APK source: `9a12e22a1998d2ffbb40c9658eff8d5f156aacc4`.
- Packaging source: `4ab90a7ec6e07820c5268171387b8b5473c2b4ac`.
- Local archive: `/workspace/dominion-evidence/delivery-dev12/Dominion-2.3-playtest-checkpoint.zip`.
- CRC and all28 internal SHA256 entries passed locally. `dominion23Complete=false`, `cameraNativeGate=false` are explicit in the actual manifest.

The actual APK passed compatible installation, cold launch without Metro, retained paused campaign, map modes, province/army selection, route/march, save/restart, monthly progression, repeated LOD and no-fatal checks on the CI emulator. The compiled bundle, four ABI, original package and certificate were verified. These narrow checks do not mean every save migration or multiplayer feature passed.

The complete A–I comparison failed15 tail metrics. PanP95 increased70.25%, zoom-out35.68%, military39.72%. Emulated Android35/SwiftShader results do not establish performance on a physical Redmi Note12. Preserve the APK as evidence; do not merge its native patches into the default renderer or publish it as an optimized2.3 release.

For continuation, use `dominion-2.3-performance`. Accepted baseline remains [2.2.1 hotfix APK](https://github.com/elcin31/grand-strategy-multiplayer/releases/download/v2.2.1-performance-hotfix/Dominion-2.2.1-performance-hotfix.apk), SHA256 `a44c54b3fcbe31dd7c23d5fea13782244436a6e47a7fa3ddf50be1204e846cbb`, runtime278fbbd1140300a95673d5ff62445b98b592826a. Runtime source under `src/`, `supabase/functions/`, `assets/` remains exactly recovered25fb66d. Default dev9 version metadata has no corresponding built APK.

## Actually unfinished work

1. Native camera acceptance: identify remaining presentation/GPU/compositor work and establish a measured improvement without regressions. Existing immutable-path CPU gains, eliminated failed consumer calls and swap-zero request did not pass the full APK gate. Do not repeat rejected caches or treat callback counters as FPS. Warm auxiliary swaps and primary presentations gave conflicting evidence; queue causation remains unproved.
2. Only after Stage A passes, optimize the existing engine. Resolve the59 reproduced source-test failures and exact save/restore War Score mismatch at tick1000; the existing10,000-month run stopped at that mismatch. Do not round it away.
3. Implement and integrate real gaps in AI, diplomacy, warfare, multilateral peace, economy, politics, typed events, existing focuses and validated scenario content. Existing working systems should be extended, not replaced.
4. Validate authority, migration, event idempotency, two real independent multiplayer clients on the existing Dominion backend,10,000 steps, restart/load and final matched native camera regressions.
5. Build, install and test the final release APK from the exact final SHA. Publish a release only after all required gates pass, preserving package, signing compatibility, saves, rooms and existing releases.

AssetMind and other repositories/infrastructure were not touched. No second backend, new database, production room deletion or Dominion2.3 release was created.
