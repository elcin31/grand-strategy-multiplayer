# Grand Strategy Multiplayer

Android-first multiplayer grand-strategy game built as an original project with original code and data.

## Current status

- Expo SDK 57 / React Native 0.86 / TypeScript
- Android-first responsive UI
- Interactive prototype map with selectable countries and provinces
- Deterministic game state + authoritative server command reducer
- Lobby, room code, country selection, ready state, host start
- Running game clock with speed controls and monthly economy ticks
- Multiplayer transport interface separated from game logic
- Supabase backend deployed in a dedicated project
- Edge Functions `game-room` and `game-command` deployed
- RLS enabled; `anon` and `authenticated` have no direct table privileges
- Random player bearer tokens stored server-side only as SHA-256 hashes
- Optimistic version checks prevent simultaneous commands from silently overwriting each other
- Android client points to the deployed multiplayer backend by default
- EAS configuration for APK preview builds

## Production multiplayer backend

Project ref:

```text
dfjsnjxnyjspwugjguhq
```

Functions base URL:

```text
https://dfjsnjxnyjspwugjguhq.supabase.co/functions/v1
```

You can override the endpoint for development with:

```text
EXPO_PUBLIC_MULTIPLAYER_URL=https://<project-ref>.supabase.co/functions/v1
```

No service-role or secret key is stored in the mobile app or repository.

## Run

Requirements: Node.js 22.13+ for Expo SDK 57.

```bash
npm install
npm run typecheck
npm run start
```

For Android:

```bash
npm run android
```

For an installable preview APK after EAS authentication:

```bash
npx eas build --platform android --profile preview
```

## Architecture

```text
UI (React Native)
      ↓ commands
Game Engine / command model
      ↓
HttpTransport
      ↓
Supabase Edge Functions
      ↓
Authoritative PostgreSQL state
```

Mobile clients never write game tables directly. `game-room` handles room creation, joining and authenticated state reads. `game-command` validates the player's room token and applies commands on the server.

## Backend files

- `supabase/migrations/0001_multiplayer_core.sql`
- `supabase/functions/_shared/game.ts`
- `supabase/functions/_shared/security.ts`
- `supabase/functions/game-room/index.ts`
- `supabase/functions/game-command/index.ts`
- `src/multiplayer/httpTransport.ts`

## Next phase

1. Test two physical Android clients in one room.
2. Persist sessions locally and reconnect after app restarts/network loss.
3. Add province adjacency, legal movement paths and combat resolution.
4. Move state delivery from polling to Supabase Realtime Broadcast.
5. Add diplomacy, wars, peace treaties and alliances.
6. Persist long-running campaigns and player return state.
7. Add server-side rate limiting / abuse protection for public room creation.

## World update checkpoint (branch `world-update`)

The map now uses a native Skia GPU canvas rather than a grid of SVG rectangles.
Geographic contours come from public-domain Natural Earth; terrain bands and visual
styling are original. Pan/inertia, pinch and double-tap zoom run through native
shared-value camera transforms. Geometry is cached and batched by color; spatial
queries and city detail budgets control visible content. Low/Medium/High/Ultra
settings change rendering only.

The landscape screen uses safe-area insets and a collapsible overlay panel.
`ОДИНОЧНАЯ ИГРА` starts the existing scenario offline without connecting to the
server. Offline campaign persistence is not implemented yet.

This checkpoint is **not** the completed world update: it still has 8 playable
countries and 12 provinces. See `WORLD_UPDATE_STATUS.md`, `BUG_REPORT.md` and
`THIRD_PARTY_NOTICES.md` for exact scope, gates and source provenance.

```bash
npm ci --include=dev
npm run typecheck
npm test
npm run benchmark:map
npx expo prebuild --platform android --clean
python scripts/verify-native-config.py
cd android
./gradlew assembleRelease --no-daemon
```

CI checks the embedded `assets/index.android.bundle`, Skia/Hermes libraries, native
landscape configuration, and emulator cold launch / map / layout / restart. It
builds a clearly labelled renderer checkpoint APK; the final
`Dominion-world-update-release.apk` is reserved for full acceptance.
