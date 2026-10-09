# Dominion — historical atlas visual update

## Recovery and references (2026-10-09)
Base: origin/main 9dc0dec, accepted v4 runtime a9df239. 195 countries, 2,924 gameplay provinces, 7,214 cities. Existing Skia renderer, LOD, batching, camera worklets, staged startup, deterministic AI scheduling and authority remain the foundation.

Viewed actual AoH3 menu/map/diplomacy/economy screenshots through Steam community, Steam store, SteamDB and image search. References: https://store.steampowered.com/app/2772750/Age_of_History_3/ ; https://steamcommunity.com/app/2772750/screenshots/ ; https://steamdb.info/app/2772750/screenshots/ . Supplementary menu screenshot: https://www.ageofcivilizationsgame.com/topic/251977-project-civilization-2/ . References informed composition and density only; no screenshot or copyrighted game asset is packaged.

Direction: premium historical atlas. Large atmospheric painting with a left navy menu; parchment text, burgundy selected controls, restrained gold rules and compact rectangular panels. Original layout, coat-of-arms geometry and illustrations; no pixel recreation. The campaign remains the existing modern-world scenario; historical artwork provides atmosphere, not a claim of additional historical scenarios.

## Tokens and interface
`src/ui/tokens.ts` defines palette, spacing, fonts, surfaces, borders, controls and transition intent. Navy #101B26, graphite #0B1118, parchment #E8DCC5, gold #C6A76A, burgundy #69383E. Native Android serif headings and sans-serif body; tabular figures on key metrics. No font network request. Panels retain existing commands and sections. Economy uses ruled numeric ledger rows; military, diplomacy and economy have original banner art. Fictional rulers now have seed-stable original vector miniature portraits and heraldry.

Main menu provides Continue (disabled with explanation when absent), New Campaign, Singleplayer, Multiplayer, Load Game, Settings, Exit. Campaign and codec modules load only after a latched action has painted loading feedback. Current menu pages support hardware Back. Singleplayer leads to the existing country picker and readiness dock; multiplayer keeps authoritative create/join/reconnect. Errors return to the menu visibly. Save deletion is not part of this update.

Map: softened source hues retain country identities, parchment serif labels with a dark offset for legibility, navy water, dark national boundaries, subtle coastline line, existing terrain/rivers/lakes, crown-ring capitals, shield army counters with own/foreign distinction, movement and recent-combat symbols. Selected routes and province highlights preserve existing interaction and commands. Performance/Balanced no longer instantiate a gradient for each political batch; High/Ultra retain limited shading.

## Original artwork and decoding budgets
Six paintings generated for this project; source credits in ASSET_CREDITS.md. `assets/art/manifest.json` records dimensions, file sizes and checksums. Full-screen images: 960px/quality78 Performance and Balanced, 1600px/quality86 High and Ultra. Panel paintings: 640px/quality82. Require registers resources without decoding; Image mounts only the current background or current panel banner. No preload of all full-size paintings, video, live blur or mandatory animated background. Decoded image lifetime follows the mounted screen.

## Validation status
Typecheck and original 161 JS regressions pass after menu/UI work. Native layout screenshots and complete release QA remain pending until the Android release gate. Do not infer visual acceptance or device FPS from host tests.
