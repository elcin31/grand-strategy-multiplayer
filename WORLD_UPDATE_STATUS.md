# World update — work in progress

## Phase 1 renderer foundation

Implemented: native Skia GPU canvas, real public-domain geographic contours, original terrain bands/rivers/lakes, camera tilt, pan/inertia, pinch and focal-point zoom, double tap, animated selection and battle markers, city/capital markers, military counters, cached native paths, color-batched province rendering, spatial index, city LOD, Low/Medium/High/Ultra presets, landscape and safe-area layout, offline scenario entry.

Playable-state schema is deliberately still compatible with the existing server: 8 countries, 12 provinces. Global geography outside this scenario is background context. It is not 195 playable states yet. Provinces use synthetic geographic cuts, not real administrative subdivisions.

6 functional map modes use existing authoritative state: Political, Economy, Population, Military, Terrain, Stability. The remaining 6 modes require later government/religion/diplomacy/resource/development schemas. They are not presented as working features.

Verification gates:

- `npm run typecheck`: passed locally.
- `npm test`: 15 tests passed locally, including map topology, camera, city positions, recruitment/movement, and engine regression.
- `npm run benchmark:map`: 5,000 features / 10,000 queries, p95 ~0.026 ms on this build machine. **CPU index benchmark, not Android FPS.**
- Expo Android prebuild: passed locally.
- Production Hermes bundle export: passed locally, ~3.6 MB.
- `assembleRelease`: passed for `6cb3c1f`; repeat required for the label/camera update.
- Native cold-launch / renderer / offline launch without networking / restart smoke: passed for `6cb3c1f` on API 35. Repeat required for the label/camera update.
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
