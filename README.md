# Grand Strategy Multiplayer

Android-first multiplayer grand-strategy game built as an original project with original code and data.

## Phase 1 status

- Expo SDK 57 / React Native 0.86 / TypeScript
- Android-first responsive UI
- Interactive prototype map with selectable countries and provinces
- Deterministic game state + command reducer
- Lobby, room code, country selection, ready state, host start
- Running game clock with speed controls and monthly economy ticks
- Multiplayer transport interface separated from game logic
- Local transport implementation for development
- EAS configuration for APK preview builds

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
Game Engine (pure deterministic reducer)
      ↓
MultiplayerTransport
      ├── LocalTransport
      └── HttpTransport → Supabase Edge Functions → PostgreSQL
```

The server is authoritative: clients send commands, the server validates and applies them, then clients pull the canonical state.

## Phase 2 backend scaffold

The repository contains:

- `supabase/migrations/0001_multiplayer_core.sql`
- `supabase/functions/game-room`
- `supabase/functions/game-command`
- `src/multiplayer/httpTransport.ts`

The database tables are RLS-protected and revoked from `anon`/`authenticated`. Mobile clients only call Edge Functions. Each player receives a random bearer token; only its SHA-256 hash is stored server-side. Game commands use optimistic version checks to prevent simultaneous writes from silently overwriting each other.

Set `EXPO_PUBLIC_MULTIPLAYER_URL=https://<project-ref>.supabase.co/functions/v1` to switch the app from `LocalTransport` to the remote transport.

## Next phase

1. Deploy the Supabase backend to a dedicated project.
2. Test two physical Android clients in one room.
3. Add reconnect persistence and session restoration.
4. Add province adjacency, army movement and combat.
5. Move state delivery from polling to Supabase Realtime Broadcast.
6. Add diplomacy and treaties.
7. Persist long-running campaigns.
