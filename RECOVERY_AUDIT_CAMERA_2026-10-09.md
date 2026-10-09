# Dominion camera and illustrations — recovery audit

Recovery date: 2026-10-09. Scope: only `elcin31/grand-strategy-multiplayer` and its unchanged existing backend.

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

## Current evidence

- Workflow: https://github.com/elcin31/grand-strategy-multiplayer/actions/runs/37962664267 .
- Build `113929272764`, simulation `113929273065`, paired camera `113937051395`: PASS. Native smoke `113937051422`: in progress at this checkpoint.
- Release artifact `11633425120`, paired native artifact `11634175847`, long simulation `11631804097`.
- APK: 140,948,773 bytes; SHA-256 `097601520271591ef123cd708c2536c3927c70eae6906c8fe087bc31c90c47ee`.
- Embedded Hermes JS: 10,462,624 bytes; all four ABI Hermes/Skia libraries, dedicated production endpoint, CRC and all 15 shipped artwork hashes independently confirmed. Exact artifact hash matches the CI non-debuggable release/landscape/version/signature report.
- Source/saved world remains 195 countries / 2,924 provinces / 5,411 cities / schema12. No backend deployment, database migration or production-room mutation in this pass.

## Exact next task

Finish the already-running native smoke/soak. Download its evidence, inspect actual ruler/government/religion/construction/menu/map/layout images and fatal logs, and record measured results. If it fails, fix the concrete regression and rerun the affected release gates. If it passes, publish and verify the exact APK, preserve logical commits when synchronizing main, finish reports and attach `Dominion-camera-optimized-illustrated.apk` (same bytes as the CI versioned release). Stop after delivery; physical pan/zoom acceptance belongs to the user's test of this APK.
