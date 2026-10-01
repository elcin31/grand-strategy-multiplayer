# World update — work in progress

## Phase 1 renderer foundation

Implemented: native Skia GPU canvas, real public-domain geographic contours, original terrain bands/rivers/lakes, camera tilt, pan/inertia, pinch and focal-point zoom, double tap, animated selection and battle markers, city/capital markers, military counters, cached native paths, color-batched province rendering, spatial index, city LOD, Low/Medium/High/Ultra presets, landscape and safe-area layout, offline scenario entry.

Playable-state schema is deliberately still compatible with the existing server: 8 countries, 12 provinces. Global geography outside this scenario is background context. It is not 195 playable states yet. Provinces use synthetic geographic cuts, not real administrative subdivisions.

6 functional map modes use existing authoritative state: Political, Economy, Population, Military, Terrain, Stability. The remaining 6 modes require later government/religion/diplomacy/resource/development schemas. They are not presented as working features.

Verification gates:

- `npm run typecheck`: passed locally.
- `npm test`: 12 tests passed locally, including map topology, camera, city positions, recruitment/movement, and engine regression.
- `npm run benchmark:map`: 5,000 features / 10,000 queries, p95 ~0.026 ms on this build machine. **CPU index benchmark, not Android FPS.**
- Expo Android prebuild: passed locally.
- Production Hermes bundle export: passed locally, ~3.6 MB.
- `assembleRelease`: must pass CI for the current commit.
- Native cold-launch / renderer / restart smoke: must pass CI for the current commit.
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
