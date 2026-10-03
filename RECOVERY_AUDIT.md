# Recovery audit — 2026-10-03

Source of truth at recovery: remote main `67e2936`. Previous work was preserved in open PR #1 / `world-update` at `392ab36`, 166 changed files, not in main. Main was fast-forwarded without rewriting history to preserve that work. No new repository or branch was created.

The previous last documented completed phase was 8. Phase 9 source `f631efa` passed native standalone/offline smoke (36975556052), dedicated live QA (36975555995), and the previously unrecorded 10,000-tick CI run 36985831373 completed successfully. Its job 110770517044 ran the real authoritative benchmark; artifact 11218196427 preserves the report. Latest checkpoint Android run 36985831246 also passed. Current dedicated backend is game-command v10 / game-room v9, confirmed ACTIVE. These facts do not establish physical-device FPS or final release acceptance.

## Recovered implementation, now integrated in main

DONE means the scoped phase implementation and recorded automated gates passed; device/final acceptance is tracked separately. Some phases overlap: resources are Phase 10 even though Phase 9's budget reserves a resource-income field.

| Phase | Status | Code evidence / remaining work |
|---|---|---|
| 1 Map | PARTIAL | Skia WorldMap, camera, spatial culling, batched polygons, LOD, tilt, gestures and standalone emulator gates; physical-device profiling pending |
| 2 Countries | DONE | world catalogue and shared definitions: 195 UN member/observer states, not every disputed entity/territory |
| 3 Provinces | DONE | 4,386 polygons, symmetric land adjacency, owner/controller, linked campaign data |
| 4 Cities | DONE | 7,214 cities, capitals, viewport/collision-aware labels |
| 5 Rulers | DONE | seeded leaderGeneration, skills/traits and procedural initial avatars |
| 6 Governments | DONE | ten policies, authenticated costs/cooldown/modifiers and UI |
| 7 Religion | DONE | country policy, province identity, denominations, unity/unrest, paid command and UI |
| 8 Population | DONE | monthly province/city growth, integer/carry safety, urban conservation, ownership totals |
| 9 Economy | PARTIAL | taxes, commerce, upkeep, debt/default tested; newly found stale budget after faith change needs fix; commodity income depends on Phase 10 |
| 10 Resources | NOT STARTED | no deposits/production; resource-income ledger is zero |
| 11 Buildings | NOT STARTED | no construction model or commands |
| 12 Technology | PARTIAL | scalar technology and passive government-modified growth only; five branches absent |
| 13 Military | PARTIAL | real authoritative recruitment, adjacency movement and deterministic conquest; unit types, generals, morale, organization absent |
| 14 Diplomacy | NOT STARTED | no war/treaty/peace model; direct neighboring conquest remains prototype behavior |
| 15 Stability | PARTIAL | stability/unrest from policy/taxes/religion; rebellions absent |
| 16 AI | PARTIAL | simple recruitment and nearby conquest with budget guard; personalities/strategic diplomacy absent |
| 17 Multiplayer | PARTIAL | room codes, 8-player server join gate, hashed bearer auth, RLS, CAS and version polling; durable client sessions/idempotency/checksum/reconnect/host migration absent |
| Save system | PARTIAL | server room JSON persists; offline transport is in-memory, no manual save/restore |
| 18 UI/modes | PARTIAL | landscape config/safe areas, actual economy/policy/province actions; eight backed modes, incomplete navigation/HUD |
| 19 Performance | PARTIAL | GPU/culling/cached geometry and CPU benchmarks; 30/60 FPS on physical Android unverified |
| 20 QA | PARTIAL | command fuzz, ownership/combat, migration, map, 68 original JS tests, Python/native/live and 10,000 ticks; concurrency/chaos/final gameplay QA incomplete |
| 21 Release | PARTIAL | standalone checkpoint APK built with embedded JS/Hermes/Skia; final full-roadmap release unavailable |

No phase is marked BROKEN solely because future requirements are absent. Unfinished roadmap acceptance is not an existing crash. Existing critical bugs must be fixed before later features. First concrete continuation: correct the Phase 9 stale budget, then implement Phase 10. The outstanding physical-device gate cannot be inferred from emulator/CPU results.

## Files inspected

Reviewed commit progression and major diffs; README/status/bug report; App, components, map scene/camera/settings; shared types/world factory/reducer/policy/demography/economy/validation; transports and Edge handlers; sole SQL migration/RLS/CAS; data pipeline/licensing and generated data counts; all workflow definitions and test inventory. No AGENTS.md is present. No lint command/config exists; strict TypeScript covers unused locals/parameters. No local Android SDK/device is assumed.
