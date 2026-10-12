# Dominion 2.1.1 checkpoint

- Branch: `dominion-2.1.1-warfare-interface-art`; base HEAD `244efd0`, verified 2.1 release/runtime `08a7545` (`v2.1.0-playtest.1`).
- Completed: START conflict recovery, durable retry after lost reply, authenticated idempotent server launch; per-action lobby pending/error controls and tap latch; bounded Android paint wait. Same Dominion project `dfjsnjxnyjspwugjguhq`; game-command-v21 v3 deployed, old 2.0 endpoints untouched.
- Root cause evidence: actual ready two-player room remained in lobby after repeated 409 responses; START lacked CAS rebase. Launch previously also depended on unbounded RAF before dispatch.
- Checks: typecheck passed; 11 focused startup/control checks passed. Live two-client scenario reached start and geometry preparation, both orders accepted; final assertion corrected to respect fog of war, complete run pending. No native two-device claim.
- Current: implementing compact HUD and shared central draggable windows. Existing mechanics/counts retained.
- Next: finish live scenario, then UI, military/calendar, peace clauses, audio/art and one release build. Update this file after each logical commit. No long simulation/soak/camera audit.
