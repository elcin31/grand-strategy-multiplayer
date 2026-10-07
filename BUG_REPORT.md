# PHYSICAL-DEVICE PERFORMANCE ACCEPTANCE — OPEN

The original severe Redmi Note 12 lag report triggered the completed 0.4.0 optimization session. Code-level optimization, regression, release build, native emulator smoke, detached 12-tick benchmark and 1,200-second software render/simulation/autosave soak now PASS in final workflow **37564792672**.

This does **not** mark the physical-device lag report as empirically fixed. Physical 30/60 FPS, thermals and battery behavior remain unverified until the new **Dominion-optimized-v2-release.apk** is tested on real hardware. No unresolved code-level BLOCKER/CRITICAL/HIGH was found by the completed CI/native-emulator checks.

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
