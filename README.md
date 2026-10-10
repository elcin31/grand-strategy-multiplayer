# Grand Strategy Multiplayer · Dominion

Original Android-first global strategy, built with Expo 57, React Native 0.86, TypeScript and a native Skia map. No Age of History code or assets are used.

## Current checkpoint

Main contains the verified **0.8.1 (9)** camera/illustrated release: **195 countries, 2,924 provinces, 5,411 cities, schema12**. The continuing **Expansion 2.0** work is on `expansion-v2`; it is not yet merged or a final v2 release. Recovery and army-selection fixes exist, while current camera acceptance and the full diplomacy/espionage/economy/military/technology/focus/art expansion remain open. Existing systems and optimized map caches are retained.

Read [DEVELOPMENT_HANDOFF.md](DEVELOPMENT_HANDOFF.md) for exact implementation, commits, CI evidence, remaining gates and next five phases. [RECOVERY_AUDIT.md](RECOVERY_AUDIT.md) records the recovered 26-phase matrix. [BUG_REPORT.md](BUG_REPORT.md) tracks current defects/limitations; [WORLD_UPDATE_STATUS.md](WORLD_UPDATE_STATUS.md) is mostly historical evidence.

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

Modern snapshots use `stateVersion: 12`, ordered migrations and compressed persistence with legacy JSONB fallback. Offline campaigns use validated atomic save generations; multiplayer credentials/pending commands persist in native SecureStore. Reconnect recovers server state, versioned transactional receipts prevent duplicate effects, and server time can progress through any connected member. All-offline campaigns are dormant with bounded catch-up. Strategic AI takes over a timed-out country and yields on authenticated return.

Dedicated backend: `dfjsnjxnyjspwugjguhq`.
Endpoint: `https://dfjsnjxnyjspwugjguhq.supabase.co/functions/v1`.
Only this backend is used; AssetMind projects/data/auth/storage are excluded. Both `game-room` and `game-command` must be deployed from the same tested shared-source revision.

## Android

GitHub Actions builds an **assembleRelease standalone checkpoint APK**, checks `assets/index.android.bundle` and Hermes/Skia libraries, then exercises offline gameplay, landscape layouts and restart without Metro. The current checkpoint artifact is `dominion-camera-illustrated-release`. Use the exact runtime/build IDs in the handoff; artifact presence alone is not native QA acceptance. It is not the final completed-roadmap release; physical-device FPS/thermal acceptance is outstanding. Do not distribute a debug/Metro-dependent APK.

Natural Earth geometry/data and licensed flag assets have provenance in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Population allocation, resources, combat terrain and policies are original game abstractions rather than census, geological or political claims.
