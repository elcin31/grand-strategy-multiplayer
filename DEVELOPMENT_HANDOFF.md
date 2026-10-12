# Dominion 2.1 checkpoint

- Branch: `dominion-2.1-overhaul`; metadata HEAD before this checkpoint: `0e98924274fb186781e5ae18377783e5fd912347`.
- Exact release/runtime HEAD: `08a754500de131c6b0a8947e5cd217e68e52604a`; tag `v2.1.0-playtest.1`.
- Completed: all overhaul stages — concept-inspired HUD/mini-map, calendar and shared speeds, Military/AI 3.0, 35 resources, 40 buildings, 16 production chains, 100 technologies, 120 focuses, political decisions, strategy systems, era-aware original art, integration and standalone Android APK. Six national projects and 18 regiment types.
- Checks: strict typecheck; 38/38 lean gameplay/save/authority/security checks; actual 2.0 save migration/roundtrip; live multiplayer/receipt/reconnect/actor validation; successful release build and short native launch/HUD/map/army-split/save-restart smoke. Build `38276146685`; publication `38279775927`. No long simulation, soak or camera benchmarks.
- Published: https://github.com/elcin31/grand-strategy-multiplayer/releases/tag/v2.1.0-playtest.1
- APK: https://github.com/elcin31/grand-strategy-multiplayer/releases/download/v2.1.0-playtest.1/Dominion-2.1-playtest.apk
- ZIP: https://github.com/elcin31/grand-strategy-multiplayer/releases/download/v2.1.0-playtest.1/Dominion-2.1-playtest.zip (61153443 bytes; extract APK in the phone file manager).
- Binary: 142870908 bytes; SHA-256 `266be7d09b7ee5b1528d3391538d929aed2e972493e3d30d3f8402ba28f47fc8`. Public APK downloaded by publication job and matched byte-for-byte. Same package/certificate; release 2.1.0 (11), non-debuggable, embedded Hermes, landscape.
- Backend: existing Dominion project; v21 functions v2 pinned to `7786dec`. Original game-room v22 and game-command v24 untouched. Original 2.0 branch/release/assets preserved. Offline 2.0 saves migrate to schema 23 with backup; existing 2.0 online rooms stay in 2.0. Synthetic QA rooms cleaned.
- Current: ZIP alternative published and publicly downloaded/verified in delivery run `38281006243` after a user browser stalled at 142.87/142.87 MB. Archive has the identical signed APK; app/runtime/signature unchanged; no unfinished release blockers. Known limitations: inherited camera microstutter, shared modern commander portrait, adjacent-province group defense lines, first-playtest balance.
- Next: collect user playtest feedback and make targeted gameplay fixes from this checkpoint. Detailed binary/backend identity: `DOMINION_21_RELEASE_MANIFEST.json`; short notes: `RELEASE_NOTES_21.md`.
