# Development handoff — 2026-10-05

## Scope and recovered baseline

Only `elcin31/grand-strategy-multiplayer` and its dedicated Supabase backend `dfjsnjxnyjspwugjguhq` were used. No AssetMind resources, new repository, project copy or reset.

Recovered main `8cde76f4a941f5b3015d83a6ab4720dfa4f0f260` genuinely completed Phase 16. Its shared reducer, stability/rebellion integration, tests and prior successful Android/live checks agreed with the previous handoff. This session implements exactly **17 → 18 → 19 → 20 → 21**. It does not implement Phase 22–26. Older audit/status documents describe historical checkpoints.

## COMPLETED THIS SESSION

### Phase 17 — AI 2.0

Before: simple recruitment/neighbor attacks and deterministic treaty replies. Added ruler-linked Defensive, Diplomatic, Expansionist, Economic and Militarist personalities; strategic context and legal score-based war decisions; treasury reserves and maintenance limits; economic buildings, resources and research; capital/front protection and terrain/fort/readiness-aware attack scoring; relations, pacts, alliances, rivals and peace/vassal evaluation. Six-tick staggered evaluations share a province index; bounded tactical decisions avoid per-frame world analysis. No random war coin flip. Shared local/server reducer runs the same AI; connected human countries are excluded.

Main files: `supabase/functions/_shared/aiSystem.ts`, `gameEngine.ts`, `gameTypes.ts`, `stateMigrations.ts`; `tests/ai_system.test.ts`. Schema 8. Tests cover truce, suicide avoidance, budgets, economic/defensive priorities, personality scoring, peace and deterministic 36-month multi-country simulation. Phase gate: typecheck + 109 tests. Commit `1254cae`.

### Phase 18 — Multiplayer 2.0

Before: server rooms and CAS, but restart lost client identity; host supplied ticks; no durable command receipt. Added native SecureStore session metadata/credentials and pending intent; authenticated reconnect/full snapshot recovery; version/hash checks; same commandId retry after lost response; serialized client submissions; expiry and connection errors. No server secret is stored on client. Eight-player limit, disconnected after 20s and temporary exclusive AI control after 60s; reconnect reclaims the same country. Host privileges migrate to a connected member. Any authenticated member's poll drives elapsed **server** time, bounded to three ticks; the client cannot request ticks. All-offline campaigns remain dormant.

DB migration `20261004172720_multiplayer_sessions_commands.sql`: presence/expiry/activity fields, RLS-protected receipts and service-role-only atomic `commit_game_command`. Row locks serialize version check, receipt, rate counter and snapshot write. Same-ID same-intent replay returns success without applying again; collisions/stale revisions return 409. Limit: 40 committed commands / 10s / player. Sessions expire after 180 days.

Main files: `src/multiplayer/{httpTransport,sessionStore,transport}.ts`, `_shared/{sessionState,roomServer}.ts`, `game-room/index.ts`, `game-command/index.ts`, App saved-session/reconnect UI. Schema 9. Phase gate: typecheck + 113 tests. `tests/multiplayer_v2.test.ts`, live HTTP smoke, and rollback-only `tests/multiplayer_rpc.sql` exercise transport restart/replay, timeout/control return, guest clock, capacity, atomic receipts/stale writers/rate/expiry/privileges. Commit `1009a18`.

### Phase 19 — Save / persistence

Before: compressed server snapshots only; offline campaign disappeared with process. Added offline manual save, 10s/background autosave, load/delete and campaign metadata/list. Serialized writes use validated pending files then immutable generations; retain last two complete generations. Partial pending files do not replace a valid save. A corrupt latest generation reports an error and blocks autosave overwrite until explicit deletion; no silent rollback. LocalTransport restores the original player identity.

Central codec validates core structure/ownership/finite values, runs ordered migrations and normalization, rejects unsupported future schema. Both legacy JSONB and compressed server reads normalize a cloned snapshot. Main files: `src/persistence/{campaignCodec,campaignStore,nativeCampaignStore}.ts`, `localTransport.ts`, App, `_shared/{stateMigrations,stateStorage}.ts`. Tests: save/load on new store instance, missing legacy fields, future/invalid ownership, corruption, interrupted rename, queued saves and bounded generations. Phase gate: typecheck + 117 tests; immutable legacy read regression corrected separately. Commits `bb9566d`, `0bbe20c`.

### Phase 20 — Landscape UI

Before: landscape native configuration with one long all-system panel. Added permanent compact horizontal HUD; seven-section navigation; width-aware right panel; country/economy/military/diplomacy/technology/government/religion views; province/city/army context. Native safe-area container is retained. Back priority is keyboard → map modal → context → secondary panel → exit confirmation, with save flush. Primary navigation/speed controls use 44px minimum targets, long names flex/wrap and quick panel transitions.

Main files: `src/ui/landscape.ts`, `src/components/{LandscapeHUD,GamePanel,MilitaryPanel,WorldMap}.tsx`, App, expanded existing strategy panels. Tests: layout dimensions and Back precedence, upgraded Android smoke for 1280×720, 1600×720, 1920×1080, 2340×1080 and 1280×800, saved-campaign process restart. Phase gate: typecheck + 119 tests. Commit `0a9aba5`.

### Phase 21 — Map modes / visual polish

All twelve modes now derive from real snapshots: Political, Diplomatic, Relations, Economy, Population, Religion, Government, Military, Resources, Terrain, Stability, Development. Correct viewing-country relations/treaties/war colors; terrain palette; real categorical/heatmap legends. Compact selector reuses existing GPU renderer and cached geometry. Added controller-colored occupation fill/outline, wartime borders, bounded recent movement paths, construction progress, grouped army counters, selected army/city context, focus controls and capital/major/regional label LOD. Movement remains the existing instant authoritative action; paths show recent events, not a fictional unfinished order.

Main files: `src/map/{modes,overlays,scene,settings}.ts`, `WorldMap.tsx`, App/GamePanel, `_shared/movementHistory.ts`, reducer/types/migrations. Schema 10 initializes/validates bounded movement history. Tests validate all modes/legends, reference country, treaties, terrain, troop conservation, migration/history validation; existing camera/culling/label tests retained. Gate: typecheck + 123 tests; existing CPU map benchmark passed (not device FPS). Commit `609eba7`; follow-up `b5f8c34` preserves lobby map country picking and read-only foreign-army context, clears stale selection, fixes HUD currency units.

## CURRENT PROJECT STATUS

Latest implemented phase: **PHASE 21**. Final Android/live acceptance is still being checked; do not treat this draft as the final CI result until the CI section below is updated.

Modern GameState schema: **10**. Ordered normalization retains old modern campaigns; future/invalid saves are rejected clearly. Shared reducer remains source of game rules. Online client sends intent only; treasury, ownership, army/combat, construction, research, government, resources and diplomacy/peace remain server authoritative.

Backend functions deployed together from Phase 21 shared source: `game-room` **v15**, `game-command` **v17**. Custom campaign bearer-token validation is why gateway JWT verification remains disabled. DB migration applied; anon/authenticated cannot call the mutation RPC. SQL rollback checks passed, including expiry and rate limiting.

## NEXT PHASE

**PHASE 22 — PERFORMANCE.** No Phase 22 implementation/profiling campaign was started. Current CPU benchmark is only the existing Phase 21 regression gate. The old automatic 10,000-tick workflow is now manual-only to avoid silently starting Phase 25 in this scoped session.

## NEXT FIVE RECOMMENDED PHASES — not implemented

1. Phase 22 — Performance: physical-device FPS, sustained memory/thermal profiling; optimize measured bottlenecks.
2. Phase 23 — Hard Bug Hunt.
3. Phase 24 — Fuzz / Chaos / Security Testing.
4. Phase 25 — Long Simulation / Release Hardening.
5. Phase 26 — Android Release.

## BUGS / limitations

See `BUG_REPORT.md`. Pending final CI acceptance is tracked separately from implementation. No new feature beyond Phase 21 should be added while finishing these gates.

- AI is a deterministic heuristic with local neighbor tactics; no global path planner. One active war per country and no allied-land transit remain existing game rules.
- Offline multiplayer clock is poll-driven/dormant, with bounded catch-up; it is host-independent but not a continuously scheduled background service.
- Device-local SecureStore credentials restore on the same installation; no account/cross-device credential recovery UI.
- Command receipts currently retain campaign lifetime history; future retention must preserve replay guarantees, not simply delete old receipt IDs.
- Tribute is reflected in treasury but the monthly budget line still precedes tribute transfer.
- Physical Android FPS, thermal behavior and all physical cutout variants remain future device acceptance; emulator/CPU timing is not proof.
- Terrain/resources are authored procedural game abstractions, not real-world topography/geology.

## CI

- Local strict TypeScript: PASS.
- Local JavaScript tests: **123/123 PASS** (includes 36-month AI simulation, not Phase 25).
- Python: **3/3 PASS**, with pinned Shapely dependency.
- Existing CPU map spatial-index regression: PASS; 5,000 features, p95 query 0.035ms, maximum 266 visible. Not Android FPS.
- Direct dedicated-DB rollback RPC checks: PASS; no retained fixture data.
- Live HTTP QA: run **37285016137 PASS**: eight players/ninth rejection, invalid token/spoof, duplicate/stale/concurrent writes, research/building, human treaty consent, authenticated snapshot, host timeout/AI replacement/migration and same-country reconnect on schema 10. QA room `51d7d6f3-10d7-4b8e-9562-23ed8feae3cd` removed with its original-host-name guard after passing.
- Latest Android release/checkpoint CI: run **37286097964** (source `d5825c1`), pending final result. `assembleRelease` must pass bundle/native verification and emulator smoke before this gate is accepted.
- Earlier local HTTP attempts were interrupted by proxy/network errors and are NOT counted as passing. Exact QA rooms were cleaned with original-host-name guards; no user campaign was deleted.

## LAST COMMITS

- `1254cae` — Phase 17 strategic AI.
- `1009a18` — Phase 18 durable sessions and authoritative transactional commands.
- `bb9566d` — Phase 19 atomic saves/migrations.
- `0bbe20c` — immutable legacy snapshot regression.
- `0a9aba5` — Phase 20 landscape UI and restart smoke.
- `609eba7` — Phase 21 map modes/overlays/history.
- `b5f8c34` — lobby picking, foreign army context, selection reset and HUD units.
- `d5825c1` — scrollable density-safe map selector, actual package version in save metadata, SQL RPC checks and density/cutout smoke. Targeted save/map tests 8/8 and typecheck passed.

The GitHub commits preserve phase boundaries; local intermediate SHAs differed because publishing used Git Data API and verified identical trees. No force push.
