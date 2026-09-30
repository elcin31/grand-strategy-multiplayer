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

> The current transport is intentionally local-only. The next phase replaces it with a server-backed transport without rewriting the game engine.

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
      ├── LocalTransport       ← Phase 1
      └── ServerTransport      ← Phase 2
```

The server will be authoritative: clients send commands, the server validates and applies them, then broadcasts canonical state.

## Next phase

1. Real remote rooms across Android devices.
2. Authentication / guest identities.
3. Authoritative command validation.
4. Reconnect + snapshots + event log.
5. Province adjacency, army movement and combat.
6. Diplomacy and treaties.
7. Persistent campaigns.
