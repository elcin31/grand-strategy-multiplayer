# Bug report — 2026-10-05

Current scope: Phases 17–21, recovered main 8cde76f. Historical reports remain in Git history and WORLD_UPDATE_STATUS.md. Missing future roadmap systems are tracked as future work rather than mislabeled completed features.

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
| MEDIUM | Physical Android 30/60 FPS and sustained memory/thermal behavior unverified | Phase 22 gate; emulator/CPU timings are not proof. |
| HIGH — FIXED | Restart lost offline campaigns and multiplayer identity; repeated commands could be applied twice | Atomic offline generations, SecureStore reconnect/pending intent, server command receipts/CAS. Unit and live protocol-v2 checks pass. |
| LOW | Some long labels/costs in two-column province cards clip at narrow panel widths | Observed in final emulator screenshots; refine wrapping/card sizing in Phase 20 landscape UI. Actions and server costs remain functional. |
| LOW | Original terrain and resource distributions are procedural scenario abstractions | Explicitly documented; not real-world topographic/geological data. |
| LOW | Sparse diplomacy can eventually include all country pairs; histories/proposals are bounded but full Phase 25 growth verification remains future work | Current 195-state roster bounds pair count; strategic AI is now integrated. |

Current source verification: strict TypeScript and 123 JS tests PASS; 3 Python tests PASS; live protocol-v2 QA 37285016137 PASS; direct DB rollback checks PASS. Final Android acceptance is pending in DEVELOPMENT_HANDOFF.md. Phase 25 stress was not run this session.

Additional current limits:

- MEDIUM: command receipts are retained for the campaign lifetime. A future bounded-retention design must reject old replay IDs, not silently remove deduplication protection.
- MEDIUM: background online simulation is poll-driven by any connected member; all-offline campaigns are dormant with bounded catch-up. This is intentional current behavior.
- LOW: credentials restore on the same app installation; cross-device account recovery is not implemented.
- HIGH — FIXED: map army/city hit targets initially intercepted country selection in the lobby. Selection callbacks now activate only inside a campaign.
- HIGH — FIXED: map selector could exceed the available height on high-density landscape displays; it now has bounded height and scrolling, with a density/cutout native smoke step.
- LOW — FIXED: HUD formatted million-unit treasury as KM; it now uses M/B. Foreign-army context is visible without commander assignment controls.

No known unresolved source BLOCKER/CRITICAL/HIGH at this checkpoint; Android acceptance remains an explicit gate, not a claimed pass.
