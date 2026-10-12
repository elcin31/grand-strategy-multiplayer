# Dominion 2.1 — Grand Strategy Overhaul

Standalone Android playtest: `Dominion-2.1-playtest.apk`, version 2.1.0 (11). Same package and signing certificate as Dominion 2.0; embedded Hermes bundle, landscape, Android 7.0+. Metro and Expo Go are unnecessary.

Alternative download: `Dominion-2.1-playtest.zip` contains the identical signed APK and its checksum. Extract it in the phone's file manager and open the APK. If an embedded browser leaves the APK download at 100%, open the ZIP link in the external browser.

- Compact gold/navy HUD, context panels, notifications with optional pause, political mini-map and era-aware artwork adapted to the supplied visual concept.
- Daily calendar, pause and five speeds; monthly economic accounting remains monthly. Multiplayer time belongs to the host, with player pause requests/votes.
- 18 regiment types, formations, waypoint routes/ETA, split/merge/redeployment/escort, army groups, commander development, continuous battles, sieges, occupation, logistics and battle reports.
- Persistent strategic AI with staggered operational/tactical decisions; 35 resources, stockpiles, shortages, consenting trade contracts and bounded prices; 40 buildings, material requirements, construction priorities, damage/repair and six national projects.
- 16 production recipes with actual inputs, equipment consumption, industry allocation and automation; 100 technologies in nine directions; 120 original focuses, mutually exclusive paths, national spirits, timed decisions and event choices.
- Fog/intelligence, war goals, constrained peace terms, exhaustion, vassal autonomy/integration, advisers, chronicle, rankings and an optional short tutorial. All previous illustrations retained, with three original optimized WebP additions.

Offline Dominion 2.0 saves migrate to schema 23 with a preserved backup. New 2.1 multiplayer rooms use versioned functions in the existing Dominion backend and retain opaque session authentication, server command validation, CAS and replay receipts. Existing online 2.0 campaigns remain in 2.0; its published release and endpoints are unchanged.

Known limitations: inherited camera microstutter is deferred; the modern commander portrait is shared; group defense lines cover adjacent provinces around a selected target; balancing is an initial playtest pass. Physical-device smoothness has not been measured.

Verification: strict TypeScript check, 38 lean gameplay/save/authority checks, migration from an actual Dominion 2.0 save, live backend command/reconnect/spoof-rejection checks, signed standalone build and short Android launch/HUD/map/army-split/save-restart smoke passed.

Exact binary identity, build/native results and backend pin are recorded in `DOMINION_21_RELEASE_MANIFEST.json` accompanying this release.
