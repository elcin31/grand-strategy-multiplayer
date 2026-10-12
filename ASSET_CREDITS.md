# Expansion2.0 original paintings — 2026-10-10

27 NEW original paintings were commissioned with the built-in OpenAI ImageGen tool from separate textual scene descriptions; no external reference image, screenshot, copyrighted game tree/code/art or named-artist imitation was supplied. The19 approved category originals are5 Diplomacy,4 Military,4 Construction,3 Government and3 Religion. Eight additional originals cover espionage, economy, a fictional ruler, a fictional general, university research, national choices, historical chronicles and a loading atlas. The inherited15 accepted WebPs and original atlases remain byte-exact.

Final project assets: `assets/art/expansion/*.webp`; full final prompt set and original PNG identifiers/SHA256: `assets/art/expansion-prompts.json`. Manifest records every derivative/source hash, dimensions, category and subject ID. Original source PNGs remain untouched. Derivatives only resize/compress the complete composition:26 panels at640×360 and loading at960×540, WebP quality76. New bytes1,290,426; all42 WebPs3,479,060bytes, below the existing3,500,000 budget. No stock image, external license or reference-game asset was added; the same commissioned-output use basis described below applies.

Every category/theme has an active-panel consumer. Government/religion and all ten buildings retain their existing complete atlas alternatives. New faith scenes are mapped to their matching architecture; other faiths keep their accepted atlas. Leader/general banners are fictional historical atmosphere; existing stable individual portraits/names retain identity. Assets are registered by Metro and decoded only when their Image mounts, never by the map renderer. Actual WebP verification and42 byte-exact Android-export resources PASS; a candidate-only APK gate now requires all42 packaged hashes, pending actual CI build. Native layout/decoding/memory/frame acceptance remains open.

---

# Dominion asset provenance

The illustration completion pass reuses the same original portrait atlas for fictional commanders and the same building/military paintings for technology branches and open war panels. Commander visual identity derives from the existing stable ID; it does not add a save field. No extra generated artwork or third-party image was introduced by this completion pass.

## Original camera-pass artwork — 2026-10-09

Five additional original ImageGen compositions are embedded as six optimized
WebPs: a 12-person fictional ruler atlas, ten-building atlas, six-government
institution atlas, eight-faith architecture atlas and alternate night-port
loading scene (low/high). All were generated from text only; no AoH3 artwork,
photograph, screenshot or real person's portrait was supplied. The existing
military, economy, diplomacy, campaign and menu paintings are retained.

Files: `assets/art/rulers-atlas.webp`, `buildings-atlas.webp`,
`government-atlas.webp`, `religion-atlas.webp`, `loading-port-low.webp`,
`loading-port-high.webp`. Their complete checksums, dimensions and generated
source identifiers are in `assets/art/manifest.json`. Added compressed bytes:
818,030; all 15 WebPs together: 2,188,634 bytes. Four atlases together occupy
11,713,536 bytes if all decode at full source resolution; they are mounted by
the relevant panel, never by the map or hidden/collapsed sections. Shared
sources avoid a separate full image per card. Actual native memory is measured
separately; these pixel counts are not a peak-memory claim.

Final prompt set / built-in ImageGen: historical oil-painted fictional busts
(4×3, six men/six women, diverse faces, no real person); ten original
construction scenes in a fixed 5×2 order (farm, mine, factory, barracks, fort,
university, port, infrastructure, administration, hospital); government council
scenes in a 3×2 order (monarchy, republic, federation, military, theocracy,
community elders); respectful religious architecture in a 4×2 order
(Christianity, Islam, Hinduism, Buddhism, Judaism, Shinto, Sikhism, sacred grove);
16:9 lantern-lit historic port with campaign map. Shared constraints: navy,
burgundy, antique gold and parchment, original brushwork, no text/logos,
watermarks, screenshots or copied game material. Source originals remain in
the generating conversation; repo-native WebP derivatives are the shipped
assets. Secular/other/traditional belief cards use the neutral garden motif;
different Christian/Islamic branches share family architecture. Portrait seed
selects the same fictional painted miniature after save/reconnect.

## Original visual update artwork — 2026-10-09
All six illustrations under `assets/art/` were commissioned through OpenAI ImageGen specifically for Dominion in this session, from textual descriptions. No AoH3 screenshot, game artwork or other external image was supplied as generation input. Subjects: main-menu army/city panorama; campaign cartographic table; military commander; diplomacy council; trading-port economy; loading atlas.

The project user owns these outputs to the extent permitted by applicable law under OpenAI's output ownership terms: https://openai.com/policies/terms-of-use/ . They are supplied for embedding and distribution with Dominion. No third-party game license or required attribution is attached to these generated outputs. Output ownership does not guarantee exclusivity or copyright eligibility in every jurisdiction. WebP derivatives retain the original composition; source identifiers/checksums/dimensions are recorded in assets/art/manifest.json.

Heraldry and fictional miniature portraits in src/components/Heraldry.tsx are original project vector code, not extracted game sprites. Native platform fonts are used without redistributing external fonts.

## Existing assets retained
- Natural Earth world geography and populated places: public domain. https://www.naturalearthdata.com/about/terms-of-use/ . Existing source provenance remains in src/world/data/source.json and src/map/source.json.
- Flag SVGs: flag-icons MIT license, retained in src/world/data/flag-icons-LICENSE.txt. https://github.com/lipis/flag-icons . Existing required copyright/license notice remains packaged in the repository.
- Terrain/resource/game estimates: existing original game data; historical visuals do not imply factual resource deposits or demographic forecasts.

## Research only — not shipped
Age of History 3 screenshots on Steam, SteamDB and developer/community pages were viewed solely for visual/UX research. None are included in Dominion or licensed as project assets.

## Derived coastal construction sites — 2026-10-10

`supabase/functions/_shared/waterAccess.ts` and `WATER_ACCESS_REPORT.json` derive approximate port sites from the existing public-domain Natural Earth province geometry, using `scripts/derive-water-access.py`. Only exterior shores count; internal simplification holes or unrepresented land are excluded. No province/city/geometry is removed or modified, and no runtime GIS dependency is added. The report pins the unchanged source SHA. This is a game approximation, not maritime navigation data.

## Dominion 2.1 original art

Three original AI-generated oil illustrations (modern campaign, science/industry and a fictional modern commander), produced for this update on 2026-10-12. Source images remain in the session Library; packaged WebP copies are in `assets/art/overhaul/`. These are contemporary 2026 scenes, separate from retained 2.0 historical illustrations. The commander image is a shared fictional archetype, not an individual portrait of every commander. Original SVG navigation icons are drawn in `StrategyIcon.tsx`. No reference-game artwork was copied.
