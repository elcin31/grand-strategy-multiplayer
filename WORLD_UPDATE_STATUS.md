# World update — work in progress

## Phase 1 renderer foundation

Implemented: native Skia GPU canvas, real public-domain geographic contours, original terrain bands/rivers/lakes, camera tilt, pan/inertia, pinch and focal-point zoom, double tap, animated selection and battle markers, city/capital markers, military counters, cached native paths, color-batched province rendering, spatial index, city LOD, Low/Medium/High/Ultra presets, landscape and safe-area layout, offline scenario entry.

Playable-state schema is deliberately still compatible with the existing server: 8 countries, 12 provinces. Global geography outside this scenario is background context. It is not 195 playable states yet. Provinces use synthetic geographic cuts, not real administrative subdivisions.

6 functional map modes use existing authoritative state: Political, Economy, Population, Military, Terrain, Stability. The remaining 6 modes require later government/religion/diplomacy/resource/development schemas. They are not presented as working features.

Verification gates:

- `npm run typecheck`: passed locally.
- `npm test`: 29 tests passed locally, including map topology, camera, city positions, recruitment/movement, and engine regression.
- `npm run benchmark:map`: 5,000 features / 10,000 queries, p95 ~0.026 ms on this build machine. **CPU index benchmark, not Android FPS.**
- Expo Android prebuild: passed locally.
- Production Hermes bundle export: passed locally, ~3.6 MB.
- `assembleRelease`: passed for `6cb3c1f`; passed again for `e84ccae`; rectangle collision release and emulator smoke passed for `d870789`; paused-order fix native recheck pending.
- Native cold-launch / renderer / offline launch without networking / restart smoke: passed for `6cb3c1f` on API 35. Passed again for `e84ccae`; rectangle collision release and emulator smoke passed for `d870789`; paused-order fix native recheck pending.
- Emulator evidence covers 1280×720, 1600×720, 1920×1080 and 1280×800 layouts, four graphics presets and six map modes.
- Swiftshader emulator camera benchmark was slow (median frame 77 ms, p95 200 ms); this does not establish physical-device performance. Camera culling updates are now triggered by movement/zoom thresholds instead of every small camera change.
- Physical-device FPS, gestures and sustained GPU profiling: pending.

**Phase 1 is not fully accepted while its remaining map modes and physical-device profiling are outstanding. No later gameplay phase is declared complete.**

## Remaining sequential phases

2. Full modern playable-state database with explicit recognition policy and licence provenance.
3. 2,500–5,000 provinces, adjacency validation, schema migration for new campaigns.
4. 1,000+ cities and progressive labels.
5–7. Deterministic fictional rulers, governments and religions.
8–12. Population, economy, resources, buildings and technology.
13–16. Unit composition, generals, diplomacy/war/peace, unrest and strategic AI.
17. Persistent offline/online saves, reconnect, command idempotency, host migration and checksums.
18. Full HUD/panels, audio and onboarding.
19–20. Device profiling, full-world stress/chaos/security/UI QA and bug fixes.
21. Final verified `Dominion-world-update-release.apk`.

Each phase requires typecheck, regression tests and Android build before acceptance. Current phase APKs must not be named as the final world-update release.

## Isolation

Only `elcin31/grand-strategy-multiplayer` is modified. Online transport continues to point to the existing dedicated backend `dfjsnjxnyjspwugjguhq`. No AssetMind repository, auth, storage or backend is used or modified.

## Full-world import preparation (not a playable release)

`scripts/import-world.py` uses an explicit UN member / observer roster, public-domain Natural Earth admin-0 / admin-1 / populated-place data, recorded source hashes, topology-preserving coverage simplification and an adjacency graph from shared land boundaries. Install the pinned preparation dependency from `scripts/world-requirements.txt`.

Preparation audit produced 195 country records, 4,386 real administrative provinces, 7,214 populated places and 10,527 symmetric land-adjacency edges. It checks unique IDs, valid geometry, every country capital and all city/province links. Explicit capital/seat exceptions cover Bolivia, South Africa, Côte d’Ivoire, Palestine, South Sudan and Nauru. Nauru's government-seat district uses its mapped district anchor; the source has no populated-place entry. Baykonur's assignment across a leased-area gap is recorded for review. Source population estimates retain their historical year.

These prepared records are not yet loaded into campaigns. Runtime remains the existing scenario until schema/engine/server migration passes the next gates.

Profiling the prepared 4,386-province dataset found country-label generation took ~7.8 seconds on this machine. Cached geometry, bounded candidates and exact horizontal land intervals reduced it to ~102 ms. The repeatable synthetic 5,000-feature CI benchmark now reports label time too. This is CPU preparation, not native navigation FPS.

Native CI for `e84ccae` passed release archive validation, offline cold-launch, all presets/modes, layout checks and restart. Collision-aware label placement passed the Android release/emulator gate on `d870789`.

## Command-boundary regression fix

The previous server cast JSON to a TypeScript command without runtime validation. It accepted unknown countries, invalid ready/speed fields and allowed lobby startup through SET_SPEED. A shared pure validator now checks exact fields, identifiers, country membership, boolean ready, integer speed and recruitment bounds. Both engines enforce lobby/start/pause/resume transitions. Tests import the actual server reducer, so its core is now covered by strict client typecheck as well as runtime tests. TypeScript permits Deno's .ts import paths under noEmit.

29 JavaScript tests and 3 Python tests pass locally. Dedicated game-command v3 passed live malformed-command, authentication, actor-spoof and paid-recruitment checks; the isolated QA room and its memberships were removed.

The expanded Android smoke test on `87601a2` caught a real regression: recruitment controls stayed available while paused, but both reducers rejected orders. Both now accept validated recruitment and movement during running/paused campaigns, while ADVANCE_TICK remains a no-op on pause. Tests cover payment, manpower, ownership, adjacency, immutable rejection and frozen dates. Fuzz checks exercise 5,000 hostile payloads and 1,000 paused recruitment attempts in each actual reducer. The dedicated game-command function is now v4; live paused-order verification passed (paid recruitment, legal movement, frozen clock); the new native release/emulator gate is pending. Failed emulator runs now retain logcat and report rejection dialogs explicitly.

The immutable country catalogue has been committed as preparation: 195 definitions, linked capital records, original adjectives and contrasting neighbor-aware colors, Russian/English/ISO search, and offline flag-icons 7.5.0 vectors with the complete MIT notice. It does not change the playable campaign roster yet. No final release acceptance is claimed.
