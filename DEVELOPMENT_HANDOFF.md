# Dominion 2.1.1 checkpoint

- Branch: `dominion-2.1.1-warfare-interface-art`; HEAD before this checkpoint `9a2febb`; base HEAD `244efd0`, verified 2.1 release/runtime `08a7545` (`v2.1.0-playtest.1`).
- Completed: START conflict recovery, durable retry after lost reply, authenticated idempotent server launch; per-action lobby pending/error controls and tap latch; bounded Android paint wait. Same Dominion project `dfjsnjxnyjspwugjguhq`; game-command-v21 v3 deployed, old 2.0 endpoints untouched.
- Root cause evidence: actual ready two-player room remained in lobby after repeated 409 responses; START lacked CAS rebase. Launch previously also depended on unbounded RAF before dispatch.
- Checks: typecheck passed; 11 focused startup/control checks passed. Live two-client scenario passed: create/join, countries, ready/start, both map geometries, one order each, calendar, reconnect (report `DOMINION_211_MULTIPLAYER_QA.json`); synthetic rooms cleaned. No native two-device claim.
- Current: compact 48dp HUD, 48dp icon rail, central header-only draggable windows, compact/expanded modes, government/economy/diplomacy tabs, compact mini-map and contextual legend implemented; typecheck passed. Native touch checks remain for final APK. Existing mechanics/counts retained.
- Next: military/calendar, war indicator and peace clauses, audio/art and one release build. Update this file after each logical commit. No long simulation/soak/camera audit.
