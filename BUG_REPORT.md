# Expansion 2.0 — verified sampler checkpoint, 2026-10-10

Actual runtime **d7c3d593802f2edf27894f92fe10928341df0080**, build/long/camera run **38021043667**. Main remains **dbb354ab038713c3e54b969b34a6fc88bf2de11f**. Stage 0 complete; Stage 1 investigated/optimized with P95 gates passing but remaining pinch tail concern; Stage 2 implemented and real native marker/order/Back/foreign-flag/reselection/cancel checks passed before the full smoke stopped on a geography-crop false positive. Stages 3–11 remain pending with all scope preserved in EXPANSION_SCOPE.md. No final v2 APK exists.

- **Strict TS / 182 JS / 10 Python / original 15 art / production Hermes / release integrity / 10,000 ticks with ten exact restores PASS in original build CI.** Latest test harness adds four Python regressions (14 local PASS). Long simulation 471s, host tick P95 61.11ms; host timing is not Android performance or an attributable UI improvement. Numeric/world/battle outcomes match the unchanged engine; prior balance concerns remain.
- **Original nine-scenario independent-campaign-v1 camera PASS.** Native raw pinch P95 371.12 -> 316.76ms, panel-closed 100.18 -> 84.73ms. EXPANSION_CAMERA_D7C3D59_REVIEW.json records P50/P95/P99, memory and frame stages.
- **Stronger fixed-save-reset-v2 nine-scenario camera PASS**, run **38022207120**, QA source **dbe8a1e1927c16f97378a17f80bf1d637cd53766**. Both release APKs loaded the byte-identical paused schema12 seed101 world (SHA3882257a66e558a529dd2cd8005e782243a7b07adf1a54576564465402288dc5, checksum e8befae1); camera reset before each workload and final stored state checked exactly. Full histogram P95 pinch550 ->550ms / world150 ->150 / panel-closed101 ->101. Raw P95 pinch600.18 ->594.78 / panel-closed105.61 ->101.34. **Pinch P99 worsened**: histogram800 ->1100ms, raw839.57 ->1144.85; do not hide this behind P95 or claim universal improvement. No >=5s completed frame was discarded. Sampled PSS before329162–426706 / after336089–406038KiB. EXPANSION_CAMERA_FIXED_D7C3D59_REVIEW.json preserves all scenarios and the older exporter metadata correction.
- **Full Android smoke job114125259526 stopped** after actual touch/commands/research/build/economy/treaty/presets/modes checks at the free-camera screenshot paint gate: left crop land0.0623<0.08. Downloaded artifact11658924540, SHA835513d73fc14acfe5f9e0c2029f1ff3bebfe270532b68ab1745ba6daaa8863f. Original PNG visually shows intact Americas/borders/provinces/markers with Pacific in the measured crop. Harness now retains that original image/statistic, resets to world overview and applies the unchanged8% paint gate there. A same-APK full rerun is required; density/cutout/reboot/30min stress on d7 remain pending. Prior efd full native stress passed but does not substitute for this rerun.

Checkpoint APK SHA9b1346892404fb11d51cc4232afe0c8d3165e9944603d10da41fec9e8a3f96c9, 140961717bytes, embedded Hermes10475572bytes, nondebuggable0.8.1(9), landscape, only dedicated Dominion backend and unchanged sideload signing certificate verified. EXPANSION_SAMPLER_APK_VERIFICATION.json / EXPANSION_LONG_D7C3D59.json hold verified artifacts. This is an intermediate binary, not Dominion-grand-strategy-v2-release.apk. No main/backend/production-data changes, no AssetMind access, no province/city reduction, no schema changes. Physical Redmi performance unmeasured.

**Next exact action:** complete same-APK full native rerun on expansion-qa and investigate fixed-world pinch tail using raw stage timings/replicates; preserve all original gates. Persistence continuation concern remains: cold host encode+decode ~619ms and asynchronous file reads may resume synchronous validation during camera movement. Retain corrupt-save refusal/checksums/atomic generations. Do not begin the next major stage until required prior regression checks pass. Then extend existing diplomacy/treaty/CAS/order paths to all18 real actions, gradual missions, transfers/access/consent, reasons/history and AI.

---

# Expansion 2.0 — current regression gate, 2026-10-10

Runtime `efd1f3d` passes build / 10,000 ticks / full Android touch smoke + 1835.67s stress. Same-APK camera replay 37995443161 **REJECTED**: panel-closed histogram P95 117 -> 200ms; pinch P95 500 -> 400ms does not override the failed scenario or worse raw P99. Verified paired/native/APK hashes, all quantiles and sampled PSS in EXPANSION_NATIVE_EFD1F3D_REVIEW.json; long simulation EXPANSION_LONG_EFD1F3D.json. Current UI-host private-counter revision needs fresh native acceptance. No physical Redmi FPS, no completed Expansion 2.0, no final v2 APK claimed. Stages 3–11 remain fully authorized and pending.

---

# Expansion 2.0 — active bug status

**HIGH army selection capture: fixed in implementation, native validation pending.** selectAt previously dispatched every tap to ORDER_ARMY when selected, ahead of marker testing. Marker taps now toggle/switch first; foreign flag/label targets precede markers. Android Back used to close context with selectedArmyId alive; it now clears the selection independently. Internal army-row state no longer diverges from campaign selection. Deselect emits no authoritative command; route/save/authority regressions PASS. Separate Cancel Movement remains the sole cancellation command. No final APK has been delivered for this expansion.

**HIGH native camera regression: OPEN; first expansion candidate REJECTED.** Same-emulator paired run `37985852569` on runtime `056a5b2` increased pinch full-histogram P95 from 550 to 700ms, raw P95 from 596.02 to 720.31ms, and degraded several pan scenarios. Lower JS CPU and fewer cull commits did not satisfy the native gate. Full evidence: EXPANSION_CAMERA_REJECTED_056a5b2.json. This APK must not be delivered as a successful update. The next revision removes shared-array histogram modification from every display callback, caches transferable small flag rasters, discards overdue camera deadlines and defers background work throughout inertia. Strict TS / 182 JS / production Hermes export PASS; native improvement is unverified until a fresh paired run passes. Existing synchronous save encoding outside camera activity and physical Redmi acceptance remain OPEN.

**Native UX harness corrections:** the rejected APK completed a real owned-province movement order and repeated-marker deselection without cancelling that order. Subsequent smoke stopped at a stale marker-coordinate assumption: deselection restores a weighted cluster anchor. The harness now follows the same army IDs through clustering. Short movement captions are tapped through their visible accessible button rectangle. Remaining Back/foreign-flag/reselection/cancellation and soak checks still require a complete successful run; partial native evidence is not acceptance.

**Roadmap gaps:** all entries in RECOVERY_AUDIT_EXPANSION_2026-10-09.md remain scoped. New diplomacy/espionage/economic policy/supply/tech graph/focus/art/long integration release gates remain unfinished. Existing warnings below are historical.

---

# Dominion 0.8.1 — final camera and illustrated-panel regression status

Tested runtime `47b0db4f8b220e9ea89998afaac035239b64f5e0`, workflow `37971350100`. Recovery continued the saved implementation and preserved all prior successful performance/gameplay work. The caught pooled-layout crash, missing-map GPU snapshot defect and cold-pinch regression are fixed in the recovered source; failed/missing-geography candidates were not accepted as performance improvements. Final broad map-paint checks and actual political/global/local/pinch/terrain/military/panel PNGs PASS.

Strict TS / 175 JS / 10 Python / 15-art / host benchmarks / 10,000 ticks / ten exact restores / final paired native camera comparison PASS. Final 0.8.1 native gameplay/layout/portrait/technology/soak and publication also PASS; all five workflow jobs succeeded. Commander-ID portrait seeds are visual only: no new save fields, permission/command changes or backend deployment. Existing online protocol/reducer regressions and the accepted unchanged-backend live QA evidence are retained; no fresh online production-room test is claimed for this client-only pass.

Native job **113966823944** and artifact **11639851749** independently reviewed: exactly one Singleplayer/Start tap, network-disabled standalone launch, real recruitment/commander assignment and visible assigned/free portraits, real technology art/research, economy/construction/government/religion, four presets/twelve modes/five layouts, density/cutout, save/process/reboot and **1,867.83-second soak** PASS. Actual PNGs and both logcat files reviewed; zero matched fatal JS/native / ANR / OOM patterns. Soak has **31 PSS samples, 441,449–525,094 KiB**; no continuous peak or universal leak claim. `NATIVE_CAMERA_081_SMOKE_REVIEW.json` records provenance and limits. Native harness does not independently automate a full distant-target click-to-move battle or a live two-player production session; reducer/shared/long-simulation and inherited live evidence remain explicit coverage. Public APK byte comparison passed and exact standalone APK plus ZIP fallback are saved for direct chat attachment. No introduced unresolved BLOCKER/CRITICAL/HIGH was detected by these gates; physical camera acceptance remains open below.

**Physical camera lag remains OPEN for hardware validation.** Final software-emulator pinch histogram p95 **600 → 350ms**, raw p95 **624.92 → 375.47ms**, but candidate jank remains **80.22–92.92%**. Native pinch JS mean **19.55% → 21.45%** and main UI mean **73.73%** remain documented bottlenecks. Passing the no-regression gate is not physical smoothness acceptance. No exact FPS, thermal/battery improvement or universally leak-free result is inferred. Detailed paired and memory evidence: PERFORMANCE_REPORT.md.

No new BLOCKER/CRITICAL/HIGH detected by completed gates; original real-device symptom is not marked empirically fixed. Existing MEDIUM/LOW gameplay/UI/signing limits in the historical sections remain explicit.

---

# Camera / map pass — archived 0.8.0 regression evidence (2026-10-09)

Primary physical defect: severe camera pan/zoom/navigation lag. Paused old-release native captures isolate a renderer/input contribution without assuming AI/economy is the main bottleneck. Coverage churn, repeated geometry/path materialization and unbounded glyph nodes are addressed with retained transferable raster tiles, stable native paths/border chunks, prepared pinch detail and hard label/army budgets. Gameplay/world/schema/backend are unchanged.

Introduced defects caught before delivery:
- CRITICAL pooled-layout crash in the first equal-viewport guard: fixed by capturing primitive dimensions before enqueueing React's updater; a regression recycles/mutates the event before evaluating the updater.
- CRITICAL transparent static map with JS-thread GPU snapshots: fixed by retaining raster images transferable to the Canvas context. Native screenshot checks reject labels/armies drawn over an absent base map.
- HIGH pinch detail churn/cold-frame spike: prepared detail stays fixed while zooming in, lowers for zoom-out coverage and refines at settle; country geometry identity is reused. Native paired pinch p95 is now a publishing gate.
- QA profiler lacked its new PNG decoder dependency: the auxiliary baseline workflow installs the pinned dependency and is verified separately; the release workflow already installs it.

The rejected native candidate's faster pan timings are excluded because its geography did not paint correctly. Failed/cancelled candidates were not delivered or published as the accepted release.

Historical 0.8.0 acceptance completed: workflow **37962664267**, all five jobs PASS, actual native images and 1,839.26-second soak / 30 PSS samples reviewed (`NATIVE_CAMERA_080_SMOKE_REVIEW.json`). That checked intermediate binary is superseded by final 0.8.1 above.

175 JS / strict TS / 10 Python tests and fifteen asset checks passed. Historical 0.8.0 full native screenshots, portrait/construction/government/religion assertions, paired camera timings, ten thousand authoritative ticks, save/process/reboot/layout/preset checks and 30-minute soak also passed. Real online multiplayer/reconnect are covered by protocol/reducer tests and prior unchanged-backend live evidence; no new production rooms or gameplay backend writes were made in this pass.

Physical Redmi Note12 pan/zoom acceptance remains **OPEN** for the user's new APK test; no exact hardware FPS or completely eliminated lag claim.

---

# Dominion visual update — regression acceptance (2026-10-09)

Android delivery follow-up: user reports download stops at 100% / 140.11MB before installation. Client/browser cause is **unconfirmed**; no APK-invalid/install-error diagnosis inferred. Accepted APK/native install and public checksum gates still pass. Alternative public ZIP **https://github.com/elcin31/grand-strategy-multiplayer/releases/download/v0.7.0-visual-update/Dominion-visual-update-release.zip** (58,446,169 bytes), publisher run 37935645382/job 113836879926 PASS including unauthenticated ZIP download, CRC and exact enclosed APK hash. This is a delivery mitigation; user-device download/installation acceptance remains OPEN pending feedback.

Final workflow **37918487336 all PASS** on runtime **c758ed78f586268809a2184a064ae7fdadc5156e**: TS/167 JS/3 Python/world/map/art/10,000 ticks/ten restores/native smoke/30-minute soak. Live backend QA 37911320238 PASS. No known unresolved BLOCKER/CRITICAL/HIGH introduced by this update in the completed gates; existing unrelated limits below retained.

Fixed this session: truncated economy WebP; menu-intent discriminant; stale unused province chunks entering pruning; exact round-to-5,411 target; old static city links on wire hydration; fractional city-growth aggregation; advisory metadata corruption/counting; unawaited Expo57 File.move and optional-index overwrite; intrinsic-size background gaps; clipped nested statistics; feedback behind Android safe area. Migration/world/save/wire/authority checks preserve exact population/ownership/backups. Final native painting/stat bounds and actual screenshots verify corrections.

Native API35 job **113787009485 PASS**, evidence **11613239385**. Exactly one Singleplayer tap and one Start tap; disabled Continue without save, menu/pages/Back, visible launch feedback, real campaign commands, four presets/twelve map modes, pan/double-tap, five layouts, density/cutout, process/reboot recovery and detached 12-tick benchmark pass. Actual final menu/new-campaign/loading/map/economy/diplomacy/government/dense screenshots reviewed. Native assertions enforce full painting coverage and un-clipped statistics. Continuous render/simulation/autosave soak **1,836.65 seconds**, no fatal JS/native logs.

Original physical Redmi lag remains **OPEN for hardware validation** with the delivered APK. Measured host improvements are documented; no achieved 60 FPS or leak-free claim. SwiftShader frame times/jank remain poor and are not marked as meeting physical smoothness targets.

---

# PASS 3 — Start Game / Singleplayer delayed interaction — HIGH — FIXED

Root cause addressed: heavy synchronous campaign/geometry initialization and full-save listing validation could occupy JS after a valid tap, while the existing loading latch alone did not make the heavy work cooperative. V4 yields between initialization stages and 64-feature geometry chunks, renders a loading shell, reuses world preparation, reads only save metadata on entry and avoids repeated full normalization in the private local reducer. Existing docked controls and synchronous duplicate latch retained; failures clear loading and expose the error.

161-test suite includes first tap, ten rapid taps = one campaign, slow initialization feedback, failure/retry and actual campaign launch regressions. Native release run 37725176471/job 113144846787 PASS: one Singleplayer tap and one Start tap, no repeat-tap fallback; running campaign, save/reboot restore and 30-minute soak verified. Instrumented trace records launch stages; two RAF callbacks are not a GPU paint-latency measurement.

Physical performance acceptance remains OPEN: confirmed Redmi lag motivated this update; only the user's v4 test can establish physical smoothness. No code-level BLOCKER/CRITICAL/HIGH detected by the completed gates. Old topology saves are explicitly rejected with a compatibility explanation and remain untouched.

---

# PASS 2 launch regression — HIGH — FIXED

Start/singleplayer first tap: fixed docked launch controls, immediate loading, synchronous duplicate latch and failure recovery. The previous native harness retried Start up to four times, masking the reported behavior; that retry is removed. Regression tests cover first launch, slow completion, duplicate taps, failure/retry, repeat sessions and actual LocalTransport start. Release run 37576520835 / native job 112740679221 PASS: exactly one singleplayer tap and one Start tap, followed by a running campaign. Thirty-minute stress, restore and reboot checks also pass. Evidence artifact 11478246984. This closes the launch defect at code/CI/native-emulator level; real-device performance remains open.

# PHYSICAL-DEVICE PERFORMANCE ACCEPTANCE — OPEN

The original severe Redmi Note 12 lag report triggered the completed 0.4.0 optimization session. Code-level optimization, regression, release build, native emulator smoke, detached 12-tick benchmark and 1,200-second software render/simulation/autosave soak now PASS in final workflow **37564792672**.

This does **not** mark the physical-device lag report as empirically fixed. Physical 30/60 FPS, thermals and battery behavior remain unverified until the new **Dominion-optimized-v3-release.apk** is tested on real hardware. No unresolved code-level BLOCKER/CRITICAL/HIGH was found by the completed CI/native-emulator checks.

---

# Bug report — 2026-10-05

Current scope: final five technical hardening blocks, recovered main 701c37a. Historical reports remain in Git history and WORLD_UPDATE_STATUS.md. Missing future roadmap systems are tracked as future work rather than mislabeled completed features.

| Severity | Issue | Current result |
|---|---|---|
| CRITICAL — FIXED | Recovered deployed game-command saves compressed state but old game-room reads null after first write | Source already handled both codecs. Both functions now deployed together: v15/v12. Full two-player live runs 37197530326 and final 37216306929 PASS, including post-write reads/guest recovery. |
| HIGH — FIXED | Winning combat used a 1,000 troop floor that could yield negative losses for a small army | Nonnegative bounded losses; no fabricated survivors. Existing combat conservation regressions pass. |
| HIGH — FIXED | Prototype could conquer a foreign province without declared war or treaty checks | Authoritative diplomatic guards, truce protection, defensive coalitions; regression tests pass. |
| HIGH — FIXED | AI could recruit in an occupied province and abort the monthly tick | AI recruitment filters controlled provinces; occupied-country tick regression passes. |
| HIGH — FIXED | A vassal could be on both sides of a war or bypass its own treaty/truce | Coalition disjointness and all participant-pair treaty/truce checks; regressions pass. |
| HIGH — FIXED | Occupied/rebellious provinces could keep national building bonuses | National building aggregation excludes unavailable provinces. |
| HIGH — FIXED | Empty cancellation or Rival → Cancel could impose a free unilateral truce; a guarantor could attack its beneficiary | Empty cancellation rejected; only actual bilateral treaty cancellation creates truce; guarantee must be cancelled before war. Unit and live server regressions pass (23bfacb, run 37216306929). |
| MEDIUM — FIXED | Initial native smoke expected a plain army size, while the new selection mark altered that string | Selection remains accessible; plain troop text and quick recruitment are preserved. Full native smoke runs 37197530313 and final 37216306934 PASS. |
| MEDIUM | Vassal tribute adjusts server treasury after monthly economy; HUD budget currently shows pre-tribute balance | Explicit limitation. Add separate incoming/outgoing tribute ledger before expanding vassal economy. Funds are bounded by available cash. |
| MEDIUM | No coalition allied-land transit; each participant moves through own controlled land or attacks wartime enemies | Current military/diplomacy limitation; allies still enter defensive wars and fight on their fronts. |
| MEDIUM | Physical Android 30/60 FPS and sustained memory/thermal behavior unverified | Physical acceptance remains unverified; software emulator/CPU timings are not proof. |
| HIGH — FIXED | Restart lost offline campaigns and multiplayer identity; repeated commands could be applied twice | Atomic offline generations, SecureStore reconnect/pending intent, server command receipts/CAS. Unit and live protocol-v2 checks pass. |
| LOW | Some long labels/costs in two-column province cards clip at narrow panel widths | Observed in final emulator screenshots; remaining cosmetic wrapping/card-sizing follow-up after the Phase 20 layout changes. Actions and server costs remain functional. |
| LOW | Original terrain and resource distributions are procedural scenario abstractions | Explicitly documented; not real-world topographic/geological data. |
| LOW | Sparse diplomacy can include all country pairs; histories/proposals are bounded; completed 10,000-tick snapshot stayed below 4.91 MB | Current 195-state roster bounds pair count; strategic AI is now integrated. |

Current final verification: strict TypeScript, 134 JS tests and 3 Python tests PASS. Live QA 37410899062 and complete Android release workflow 37410899043 PASS, including 10,000 ticks and reboot recovery. See RELEASE_REPORT.md for exact coverage and limits.

Native regression fixed during this session: **HIGH — FIXED** quadratic city/province save validation could stall input while autosave accumulated work. Indexed ownership validation and coalesced autosave remove this repeated work; invalid city ownership still rejects with a dedicated regression. Commit `6bf988f`; 124 tests and native gameplay checks pass.

Additional current limits:

- MEDIUM: command receipts are retained for the campaign lifetime. A future bounded-retention design must reject old replay IDs, not silently remove deduplication protection.
- MEDIUM: background online simulation is poll-driven by any connected member; all-offline campaigns are dormant with bounded catch-up. This is intentional current behavior.
- LOW: credentials restore on the same app installation; cross-device account recovery is not implemented.
- HIGH — FIXED: map army/city hit targets initially intercepted country selection in the lobby. Selection callbacks now activate only inside a campaign.
- HIGH — FIXED: map selector could exceed the available height on high-density landscape displays; it now has bounded height and scrolling, with a density/cutout native smoke step.
- LOW — FIXED: HUD formatted million-unit treasury as KM; it now uses M/B. Foreign-army context is visible without commander assignment controls.

No known unresolved BLOCKER/CRITICAL/HIGH at this checkpoint. Final Android acceptance passed, including density/cutout, persisted campaign restart and Back/exit cancellation. Physical-device FPS remains unverified; no further phase is being opened.

## Final hardening — block 2

- HIGH — FIXED: an outstanding money peace offer can become unaffordable before AI takes control of a disconnected player. AI called peaceCost without handling this legal state change, aborting the entire simulation tick. Reproduced with a failing regression; AI now declines obsolete terms. A genuine invalid command still rejects at the authoritative boundary.
- Audit covered the shared command validator, combat/occupation/peace, government/religion/population/economy/resources/buildings/research normalizers, save generations, presence, transport and existing 124-system regression suite. Typecheck and 126 tests pass after the above fix. Randomized, concurrent and extended simulation checks follow in blocks 3–4; no claim that static review proves absence of defects.

## Final hardening — blocks 3–4

- HIGH — FIXED: imported Natural Earth province IDs containing `+`/`?` were rejected by command and peace-term validators. The first full simulation stopped at tick 1,850. Province validation now accepts those literal characters while exact lookup, ownership, adjacency and authority checks remain mandatory. Regression covers a real Monaco province and AI territorial terms; unknown identifiers still reject. No ID renaming or save migration.
- HIGH — FIXED: AI territorial peace left national monthly population growth and religious unity stale until save normalization. Strict equality failed on the 2,000-tick save/restore checkpoint. The monthly authoritative tick now refreshes both derived totals after AI actions. Regression reproduces and verifies identical state across save/restore.
- HIGH — FIXED: HTTP functions previously parsed unbounded JSON before structural validation. Both endpoints now cap streamed request bodies at 32 KiB and validate root/session/envelope fields before DB access. Existing transactional rate limits remain authoritative; an early authenticated rate check avoids expensive reducer work for spam.
- Security coverage: seeded modern-world intent/spoof sequences, malformed/oversized input, six durable replay cases, six reducer/CAS race scenarios. Network harness covers delayed/lost responses and persisted retry after client recreation. Direct rollback-only PostgreSQL receipt/CAS/rate/expiry/privilege checks pass. Live HTTP CI 37410899062 passed final acceptance; local proxy failures are not counted as passes.

## Final release limitations

- MEDIUM: physical 60/30 FPS targets are unverified. Software-rendered emulator camera sample had 25/31 janky frames; do not interpret emulator startup success as performance acceptance on hardware.
- MEDIUM: release variant uses the existing Android test signing certificate for compatibility with prior sideload builds. It is non-debuggable and self-contained, but a separate production signing process is required for store distribution.
- Diagnostic note: the longest simulation war is Mexico versus deliberately idle human USA, which receives WhitePeace offers. Automatically accepting them would violate human command authority. AI-only wars in diagnostic continuation through tick 7,000 ended within 11 ticks.
