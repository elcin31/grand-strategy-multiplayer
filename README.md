# Grand Strategy Multiplayer · Dominion

Original Android-first global strategy, built with Expo 57, React Native 0.86, TypeScript and a native Skia map. No Age of History code or assets are used.

## Current checkpoint

Main retains the accepted **0.8.1 (9)** release. The existing `expansion-v2` branch contains the integrated Dominion 2.0 systems on **schema18**: diplomacy and AI offers, four espionage missions, budget/policies/funding and construction queues, typed armies/generals/supply,30 technology nodes in5 branches,40 national courses with once-only rewards, and27 new original illustrations (42 packaged assets). The historical world remains **195 countries,2,924 provinces,5,411 cities**. Gameplay advances through authoritative ticks; camera/render work is independent.

The current candidate is **2.0.0 (10)** with the existing package/signature and dedicated Dominion backend `dfjsnjxnyjspwugjguhq` (room22/command24, schema18). The latest signed candidate passes build,10,000ticks/tenrestores,productionHTTP,higher-version save migration and native multiplayer/session/paid-course recovery. Its complete camera comparison fails four unchanged limits, so final release remains pending. A narrow static raster-picture and recording-builder correction is locally verified and requires fresh signed Android QA; earlier rejected binaries are not final releases.

Read [DEVELOPMENT_HANDOFF.md](DEVELOPMENT_HANDOFF.md) for the exact working branch/runtime/run, original12stage status, unresolved measured regressions and next operation. [BUG_REPORT.md](BUG_REPORT.md), [PERFORMANCE_REPORT.md](PERFORMANCE_REPORT.md), [RELEASE_REPORT.md](RELEASE_REPORT.md) retain actual evidence and physical-device limitations. Earlier roadmap/recovery documents are historical; the current handoff takes precedence.

## Run and verify

Node.js 22.13+:

```bash
npm ci --include=dev
npm run typecheck
npm test
npm run benchmark:map
npm run benchmark:world -- 100
npm start
```

The live QA script creates only an isolated test campaign in the dedicated game backend. Its exact room ID must be cleaned with the QA-name guard after verification; never delete user campaigns.

## Server authority and persistence

Clients send intent. A shared pure reducer implements local/server rules; the authenticated server boundary rejects actor spoofing. Edge Functions price and validate recruitment, movement/combat, research/buildings, government/resources, diplomacy/war/peace. Hashed room bearer tokens, RLS denial of direct client table access and compare-and-swap version updates remain intact.

Modern snapshots use `stateVersion: 16`, ordered migrations and compressed persistence with legacy JSONB fallback. Offline campaigns use validated atomic save generations; multiplayer credentials/pending commands persist in native SecureStore. Reconnect recovers server state, versioned transactional receipts prevent duplicate effects, and server time can progress through any connected member. All-offline campaigns are dormant with bounded catch-up. Strategic AI takes over a timed-out country and yields on authenticated return.

Dedicated backend: `dfjsnjxnyjspwugjguhq`.
Endpoint: `https://dfjsnjxnyjspwugjguhq.supabase.co/functions/v1`.
Only this backend is used; AssetMind projects/data/auth/storage are excluded. Both `game-room` and `game-command` must be deployed from the same tested shared-source revision.

Military2.0 on expansion-v2 adds paid mixed regiments, actual controlled-route/port supply, attrition, monthly paid reinforcement, safe retreats and bounded unit/general experience. Schema16 preserves existing campaigns with a byte-exact migration backup.242 host tests and Hermes export pass; native/performance/final backend acceptance remain pending. The opaque SurfaceView experiment was rejected by complete paired Android evidence and removed.

## Android

GitHub Actions builds an **assembleRelease standalone checkpoint APK**, checks `assets/index.android.bundle` and Hermes/Skia libraries, then exercises offline gameplay, landscape layouts and restart without Metro. The current checkpoint artifact is `dominion-camera-illustrated-release`. Use the exact runtime/build IDs in the handoff; artifact presence alone is not native QA acceptance. It is not the final completed-roadmap release; physical-device FPS/thermal acceptance is outstanding. Do not distribute a debug/Metro-dependent APK.

Natural Earth geometry/data and licensed flag assets have provenance in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Population allocation, resources, combat terrain and policies are original game abstractions rather than census, geological or political claims.
