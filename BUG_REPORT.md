# Bug report — 2026-10-04

Current scope: Phases 12–16, recovered main d9a5fb3. Historical reports remain in Git history and WORLD_UPDATE_STATUS.md. Missing future roadmap systems are tracked as future work rather than mislabeled completed features.

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
| MEDIUM | Offline campaign saves and durable multiplayer client session/reconnect absent | Planned Phases 18–19, not included in this five-phase session. |
| LOW | Some long labels/costs in two-column province cards clip at narrow panel widths | Observed in final emulator screenshots; refine wrapping/card sizing in Phase 20 landscape UI. Actions and server costs remain functional. |
| LOW | Original terrain and resource distributions are procedural scenario abstractions | Explicitly documented; not real-world topographic/geological data. |
| LOW | Sparse diplomacy can eventually include all country pairs; histories/proposals are bounded but full Phase 25 growth verification remains future work | Current 195-state roster bounds pair count; strategic AI is Phase 17. |

Source verification: strict TypeScript and 103 JS tests PASS; 3 Python tests PASS. Final native/live/stress gates all PASS and are listed in DEVELOPMENT_HANDOFF.md. No known open source BLOCKER/HIGH in this session's five phases. The deployment CRITICAL is closed by live verification. No unresolved BLOCKER/CRITICAL/HIGH remains.
