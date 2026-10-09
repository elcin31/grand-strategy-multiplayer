# Camera / map pass — regression status (2026-10-09; native validation pending)

Primary physical defect: severe camera pan/zoom/navigation lag. Paused old-release native captures isolate a renderer/input contribution without assuming AI/economy is the main bottleneck. Coverage churn, repeated geometry/path materialization and unbounded glyph nodes are addressed with retained transferable raster tiles, stable native paths/border chunks, prepared pinch detail and hard label/army budgets. Gameplay/world/schema/backend are unchanged.

Introduced defects caught before delivery:
- CRITICAL pooled-layout crash in the first equal-viewport guard: fixed by capturing primitive dimensions before enqueueing React's updater; a regression recycles/mutates the event before evaluating the updater.
- CRITICAL transparent static map with JS-thread GPU snapshots: fixed by retaining raster images transferable to the Canvas context. Native screenshot checks reject labels/armies drawn over an absent base map.
- HIGH pinch detail churn/cold-frame spike: prepared detail stays fixed while zooming in, lowers for zoom-out coverage and refines at settle; country geometry identity is reused. Native paired pinch p95 is now a publishing gate.
- QA profiler lacked its new PNG decoder dependency: the auxiliary baseline workflow installs the pinned dependency and is verified separately; the release workflow already installs it.

The rejected native candidate's faster pan timings are excluded because its geography did not paint correctly. Failed/cancelled candidates were not delivered or published as the accepted release.

FINAL_BUG_ACCEPTANCE_PENDING

175 JS / strict TS / 10 Python tests pass locally. Fifteen asset checks pass. Full native screenshots, portrait/construction/government/religion assertions, paired camera timings, ten thousand authoritative ticks, save/process/reboot/layout/preset checks and 30-minute soak must pass before delivery. Real online multiplayer/reconnect are covered by protocol/reducer tests and prior unchanged-backend live evidence; no new production rooms or gameplay backend writes are made in this pass.

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
