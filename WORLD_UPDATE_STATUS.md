# World update — work in progress

Latest completed checkpoint: Phase 8 population. Runtime source `2f67b35` passed Android workflow `36968778110`: standalone release, embedded JS/Hermes/Skia, offline emulator gameplay, confirmed speed/pause, actual population growth, government/religion payment/cooldown, four presets, eight modes, four landscape layouts and restart without Metro. Population/policy screenshots were reviewed. Strict typecheck, 60 JS tests, all 3 Python tests and 10,000 full-world ticks pass. Dedicated backend v9/v8 passed the complete two-player live suite in `36969317388`; exact QA cleanup returned zero rooms/memberships. Subsequent commits contain QA workflow/script and documentation changes only. Earlier sections below are historical checkpoints. Full world-update release acceptance remains open.

Government policies use small tradeoffs; regression checks prove no policy dominates all other modifiers. Changes spend 80 political power, reduce stability by 8, adjust diplomatic reputation and block another change for 24 monthly ticks. Taxes, manpower recovery, research, stability and unrest use the selected policy. The game panel opens actual government actions on demand. Older modern-world snapshots initialize the new fields once on the authoritative clone; legacy scenarios preserve their monthly rules. The 100-tick CPU benchmark remained finite (195 countries, 4,386 provinces, 7,214 cities, 355 final armies, p95 tick 99.63 ms). This is not physical-device FPS.

## Phase 1 renderer foundation

Implemented: native Skia GPU canvas, real public-domain geographic contours, original terrain bands/rivers/lakes, camera tilt, pan/inertia, pinch and focal-point zoom, double tap, animated selection and battle markers, city/capital markers, military counters, cached native paths, color-batched province rendering, spatial index, city LOD, Low/Medium/High/Ultra presets, landscape and safe-area layout, offline scenario entry.

The legacy 8-country / 12-province scenario remains available to existing campaigns and regression fixtures. New offline campaigns and the updated server factory use `modern-world-v1`: 195 selectable countries, 4,386 real administrative provinces and 7,214 populated places. The offline Android checkpoint passed for this migration; the live-room endpoint smoke now passes, but later requested systems remain incomplete, so this is not a completed global strategy release.

8 of 12 requested functional map modes in the current source use existing campaign state: Political, Government, Religion, Economy, Population, Military, Terrain, Stability. The other modes require later religion/diplomacy/resource/development schemas. They are not presented as working features.

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
7. Religion source d69c3ce passed strict typecheck, 55 JS tests, all 3 Python tests, release archive validation, offline Android gameplay smoke and dedicated two-player live HTTP verification.
8. Population growth is implemented in the current source; its phase gates are pending.
9–12. Economy, resources, buildings and technology.
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

High/Ultra emulator evidence exposed overlapping regional city text in Benelux and western Germany. City text now has deterministic, capital/population-prioritized placement, viewport bounds, alternate offsets and collision rejection against army counters, city markers and already placed labels. City points remain rendered and selectable. Country-name placement blocks only city text that is actually drawn. Layout work runs on culled camera updates, outside the animation frame loop. Two regression tests cover dense synthetic clusters and actual European city/counter geometry across three landscape sizes. All 48 JS tests and strict typecheck pass. The native follow-up passed on `1a35361` (run `36898715472`). Its 1600×720 evidence was reviewed: regional city text is separated from other text and counters; points remain visible. Physical-device profiling remains outstanding.

## Phase 7 — original religion gameplay

The extensible catalogue includes Christianity (Catholic/Orthodox/Protestant), Islam (Sunni/Shia), Hinduism, Buddhism, Judaism, Folk/Traditional, Shinto, Sikhism, Secular and Other. Country policy and province identity are separate. Religious Unity is population-weighted and recalculated after ownership changes. Low unity adds restrained monthly national/provincial unrest; all faiths have identical mechanics and no inherent economy/military advantage. A policy change costs 120 political power, costs 12 stability, adds national unrest and unrest in provinces of another faith, and has a 36-month cooldown. It never changes province religion automatically.

Starting policies and seeded provincial minorities are original scenario assumptions using regional pools; they are not a census, a claim about current laws or a real-world religion distribution dataset. Population estimates already documented above retain their historical source years. There is no runtime AI or religion API. Seeds reproduce exactly in local/multiplayer campaigns. Old modern-world snapshots initialize missing fields once on the authoritative clone; legacy scenarios preserve their old monthly rules. Invalid persisted identities/unrest/population and overflowing population sums are rejected.

The on-demand religion panel exposes real server commands and costs, unity, unrest and cooldown. Government/religion panels close each other to limit overlay size. Province details show local faith/unrest. Religion map colors use province faith; changing state policy does not repaint provincial identities. Seven new regressions cover all-world validity/seed variation, immutable paid local/server parity, actor/payload/phase/cost/cooldown guards, weighted unity/ownership, neutral bounded monthly effects, migration/legacy/corruption/overflow and categorical map behavior. Android smoke now accumulates PP through the actual game clock, pauses, pays for a faith change and checks its 36-month cooldown plus eight modes. Phase 7 standalone/live gates are pending, so the phase is not declared complete.

## Verified Phase 7 checkpoint — 2026-10-02

Android run `36914710819` passed standalone assembleRelease, embedded JS bundle/native libraries and offline API 35 smoke for actual paid faith changes, cooldown/Unity, eight modes, presets, landscape sizes and restart without Metro. The religion panel screenshot was reviewed. Dedicated game-command v7 / game-room v6 passed two-player create/join/auth/payload/lobby checks, selection/start/pause, recruitment/movement/government, actual 20-month PP accumulation, paid faith change, province faith preservation, population-weighted unity, unrest/cooldown and identical guest sync. Interrupted QA room `8cbfb8e3-1c65-498e-b1b8-b46ab3cef244` and successful QA room `695d11c9-ab9d-4f99-9f9c-f232ca0e987a` were removed using matching QA-name guards; exact-ID queries returned zero rooms and memberships. Tokens were never logged.

The Phase 7 reducer repeated 10,000 ticks with all 195 countries, 4,386 provinces, 7,214 cities and 1,079 final armies. Extended per-tick religion/Unity/unrest/PP checks passed. Snapshot bytes 3,080,400 → 3,169,025; host CPU p95 tick 123.24 ms. This is not physical Android FPS, a memory-leak proof or complete chaos/AI 2.0 acceptance.

## Phase 8 population implementation awaiting gates

Server/local shared monthly demography uses a restrained original 0.4–1% annual game rate from development/stability. Counts remain safe nonnegative integers; fractional growth carries persist so small settlements can accumulate growth. City growth allocates a share of province births, keeping city totals below their province population. Country population and last-month growth are derived from current ownership. Province income uses the existing population/development tax basis; manpower uses the updated population. Paused campaigns do not grow. Missing old-save fields initialize without inventing people; malformed counts/carries, orphan cities, urban overpopulation and integer overflow fail on the authoritative clone. Legacy campaigns retain their original rules.

Population/current growth and major city counts appear in the real country/province panel. City LOD uses current campaign population while geographic paths remain cached. Four population tests include shared reducer parity/immutability, actual full-world growth/income/manpower, paused equality, 10,000 small-province model months with urban conservation, migration/ownership/legacy and malformed/overflow checks. Native smoke compares actual campaign population before/after running time. The live script checks real 20-month growth and exact province/city/country totals. Phase 8 native/deployment/live gates are pending; it is not declared complete.

Phase 8 follow-up rejects duplicate province/city IDs before demographic mutation. A fifth population regression also verifies immutable authoritative/local rejection of orphan cities and urban overpopulation. Strict typecheck, 60 JS tests and all 3 Python tests pass. On e4220fe, Android run 36961616362 passed release build and bundled-JS verification; its first smoke attempt failed during emulator SDK download before the app ran. The failed job was retried. Dedicated v8/v7 deployment, live population smoke and a full 10,000-tick repeat are undergoing verification. The interrupted isolated population QA room e0538eaf-6a54-4924-b78f-fa6640c047f7 was removed with an exact ID and QA-name guard. Phase 9 has not started.

The retry ran actual offline gameplay and confirmed increasing displayed population (83.2M to 83.7M in hierarchy evidence), then failed because collapsing Government left Religion above the viewport and the smoke searched only downward. Follow-up searches from the top, uses smaller scroll steps, exposes selected speed accessibility state, confirms pause/resume, and waits for 20 actual months before paid religion assertions. This does not turn a partial run into a passing native gate.

The full population simulation finished 10,000 ticks: 195 countries, 4,386 provinces, 7,214 cities, 1,124 final armies; snapshot 3,510,268 to 3,872,944 bytes; host tick p95 115.61 ms. Every tick checked safe integer/carry counts, urban conservation, owner-derived totals, religion/Unity/unrest/PP, army uniqueness and clock/log bounds. Dedicated game-command v9 / game-room v8 are ACTIVE with duplicate-ID validation. Live HTTP rerun passed world creation, two-player join/sync, authentication and lobby guards, then network policy blocked further requests; no population live pass is claimed. QA room b598d969-72f6-4f9c-af39-48c1aeb22e36 was deleted using exact ID/QA-name guards. Both population QA room IDs have zero remaining rooms and memberships. Phase 8 native and complete live gates remain open.

## Phase 8 complete live verification — 2026-10-02

Dedicated World backend QA workflow 36969317388 passed against only dfjsnjxnyjspwugjguhq (game-command v9 / game-room v8). It verified full-world creation, two-player join/identical snapshots, actor/token/payload/lobby guards, paid recruitment/legal movement, pause/version polling, government payment/cooldown, 20 actual authoritative months of province/city growth, safe integer counts/carries, unique geographic IDs, urban conservation, exact current-owner country totals, religion payment/unrest/cooldown/Unity and identical guest sync. No tokens or state snapshots are persisted by the workflow; its cleanup artifact contains only the QA room UUID. Room 18ddbaf4-bb51-4a94-92d9-8e50a2eaaf4e was removed with exact ID and QA-name guards; zero rooms and memberships were verified. Android gameplay follow-up 2f67b35 remains pending. Phase 8 is not yet closed.

Native follow-up 2f67b35 subsequently passed the complete release/offline emulator gate in 36968778110. Population and religion screenshots were inspected: the population/growth row and selected pause state are readable; paid Catholic policy shows the remaining PP and 36-month cooldown. Phase 8 verification is closed. Phase 9 economy is next; resources/buildings, full military/diplomacy/AI/saves and physical-device profiling remain later work.

## Phase 9 budget implementation awaiting gates

The shared authoritative reducer now computes taxes (10–60%, default 30%), original local commerce based on province production/development and stability, army maintenance (1.25M per 1,000 troops/month), debt interest (0.5%/month), net monthly balance and a credit limit of 24 months of gross revenue. Monetary values use $1,000 precision and reject negative/corrupt/overflowing amounts. Country.income remains tax revenue for existing map consumers; the new economy ledger exposes all monthly components and net balance. Resource income and building maintenance are zero while those systems are absent; actual resources/buildings are subsequent phases, not accepted features here.

Paid recruitment immediately increases upkeep. The existing AI recruits only when the additional maintenance fits its budget and it retains a three-month upkeep reserve. This is an economy safeguard, not AI 2.0 acceptance. Tax/borrow/repay commands derive the country from the authenticated player and reject injected country/balance/debt fields, bad precision, overdraws and credit-limit violations. High taxation charges restrained monthly stability/unrest penalties. Deficits borrow within the limit. Insolvency cancels debt, costs stability/PP/reputation, raises unrest, liquidates at least half of the army and enough additional forces to fit the budget, and locks credit/recruitment for 24 months. A cooldown prevents repeated national penalty spam.

The real economy panel changes tax rates, borrows and repays quoted amounts; the HUD displays net balance and proper million/billion currency units. Panels remain mutually exclusive. Old modern-world snapshots initialize missing fields and rebuild derived budgets; legacy monthly income remains unchanged. Eight new tests cover ledger/payment/upkeep, immutable local/server loan parity, tax tradeoffs, auth/payload/phase/limit/precision guards, insolvency/cooldown, migration/corruption/legacy, 1,000 fractional loan cycles, and paid recruitment after fractional income. The government monthly regression now checks the new net budget. Strict typecheck, all 68 JS tests, all 3 Python tests and a 100-tick full-world financial-invariant benchmark pass (host p95 140.51 ms). Full Phase 9 native/live/10,000-tick gates are pending; no Phase 9 completion is claimed.

Dedicated game-command v10 and game-room v9 are deployed ACTIVE with the budget module. Custom membership/player-token authentication and the project isolation are preserved. The dedicated live script now checks actual tax, borrow and repayment commands, exact cash/debt, interest/upkeep/commerce and guest sync; its isolated campaign name is WORLD ECONOMY QA. The native smoke exercises the same real economy controls before government/religion regression. Live/native checks are pending, not inferred from deployment status.

## Phase 9 verified native/live checkpoint — 2026-10-02

Source f631efa passed Android 36975556052: strict typecheck, 68 JS tests, 3 Python tests, benchmarks, landscape generation, assembleRelease, embedded bundle/Hermes/Skia checks and the full offline emulator suite. The smoke also changed tax to 35%, borrowed 100M, observed the debt, repaid it and restored tax before government/religion regression. Economy screenshots were reviewed: net monthly balance, tax/commerce/army costs, interest and debt/limit are readable. The caption in the final smoke line retains the earlier scenario summary; the economy assertions ran as part of the same successful script.

Dedicated live QA 36975555995 passed against only v10/v9: real tax/loan/repayment, exact cash/debt, upkeep/interest/commerce, guest sync, plus all existing auth/lobby/movement/government/population/religion checks and 20 authoritative monthly ticks. Room 49725814-676a-4fca-a5d2-ebfcd61b7b17 was deleted with exact ID and WORLD ECONOMY QA name guards; exact-ID queries returned zero rooms and memberships. A fresh 10,000-tick budget simulation is still running locally after an interrupted earlier run; no unobserved result is claimed. The separate Full world stress workflow now preserves the 10,000-tick report in CI so conversational interruptions cannot lose that evidence. Full Phase 9 stress verification is still open; later systems and final Android acceptance remain unfinished.
