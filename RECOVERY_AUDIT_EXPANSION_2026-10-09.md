# Dominion Expansion 2.0 — recovery baseline

Recovered main: `dbb354ab038713c3e54b969b34a6fc88bf2de11f`; previous tested runtime `47b0db4f8b220e9ea89998afaac035239b64f5e0` / standalone 0.8.1 (9). The 30 most recent commits and DEVELOPMENT_HANDOFF, PERFORMANCE_REPORT, BUG_REPORT, RELEASE_REPORT were inspected. Clean checkout recovered from existing repository; no new project or backend. This user instruction reopens gameplay development and supersedes older report instructions to stop after 0.8.1 delivery.

World unchanged: **195 countries, 2,924 provinces, 5,411 cities**, modern-world-v2, schema12. Backend is the existing dedicated `dfjsnjxnyjspwugjguhq` endpoint. No AssetMind access. Retained Skia raster tiles, path/border caches, culling/LOD/marker budgets and Reanimated camera.

Read-only production recovery confirms project name `grand-strategy-multiplayer`, ACTIVE_HEALTHY, game-room v21 and game-command v23. The retrieved deployed command bundle contains the existing 32KiB input limit, command receipt lookup and `commit_game_command` atomic RPC. No deployment, data mutation or other project access during stages 0–2.

| System | Status against Expansion 2.0 | Actual source / gap |
|---|---|---|
| Map/camera | PARTIAL | Retained optimized renderer, coverage commits and native paired evidence; microstutter/frame pacing and physical Redmi verification remain open. |
| Army selection | BROKEN | WorldMap selectAt prioritizes movement before marker taps; repeated tap cannot deselect. Back closes context without clearing selectedArmyId. |
| Army orders | DONE | Authoritative BFS/multistep orders, arrival combat, route display, explicit cancel, saved orders. New military access not present. |
| Diplomacy | PARTIAL | Improve (instant), rivals, guarantees, 3 treaties, consent/expiry, defensive calls, wars/peace/vassals; expanded actions, missions/reasons/history missing. Map foreign country does not open a targeted diplomatic panel. |
| Espionage | MISSING | No missions, discovery, counterintelligence, intelligence report or spy AI. |
| Economy | PARTIAL | Real tax/production/resource/trade/admin/upkeep/debt/interest/bankruptcy; funding policy and negotiated trade absent. |
| Buildings | PARTIAL | 10 buildings, levels/cost/time/effects/maintenance and monthly completion; only one construction per province, no prerequisite unlock graph. |
| Military | PARTIAL | 6 modern types, morale/organization/terrain/forts/commander skill; no supply graph, specialties, paid reinforcement or surviving defender retreat. |
| Technologies | PARTIAL | 5 repeatable 0–5 level branches; research cost/progress/university modifiers; no named prerequisite DAG/era/unlocks or connected tree UI. |
| National focuses | MISSING | No generic/regional/unique trees, focus progress/rewards/events or focus AI. |
| AI | PARTIAL | Indexed, staggered strategic AI, economy/research/recruit/build/war/peace; expanded diplomatic proposals/spy/focus/supply planning absent. |
| Authority/multiplayer | DONE (existing) | Shared reducer, identity validation, CAS/idempotency receipt RPC, dynamic snapshots, reconnect. New mechanics must use these same paths and receive fresh deployed-backend QA. |
| Save/load | DONE (existing) | Schema12 normalizers, atomic generations, checksum, city migration backups; new schema requires compatible migration and strict validation. |
| Illustrations | PARTIAL | 15 optimized original WebPs / 2,188,634 bytes, lazy panel/atlas loading and provenance. Requirement is 19 **new** topical paintings, not reuse of these 15. |
| Android workflow | DONE (existing) | Embedded release/Hermes/Skia/landscape/retained sideload signing; long simulation + native smoke/30min soak + paired camera gates. New APK not built. |

Baseline strict TypeScript and **175/175 JS tests PASS** before code changes. Local logs: expansion-baseline-typecheck.txt / expansion-baseline-tests.txt. Current host camera fixture run saved separately from future measurements; host CPU is not Android FPS. Prior accepted native paired 0.7.0→0.8.1 evidence is CAMERA_NATIVE_PAIRED_081.json (not a new before/after comparison).

Observed hotspots to test: timestamp-reset camera limiter drifts on 90Hz callbacks; save clones/validation/JSON/checksum/readback occupy JS during gestures; local simulation and autosave are independently timed and may coincide with pinch. New work must preserve real game ticks, one in-flight command and durable background/manual saves. No further world reduction authorized.

References reviewed for original design: Paradox official HOI IV strategy guide (https://forumcontent.paradoxplaza.com/public/paradox/banners/HoI_IV_Strategy_Guide.pdf) and official No Step Back announcement (https://www.paradoxinteractive.com/media/press-releases/paradox-interactive/major-hearts-of-iron-iv-expansion-released). Design lessons: industrial/research/logistics connections and meaningful long-term focus choices; no protected assets/text/trees copied. Age of History III official developer/publisher Steam listing successfully read on retry: https://store.steampowered.com/app/2772750/Age_of_History_3/ . Relevant abstractions: research unlocks buildings and equipment, front/support roles, morale/retreat and finite recruitment/reinforcement manpower. Dominion retains its own catalogue, monthly model and mobile layout; no assets, texts or original trees copied.
