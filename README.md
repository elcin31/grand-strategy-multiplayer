# Grand Strategy Multiplayer · Dominion

Original Android-first global strategy, built with Expo 57, React Native 0.86, TypeScript and a native Skia map. No Age of History code or assets are used.

## Current checkpoint

Main contains 195 playable UN member/observer states, 4,386 provinces and 7,214 cities; seeded fictional rulers; ten government forms; religion and Religious Unity; population; economy/debt/default; ten resources and ten building types.

The 2026-10-04 session adds **Phases 12–16 only**: five research branches, six military unit types and commanders/readiness, relations/treaties/guarantees, authoritative wars/occupation/peace, stability and rebellions. The roadmap is not finished. **Next: Phase 17 AI 2.0.**

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

Modern snapshots use `stateVersion: 7`, incremental-compatible normalization and compressed persistence with legacy JSONB fallback. Offline play works but does **not** yet implement disk save/restore. Durable client reconnect/idempotency and full strategic AI are later phases.

Dedicated backend: `dfjsnjxnyjspwugjguhq`.
Endpoint: `https://dfjsnjxnyjspwugjguhq.supabase.co/functions/v1`.
Only this backend is used; AssetMind projects/data/auth/storage are excluded. Both `game-room` and `game-command` must be deployed from the same tested shared-source revision.

## Android

GitHub Actions builds an **assembleRelease standalone checkpoint APK**, checks `assets/index.android.bundle` and Hermes/Skia libraries, then exercises offline gameplay, landscape layouts and restart without Metro. Download `dominion-world-checkpoint` from a **successful** Android APK run. It is not the final completed-roadmap release; physical-device FPS/thermal acceptance is outstanding. Do not distribute a debug/Metro-dependent APK.

Natural Earth geometry/data and licensed flag assets have provenance in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Population allocation, resources, combat terrain and policies are original game abstractions rather than census, geological or political claims.
