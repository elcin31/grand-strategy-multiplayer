# Dominion — historical atlas visual update

## Camera-pass illustration coverage (2026-10-09)

Original painted ruler/government/religion/building atlases and the port loading scene are integrated. The completion pass additionally reuses the ready portrait atlas for real commander assignment cards and the assigned-commander row, with a stable visual seed derived only from commander ID. Research mounts the university scene and a relevant building miniature for each of the five authoritative branches. Open war/peace panels reuse the military painting. Existing country/menu/campaign/loading/economy/diplomacy/army paintings remain. All images are outside the map canvas and mount only with their active panel or expanded section; no new image files, eager preload or per-pan decoding.

Commands, costs, assignment permissions, research progression, war/peace decisions and save data keep their existing authoritative implementations. Native acceptance must show actual commander assignment/portrait, research illustration and research completion in the final versioned APK, alongside existing ruler/building/government/religion assertions.

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
Accepted runtime c758ed78f586268809a2184a064ae7fdadc5156e, Android workflow 37918487336 all PASS: TS/167 JS/3 Python/world/map/art/10,000 ticks/ten restores/native start/layout/preset/30-minute soak. Actual final menu/new-campaign/loading/map/economy/diplomacy/government/dense screenshots reviewed. Native assertions enforce full painting coverage and legible 24px statistics. Safe-area feedback/awaited native saves included; nine art hashes match packaged APK. City catalogue 5,411 retains all capitals/exact population and authority/gameplay. RELEASE_REPORT.md has exact evidence. Physical Redmi FPS/touch/thermal unmeasured.
