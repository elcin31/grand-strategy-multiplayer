# World update QA — ongoing

This is a running report, not the final Phase 20 QA acceptance.

## Fixed during renderer work

| Severity | Issue | Fix / verification |
|---|---|---|
| CRITICAL | Server accepted unknown countries and untyped command fields | Shared JSON schema guard; client/server rejection and actor-spoof tests passed; deployed to dedicated backend as game-command v3, live malformed-command/security smoke passed; isolated QA room removed |
| CRITICAL | Host could bypass ready checks by setting speed in lobby | Lobby/start/pause transitions enforced on both engines; live malformed-command/security smoke passed; isolated QA room removed |
| HIGH | Recruitment and movement controls on pause were rejected by both reducers | Permit validated orders in running/paused campaigns; paid recruitment, ownership, adjacency and frozen-clock regression/fuzz tests and dedicated live-backend smoke passed; standalone release and Android gameplay smoke passed on 0e05df5 |
| HIGH | Rectangular grid could not identify geographic territories | Geographic polygons, holes/islands and interior-anchor tests |
| HIGH | Scroll layout competed with map gestures and left little map space | Dedicated landscape canvas and collapsible overlay panel |
| MEDIUM | No camera bounds or zoom invariants | Finite-value clamps and focal-point round-trip tests |
| MEDIUM | Coastal city taps could miss generalized land | Marker hit testing uses assigned province; coordinates checked within coastline tolerance |
| MEDIUM | No native build or embedded-bundle test gate | CI release archive validation and Android cold-launch smoke job |
| MEDIUM | APK verifier assumed the old Hermes library filename | Accepts installed Hermes native library variants, prints actual names; repeat CI |
| MEDIUM | Army counters obscured France/Germany labels | Rectangle collision placement and short-name fallback; Android release/emulator smoke passed on d870789 |
| MEDIUM | Country labels shifted outside France and Italy | Interior land placement, horizontal fit and ownership-change regression test; Android release/emulator smoke passed on d870789 |
| HIGH | Full-world label preparation scanned too many province candidates (~7.8 seconds) | Cached spatial lookup, bounded candidates and scanline fit reduce measured CPU time to ~102 ms for 4,386 real provinces; CI benchmark includes labels |
| HIGH | Camera movement repeatedly rebuilt scene batches | Movement/zoom thresholds reduce JS culling updates; physical-device profiling still pending |
| LOW | Entry copy incorrectly claimed local transport for online rooms | Corrected copy; offline entry is now a separate real transport |

| HIGH | Duplicate client/server reducers could drift during world migration | One shared reducer/types; 40 tests include authenticated/local world-country selection parity and seeded leader generation |
| HIGH | Bounded logs and deleted armies could reuse IDs in the same paused tick | Monotonic persisted entity sequence; 60 same-tick battles keep unique IDs after truncation |
| HIGH | Room join retries could admit a ninth player or join a started campaign | Fresh CAS admission guard, immutable rejection tests and failed-membership cleanup |
| HIGH | Unchanged full-world snapshots would be retransmitted every 900 ms | Version-aware polling; deployed room v3 is ACTIVE, create/join endpoint smoke remains pending |
| HIGH | The full world catalogue exceeded the Edge bundler per-module source limit | Generator now emits 83 bounded modules; dedicated `game-room` v3 bundles all modules and is ACTIVE |
| LOW | Six unused TSX imports | Removed; noUnusedLocals/noUnusedParameters enabled and passed |
| MEDIUM | New countries had no ruler identity or campaign portrait seed | Added a deterministic fictional leader to each of 195 modern-world states; deterministic/variation and stat-bound tests pass; dedicated room v4 ACTIVE; standalone release and emulator gates passed on deaf659 (CI 36883315047) |

## Open release gates

| Severity | Gate | Status |
|---|---|---|
| BLOCKER | Complete global world-update acceptance criteria | Not implemented yet; world data wired into new campaigns, further gameplay/release criteria pending |
| BLOCKER | Live endpoint smoke and full global world-update acceptance | Android release verifier/offline gameplay smoke passed on `deaf659` (CI `36883315047`); dedicated production full-world two-player create/join/gameplay/government/sync/cleanup flow passed on 2026-10-01; remaining requested gameplay systems are incomplete |
| HIGH | Physical-device map FPS and gesture profiling | Pending; CPU query benchmark is not proof of 30/60 FPS |
| HIGH | Save/reconnect/host migration and multiplayer chaos testing | Scheduled Phase 17/20; not claimed working |
| HIGH | Remaining map modes backed by authoritative schemas | Scheduled later phases; unavailable modes are not mock buttons |

The current dedicated backend deployments are game-command v6 and game-room v5 (both ACTIVE). Their world-specific HTTP create/join/gameplay/government/sync/cleanup smoke passed. The government Android gate passed on `06e71d8`; the legend follow-up `3a43965` also passed (run `36895304619`). Android checkpoint run `36877387395` passed standalone APK verification and offline emulator gameplay. The final world-update APK must not be released while BLOCKER/CRITICAL gates remain open.

## Government phase checkpoint

Ten policy types, authoritative costs/cooldown, monthly effects, categorical map colors and older-world initialization are implemented. Strict typecheck, 48 JS tests and 3 Python tests pass. The government suite verifies policy tradeoffs, malformed payloads, actor spoofing, immutable rejection, payment/cooldown boundaries, migration, legacy isolation and map updates. Deployed endpoint verification passed; the isolated room and memberships were removed and zero remaining records verified. Standalone Android build/emulator passed on government source `06e71d8` (run `36893464515`); legend follow-up `3a43965` also passed its native gate (run `36895304619`). A categorical Government legend was corrected to avoid describing it as a numerical gray-to-gold scale.

The existing full-world reducer stress harness completed 10,000 ticks without triggering its finite/nonnegative-balance, positive integer troop, unique army-ID, advancing-clock or bounded-battle-log checks. Final snapshot 2,964,771 bytes, 1,079 armies. This is a partial Phase 20 checkpoint; chaos/security, explicit war states and physical-device memory/FPS verification remain open.

## Screenshot-driven regression fix awaiting native verification

| Severity | Issue | Fix / verification |
|---|---|---|
| HIGH | High/Ultra regional city labels overlapped each other and army counters in dense European regions | Bounded, deterministic label placement with capital/population priority, alternate positions, viewport bounds and collision rejection. City markers and hit testing remain available. Two dense/real-world layout regressions pass; 48 JS tests pass. Native follow-up and screenshot review pending. |
