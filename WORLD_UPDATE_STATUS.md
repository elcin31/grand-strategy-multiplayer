# World update — work in progress

Latest verified source: `3a43965`, Android workflow `36895304619` passed standalone release verification and offline emulator smoke. Government phase source now passes strict typecheck, 48 JS tests and all 3 Python tests. Dedicated game-command v6 and game-room v5 are ACTIVE and passed the full-world live HTTP smoke on 2026-10-01; the isolated QA room and memberships were removed. Government source `06e71d8` passed standalone release verification and offline emulator smoke (run `36893464515`), including payment/cooldown, seven modes, presets, four layouts and restart without Metro. Follow-up `3a43965` corrects the categorical legend and passed its native gate (run `36895304619`). No final-release acceptance is claimed.

Government policies use small tradeoffs; regression checks prove no policy dominates all other modifiers. Changes spend 80 political power, reduce stability by 8, adjust diplomatic reputation and block another change for 24 monthly ticks. Taxes, manpower recovery, research, stability and unrest use the selected policy. The game panel opens actual government actions on demand. Older modern-world snapshots initialize the new fields once on the authoritative clone; legacy scenarios preserve their monthly rules. The 100-tick CPU benchmark remained finite (195 countries, 4,386 provinces, 7,214 cities, 355 final armies, p95 tick 99.63 ms). This is not physical-device FPS.

## Phase 1 renderer foundation

Implemented: native Skia GPU canvas, real public-domain geographic contours, original terrain bands/rivers/lakes, camera tilt, pan/inertia, pinch and focal-point zoom, double tap, animated selection and battle markers, city/capital markers, military counters, cached native paths, color-batched province rendering, spatial index, city LOD, Low/Medium/High/Ultra presets, landscape and safe-area layout, offline scenario entry.

The legacy 8-country / 12-province scenario remains available to existing campaigns and regression fixtures. New offline campaigns and the updated server factory use `modern-world-v1`: 195 selectable countries, 4,386 real administrative provinces and 7,214 populated places. The offline Android checkpoint passed for this migration; the live-room endpoint smoke now passes, but later requested systems remain incomplete, so this is not a completed global strategy release.

7 of 12 requested functional map modes in the current source use existing campaign state: Political, Government, Economy, Population, Military, Terrain, Stability. The other modes require later religion/diplomacy/resource/development schemas. They are not presented as working features.

Verification gates:

- `npm run typecheck`: passed locally.
- `npm test`: 48 tests passed locally, including deterministic rulers for all countries and all-country selection, shared local/server reducer, map topology, camera, city positions, recruitment/movement, and engine regression.
- Python importer/APK verifier tests: 3 passed.
- `npm run benchmark:map`: 5,000 features / 10,000 queries, p95 ~0.026 ms on this build machine. **CPU index benchmark, not Android FPS.**
- Expo Android prebuild: passed locally.
- Production Hermes bundle export: passed locally, ~3.6 MB.
- Current migration `assembleRelease`, APK verifier, and emulator gameplay smoke: passed on `95f7fee` (CI run `36877387395`). This workspace cannot reach Gradle's distribution host, so the successful native build ran in GitHub Actions.
- Native cold-launch / renderer / offline launch without networking / restart smoke: passed on API 35 for `95f7fee` (CI run `36877387395`), including 195-country search/select/start, paused paid recruitment, four presets, six available modes, landscape resizes and restart. Earlier scenario-only gates are recorded below.
- Emulator evidence covers 1280×720, 1600×720, 1920×1080 and 1280×800 layouts, four graphics presets and six map modes.
- Swiftshader emulator camera benchmark was slow (median frame 77 ms, p95 200 ms); this does not establish physical-device performance. Camera culling updates are now triggered by movement/zoom thresholds instead of every small camera change.
- Physical-device FPS, gestures and sustained GPU profiling: pending.

**Phase 1 is not fully accepted while its remaining map modes and physical-device profiling are outstanding. No later gameplay phase is declared complete.**

## Sequential phases

2–4. Implemented as a playable modern-world campaign dataset: 195 states, 4,386 provinces, 10,527 symmetric land-adjacency edges, and 7,214 linked cities. Typecheck/regression and source audits pass. Standalone APK verification and offline emulator gameplay smoke pass on `95f7fee` (CI run `36877387395`). Live-room create/join/authentication/selection/start/recruitment/movement/government/sync smoke passed on 2026-10-01. Physical-device and final-release acceptance remain open.
5. Deterministic fictional rulers: implemented, dedicated room v4 is ACTIVE, and standalone APK/emulator gates passed on `deaf659` (CI `36883315047`). Every state has a seeded fictional leader.
6. Government implementation, dedicated endpoint verification and Android release/emulator gates passed on `06e71d8`; legend follow-up `3a43965` also passed: ten policies, server-authenticated paid changes, stability cost, diplomacy effects, 24-month cooldown, monthly modifiers, migration of older world snapshots, and Government map mode.
7. Religion gameplay remains upcoming.
8–12. Population, economy, resources, buildings and technology.
13–16. Unit composition, generals, diplomacy/war/peace, unrest and strategic AI.
17. Persistent offline/online saves, reconnect, command idempotency, host migration and checksums.
18. Full HUD/panels, audio and onboarding.
19–20. Device profiling, full-world stress/chaos/security/UI QA and bug fixes.
21. Final verified `Dominion-world-update-release.apk`.

Each phase requires typecheck, regression tests and Android build before acceptance. Current phase APKs must not be named as the final world-update release.

## Isolation

Only `elcin31/grand-strategy-multiplayer` is modified. Online transport continues to point to the existing dedicated backend `dfjsnjxnyjspwugjguhq`. No AssetMind repository, auth, storage or backend is used or modified.

## Full-world data pipeline and campaign migration

`scripts/import-world.py` uses an explicit UN member / observer roster, public-domain Natural Earth admin-0 / admin-1 / populated-place data, recorded source hashes, topology-preserving coverage simplification and an adjacency graph from shared land boundaries. Install the pinned preparation dependency from `scripts/world-requirements.txt`.

Preparation audit produced 195 country records, 4,386 real administrative provinces, 7,214 populated places and 10,527 symmetric land-adjacency edges. It checks unique IDs, valid geometry, every country capital and all city/province links. Explicit capital/seat exceptions cover Bolivia, South Africa, Côte d’Ivoire, Palestine, South Sudan and Nauru. Nauru's government-seat district uses its mapped district anchor; the source has no populated-place entry. Baykonur's assignment across a leased-area gap is recorded for review. Source population estimates retain their historical year.

The prepared records are now packaged reproducibly by `scripts/package-world.py` into bounded Edge-compatible TypeScript modules and loaded by the shared client/server world factory. Mutable campaign state contains no detailed polygons, coordinates or flag SVG strings. Geometry/city points remain cached renderer definitions. Province populations are allocated from historical country estimates using city weights and land area; city counts are normalized within province totals. These are deterministic game estimates, not census claims.

Profiling the prepared 4,386-province dataset found country-label generation took ~7.8 seconds on this machine. Cached geometry, bounded candidates and exact horizontal land intervals reduced it to ~102 ms. The repeatable synthetic 5,000-feature CI benchmark now reports label time too. This is CPU preparation, not native navigation FPS.

Native CI for `e84ccae` passed release archive validation, offline cold-launch, all presets/modes, layout checks and restart. Collision-aware label placement passed the Android release/emulator gate on `d870789`.

## Command-boundary regression fix

The previous server cast JSON to a TypeScript command without runtime validation. It accepted unknown countries, invalid ready/speed fields and allowed lobby startup through SET_SPEED. A shared pure validator now checks exact fields, identifiers, country membership, boolean ready, integer speed and recruitment bounds. Both engines enforce lobby/start/pause/resume transitions. Tests import the actual server reducer, so its core is now covered by strict client typecheck as well as runtime tests. TypeScript permits Deno's .ts import paths under noEmit.

40 JavaScript tests and 3 Python tests pass locally. Earlier game-command v3/v4 deployments passed live malformed-command, authentication, actor-spoof, paid-recruitment and movement checks; isolated QA rooms were removed.

The expanded Android smoke test on `87601a2` caught a real regression: recruitment controls stayed available while paused, but both reducers rejected orders. Both now accept validated recruitment and movement during running/paused campaigns, while ADVANCE_TICK remains a no-op on pause. Tests cover payment, manpower, ownership, adjacency, immutable rejection and frozen dates. Winning/losing battle tests also verify casualty conservation, unique ownership and immutable input in both reducers. Fuzz checks exercise 5,000 hostile payloads and 1,000 paused recruitment attempts in each actual reducer. The dedicated game-command function is now v4; live paused-order verification passed (paid recruitment, legal movement, frozen clock); the new standalone release/emulator gate passed on `0e05df5` (CI run 36858034580). Failed emulator runs now retain logcat and report rejection dialogs explicitly.

The immutable country catalogue feeds new campaigns: 195 definitions, linked capital records, original adjectives and contrasting neighbor-aware colors, Russian/English/ISO search, and offline flag-icons 7.5.0 vectors with the complete MIT notice. Legacy campaigns retain their original 8-country/12-province schema. No final release acceptance is claimed.

Historical scenario gate: `0e05df5` passed assembleRelease, embedded 2,983,712-byte bundle verification, Skia/Hermes checks, real paused recruitment, all four presets/six modes, four landscape layouts and network-disabled restart. Later commits change only tests/reports and the opt-in backend smoke script; application/runtime files are identical. Remaining phase acceptance and final APK gates above stay open.

## World campaign migration — subsequent phase gates pending

- Shared `gameTypes.ts`, `gameEngine.ts` and `worldState.ts` replace duplicated client/server reducer logic. Country IDs are strings; roster size is data-driven. Unknown country links fail explicitly. Legacy campaign geometry is selected independently by dataset version.
- New campaigns load all countries, province adjacency and linked cities, with capital armies and a persisted deterministic campaign seed. Flags render from the licensed offline SVG catalogue. A virtualized modal picker searches Russian/English names and ISO codes, including microstates, then focuses their capital marker.
- The GPU renderer caches both scenario geometry sets, batches visible polygons, uses the real shared-boundary graph and limits label preparation to visible countries. Data does not create one React Native View per province.
- Global stat aggregation is linear in provinces/armies. Recruitment updates only the recruiting country's army total. Captures synchronize owner/controller/city ownership and country province/population totals.
- A monotonic campaign entity sequence prevents repeated army/battle IDs after casualties or bounded battle-log truncation.
- Phase 5 leader generation produces all 195 fictional leaders deterministically from country ID, regional name pools and persisted campaign seed. Age, ideology, traits, commander/economic/diplomatic skills, popularity and procedural portrait seed are stored in campaign state and shown in the country/game panels. Repeat-seed equality and different-seed tests pass.
- Room admission now rechecks phase, duplicate player IDs and the eight-player limit on each fresh CAS snapshot; failed joins clean up their new membership. Version-aware polling avoids transferring an unchanged 2.8 MB world state every 900 ms. This does not yet implement delta sync, command idempotency, reconnect or host migration.
- Dedicated backend `game-command` v6 and `game-room` v5 are deployed ACTIVE. The room bundle contains all 83 generated world-data modules. Its full-world two-player create/join/action/government/sync/cleanup smoke passed on 2026-10-01.
- 48 JS tests and 3 Python tests passed locally, with `noUnusedLocals` and `noUnusedParameters` now enabled. Full-world data/CPU benchmark passed 100 ticks with fictional leaders in state (snapshot 2.86 MB; tick p95 84.57 ms on this host); physical FPS and complete Phase 20 stress/chaos acceptance remain unverified.
- Android smoke now uses actual searchable country selection and a real capital province instead of synthetic demo coordinates. Standalone build and offline emulator smoke passed on `95f7fee`, `deaf659` and government source `06e71d8`; isolated live-backend endpoint verification passed on 2026-10-01.

## Live full-world government regression — 2026-10-01

The opt-in `scripts/backend-world-smoke.py` passed against only `dfjsnjxnyjspwugjguhq` (game-command v6 / game-room v5). It verifies 195 countries, 4,386 provinces, 7,214 cities and 195 leaders; two-player identical snapshots; malformed payload, actor/token spoofing and lobby guards; actual country selection/start/pause; version-aware polling; paid recruitment and legal movement; government payment/stability/cooldown; and a frozen paused clock. The isolated room `86703597-01a0-4d1c-b6a1-a230bbf05243` was deleted with a matching QA display-name guard. Subsequent exact-ID queries returned zero rooms and zero memberships. Player tokens were not logged. This does not substitute for Phase 17/20 reconnect, chaos or replay testing.

## Extended reducer stress checkpoint

`npm run benchmark:world -- 10000` completed all 10,000 monthly ticks with 195 countries, 4,386 provinces, 7,214 cities and 1,079 final armies. The harness checks finite/nonnegative treasury, income, population, manpower and army totals on every tick, positive integer troops, unique army IDs, advancing clock and a battle history capped at 20. Snapshot bytes grew from 2,883,993 to 2,964,771; CPU tick p95 was 122.45 ms on this host. The current simple AI participated for unselected countries. This does not implement or accept AI 2.0, separate war states, multiplayer chaos testing, sustained Android memory profiling or physical-device FPS.

## Screenshot-driven city label regression

High/Ultra emulator evidence exposed overlapping regional city text in Benelux and western Germany. City text now has deterministic, capital/population-prioritized placement, viewport bounds, alternate offsets and collision rejection against army counters, city markers and already placed labels. City points remain rendered and selectable. Country-name placement blocks only city text that is actually drawn. Layout work runs on culled camera updates, outside the animation frame loop. Two regression tests cover dense synthetic clusters and actual European city/counter geometry across three landscape sizes. All 48 JS tests and strict typecheck pass. The native follow-up gate remains pending; screenshot acceptance is not yet claimed.
