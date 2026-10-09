# Dominion camera and illustrations — recovery audit

Recovery date: 2026-10-09. Scope: only `elcin31/grand-strategy-multiplayer` and its unchanged existing backend.

## Final status after continuation — 0.8.1 (9)

Tested runtime **47b0db4f8b220e9ea89998afaac035239b64f5e0**; final CI **37971350100 SUCCESS**, all five jobs passed. Evidence checkpoint **213298265ba1175fa1a2742c2004cefc9d8467c0** is preserved and followed by the final report-only main commit. Source and checks, not filenames/commit titles, determine these statuses. The original recovery table below is retained as the point where the previous session stopped.

| # | Block | Final status | Verified integration / evidence / limit |
|---|---|---|---|
| 1 | Recovery and camera profiling | DONE | Actual main/30 commits/seven follow-ups/source/reports/actions/old APK recovered; local edits preserved; final identical-pointer paired native and exact-fixture host workloads reviewed. |
| 2 | Camera and gestures | DONE | Existing UI-thread camera, stable gesture/selection delegates and coverage pipeline retained; real-pointer pan/pinch and regression gates pass. |
| 3 | Renderer optimization | DONE | Transferable retained rasters paint actual geography; full-map paint gates and reviewed final pan/global/local/mode/panel PNGs pass. |
| 4 | Culling and LOD | DONE | Visible tile selection, conservative coverage, prepared pinch detail and settled refinement integrated; host/native and culling regressions pass. |
| 5 | Geometry and borders | DONE | Stable native paths/border chunks retained; classification/ownership/tile regressions pass; native path-build counts unchanged during pan. |
| 6 | Labels and army markers | DONE | Retained batched glyph picture, budgets and army stacks integrated; exact identities/troops/owners regressions and native world/local/military paint pass. |
| 7 | Renderer technology evaluation | DONE | Existing GPU-backed Skia/Reanimated approach audited/profiled; transfer defect corrected in recovered work, no unnecessary engine/backend migration. |
| 8 | Ruler illustrations | DONE | Original atlas integrated into actual ruler panel; exact packaged hashes, native ruler assertion and reviewed PNG pass. |
| 9 | Army and commander illustrations | DONE | Military painting retained; assigned/free commander portraits now integrated using stable visual-only IDs; actual assignment/assertion/painted native PNG pass. |
| 10 | Religion illustrations | DONE | Every authoritative faith maps to atlas tiles; actual current/choice panel, native assertions/images and catalogue tests pass. |
| 11 | Government illustrations | DONE | All government choices/current form have valid art; integrated command UI and final native assertion/images pass. |
| 12 | Construction and buildings | DONE | Ten actual types use atlas tiles; construction/completed cards and real building commands retained; catalogue/native tests and PNG pass. |
| 13 | Economy and diplomacy illustrations | DONE | Existing original banners used in actual active panels; final command/mode smoke and economy/diplomacy PNG review pass. |
| 14 | Game panel update | DONE | Remaining technology university/branch and open-war images integrated using ready art; real research/commander actions, lazy panels, first launch and five native layouts pass. |
| 15 | Images and memory | DONE | Exact 15 packaged WebPs / 2,188,634 bytes; no extra image bytes; lazy panel assets outside Canvas, bounded raster cache, 31 soak PSS samples reviewed. No universal peak/leak claim. |
| 16 | Performance validation | PARTIAL | Nine final paired native scenarios, frame/CPU/PSS and host selectors pass; substantial software jank/pinch cost remains. Physical Redmi Note 12 pan/pinch/thermal/battery smoothness unmeasured. |
| 17 | Regression testing | DONE | Strict TS / 175 JS / 10 Python / art/host gates, 10,000 ticks/ten restores, full native first Start/gameplay/art/layout/save/reboot and 1,867.83-second soak pass. Live multiplayer and full distant-target combat rely on explicit shared/long/inherited live coverage, not a new native online session. |
| 18 | Android release | DONE | Non-debuggable standalone 0.8.1(9), embedded Hermes/all ABI Skia/production endpoint/signature/landscape verified; all five CI jobs and public APK byte comparison pass. |
| 19 | APK delivery | DONE | Artifact 11636503809 downloaded, ZIP CRC/hash checked, exact APK extracted/binary-verified; final APK and ZIP successfully saved for direct final-chat links. User-side installation acceptance remains open. |

No runtime block is BROKEN or NOT STARTED. No introduced unresolved BLOCKER/CRITICAL/HIGH detected by completed gates. **DONE for implemented camera blocks does not mean the physical lag symptom is empirically fixed.** New artwork reuses ready paintings; no renderer/game/backend restart, rules/save/world changes or new backend deployment in this continuation.

Final APK **Dominion-camera-optimized-illustrated.apk**, **140,949,889 bytes**, SHA256 `7d27c4f7c3e5e6a9ad14549e435559baad960d48d3b84bab9cc264b30436b060`, embedded Hermes **10,463,744 bytes**. Verified chat ZIP **60,873,762 bytes**, SHA256 `ab7b0524ac9d53ffddee288fac2b9f3b548c848dcae3431b00acee30c50025fb`; both saved under `/workspace/scratch/5dfbb8019a0d/`. Release: https://github.com/elcin31/grand-strategy-multiplayer/releases/tag/v0.8.1-camera-illustrated . Final build/long/paired/native/publish job IDs: **113958490313 / 113958490336 / 113966823910 / 113966823944 / 113985697002**, all PASS. Full final evidence: `PERFORMANCE_REPORT.md`, `RELEASE_REPORT.md`, `BUG_REPORT.md`, `DEVELOPMENT_HANDOFF.md`, `CAMERA_NATIVE_PAIRED_081.json`, `BENCHMARK_CAMERA_081_CI.json`, `LONG_SIMULATION_CAMERA_081_RESULTS.json`, `NATIVE_CAMERA_081_SMOKE_REVIEW.json`, `RELEASE_CAMERA_081_LOCAL_VERIFICATION.json`, `RELEASE_CAMERA_081_PUBLICATION.json`.

Exact next task: user tests this delivered 0.8.1 in Balanced on Redmi Note 12 with pan/rapid pan/pinch/world/regional/local/modes/markers/panels. If severe lag persists, profile that device/workload and target the measured pinch preparation/settling or frame pacing. Do not repeat renderer/art implementation or rebuild without new evidence. All final release/delivery preparation is complete; the original recovery notes below are historical.

---

## Exact recovered point

- Published `main`: `0ea39eca80dac8d68d379968f3a7275b874b56ae`.
- Previous session's saved runtime: `61b77f4f4eb03fa01b710c9d34ee306a5359012d`, existing `camera-fix` branch.
- Recovered checkout: `/workspace/scratch/01b293dc1baa/grand-strategy-multiplayer`.
- Seven saved follow-up commits after main were inspected, together with the previous 30 main commits, large runtime diffs, all four reports, visual design/provenance, renderer/gesture/layer/culling/LOD/cache code, panels and tests.
- Four uncommitted reports and `LONG_SIMULATION_CAMERA_RESULTS.json` were recovered. Tracked bytes were preserved in Git stash `cc5fc7e6450217656292bcd79bab1dee18937172`; an independent patch and the untracked simulation result were also retained before editing.
- Local main's unpublished baseline-test commit `757573c` duplicates the already-published `a949b8e` patch. It must be preserved when synchronizing main; no runtime work should be discarded.
- The session stopped at final Android acceptance, not at renderer implementation. Runtime/artwork is integrated. Release workflow `37962664267` already built 0.8.0; do not repeat the implementation or generate the finished paintings again.

## Status at recovery

DONE requires integration plus the relevant completed check. PARTIAL includes integrated code awaiting its final native acceptance or physical-device evidence.

| # | Block | Recovered status | Evidence / remaining work |
|---|---|---|---|
| 1 | Recovery and camera profiling | DONE | Exact saved checkout and refs recovered; paused native old/new captures and host selector workload inspected. |
| 2 | Camera and gestures | DONE | UI-thread focal pinch/pan/inertia retained; coverage and stable delegate integrated; camera regressions and real-pointer comparison pass. |
| 3 | Renderer optimization | DONE | Transferable raster tiles actually paint; paired API35 screenshots and frame completion pass. |
| 4 | Culling and LOD | DONE | Visible tile selection, coverage containment, prepared pinch detail and settled refinement integrated/tested. |
| 5 | Geometry and borders | DONE | Retained native paths and ownership border chunks; exact classification/annexation and tile coverage regressions pass. |
| 6 | Labels and army markers | DONE | One retained picture, hard budgets and stacks integrated; identities/owners/troops conserved in dense regression; local native screenshot verified. |
| 7 | Renderer technology evaluation | DONE | Existing Skia/Reanimated GPU-backed architecture retained; native transfer defect exposed and corrected. No gameplay/backend migration required. |
| 8 | Ruler illustrations | PARTIAL | Original atlas is mounted by the real ruler panel; asset/catalogue tests pass; final native screenshot acceptance pending. |
| 9 | Army illustrations | DONE | Original military paintings retained and used by real military panels; prior accepted native evidence plus current unchanged sources. |
| 10 | Religion illustrations | PARTIAL | Every authoritative faith maps to a valid atlas tile; real panel integration present; final native acceptance pending. |
| 11 | Government illustrations | PARTIAL | Every government maps to an atlas tile; actual current/choice panels integrated; final native acceptance pending. |
| 12 | Construction and buildings | PARTIAL | Ten actual building types have atlas cards in construction/completed views; final native construction screenshot acceptance pending. |
| 13 | Economy and diplomacy illustrations | DONE | Existing original banners remain in active real panels; current economy screenshot verified; inherited accepted diplomacy evidence retained. |
| 14 | Game panel update | PARTIAL | Conditional mounting and existing commands retained; final full startup/layout/art smoke pending. |
| 15 | Images and memory | DONE | 15 WebPs / 2,188,634 bytes, exact packaged hashes, lazy active-panel images, bounded raster LRU; current native PSS captured. No universal memory/leak guarantee. |
| 16 | Performance validation | PARTIAL | Nine paired emulator scenarios pass; physical Redmi Note 12 smoothness remains unmeasured. |
| 17 | Regression testing | PARTIAL | Typecheck / 175 JS / 10 Python / art / 10,000 ticks / ten restores pass; final Android smoke and 30-minute soak still running. |
| 18 | Android release | PARTIAL | Release binary built and independently verified; publication/delivery waits for final native acceptance. |
| 19 | APK delivery | NOT STARTED | Artifact downloaded/extracted for verification; user delivery follows successful final gates. |

No recovered runtime block is currently BROKEN. The pooled-event crash, transparent map and pinch regression were fixed before this candidate and were not accepted or delivered.

## Evidence at recovery (historical 0.8.0 checkpoint)

- Workflow: https://github.com/elcin31/grand-strategy-multiplayer/actions/runs/37962664267 .
- Build `113929272764`, simulation `113929273065`, paired camera `113937051395`: PASS. Native smoke `113937051422`: in progress at this checkpoint.
- Release artifact `11633425120`, paired native artifact `11634175847`, long simulation `11631804097`.
- APK: 140,948,773 bytes; SHA-256 `097601520271591ef123cd708c2536c3927c70eae6906c8fe087bc31c90c47ee`.
- Embedded Hermes JS: 10,462,624 bytes; all four ABI Hermes/Skia libraries, dedicated production endpoint, CRC and all 15 shipped artwork hashes independently confirmed. Exact artifact hash matches the CI non-debuggable release/landscape/version/signature report.
- Source/saved world remains 195 countries / 2,924 provinces / 5,411 cities / schema12. No backend deployment, database migration or production-room mutation in this pass.

## Next task at recovery (completed; final next step above)

Finish the already-running native smoke/soak. Download its evidence, inspect actual ruler/government/religion/construction/menu/map/layout images and fatal logs, and record measured results. If it fails, fix the concrete regression and rerun the affected release gates. If it passes, publish and verify the exact APK, preserve logical commits when synchronizing main, finish reports and attach `Dominion-camera-optimized-illustrated.apk` (same bytes as the CI versioned release). Stop after delivery; physical pan/zoom acceptance belongs to the user's test of this APK.
